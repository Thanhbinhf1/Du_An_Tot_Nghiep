import crypto from "node:crypto";
import { getVNPayConfig } from "../config/vnpayConfig.js";

const QUERY_URL =
  "https://sandbox.vnpayment.vn/merchant_webapi/api/transaction";

function vnDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const get = (key: string) =>
    parts.find((part) => part.type === key)?.value ?? "";

  return [
    get("year"),
    get("month"),
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  ].join("");
}

function hash(content: string, secret: string): string {
  return crypto
    .createHmac("sha512", secret)
    .update(content, "utf8")
    .digest("hex");
}

function verifyQueryResponse(
  data: Record<string, unknown>,
  secret: string,
): boolean {
  const fields = [
    "vnp_ResponseId",
    "vnp_Command",
    "vnp_ResponseCode",
    "vnp_Message",
    "vnp_TmnCode",
    "vnp_TxnRef",
    "vnp_Amount",
    "vnp_BankCode",
    "vnp_PayDate",
    "vnp_TransactionNo",
    "vnp_TransactionType",
    "vnp_TransactionStatus",
    "vnp_OrderInfo",
    "vnp_PromotionCode",
    "vnp_PromotionAmount",
  ];

  const received = data.vnp_SecureHash;

  if (typeof received !== "string" || !/^[a-fA-F0-9]{128}$/.test(received)) {
    return false;
  }

  const values: string[] = [];

  for (const field of fields) {
    const value = data[field];

    if (value === undefined || value === null) {
      values.push("");
    } else if (typeof value === "string") {
      values.push(value);
    } else {
      return false;
    }
  }

  const expected = hash(values.join("|"), secret);

  return crypto.timingSafeEqual(
    Buffer.from(received, "hex"),
    Buffer.from(expected, "hex"),
  );
}

export async function queryVNPayTransaction(input: {
  txnRef: string;
  transactionDate: string;
}) {
  const config = getVNPayConfig();

  if (
    !/^[a-zA-Z0-9]{1,100}$/.test(input.txnRef) ||
    !/^\d{14}$/.test(input.transactionDate)
  ) {
    throw new Error("Thông tin truy vấn không hợp lệ");
  }

  const requestId = crypto.randomBytes(16).toString("hex");

  const params = {
    vnp_RequestId: requestId,
    vnp_Version: "2.1.0",
    vnp_Command: "querydr",
    vnp_TmnCode: config.tmnCode,
    vnp_TxnRef: input.txnRef,
    vnp_OrderInfo: `Query payment ${input.txnRef}`,
    vnp_TransactionDate: input.transactionDate,
    vnp_CreateDate: vnDate(new Date()),
    vnp_IpAddr: "127.0.0.1",
  };

  const signContent = [
    params.vnp_RequestId,
    params.vnp_Version,
    params.vnp_Command,
    params.vnp_TmnCode,
    params.vnp_TxnRef,
    params.vnp_TransactionDate,
    params.vnp_CreateDate,
    params.vnp_IpAddr,
    params.vnp_OrderInfo,
  ].join("|");

  const response = await fetch(QUERY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...params,
      vnp_SecureHash: hash(signContent, config.hashSecret),
    }),
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(`VNPay QueryDR HTTP ${response.status}`);
  }

  const data: unknown = await response.json();

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Phản hồi VNPay không hợp lệ");
  }

  const result = data as Record<string, unknown>;

  if (!verifyQueryResponse(result, config.hashSecret)) {
    throw new Error("Chữ ký phản hồi VNPay không hợp lệ");
  }

  if (
    result.vnp_TmnCode !== config.tmnCode ||
    result.vnp_TxnRef !== input.txnRef ||
    result.vnp_Command !== "querydr"
  ) {
    throw new Error("Dữ liệu đối soát không khớp");
  }

  return {
    responseCode: result.vnp_ResponseCode,
    transactionStatus: result.vnp_TransactionStatus,
    amount: result.vnp_Amount,
    transactionNo: result.vnp_TransactionNo,
  };
}
