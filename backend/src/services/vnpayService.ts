import crypto from "node:crypto";
import { getVNPayConfig } from "../config/vnpayConfig.js";

type VNPayParams = Record<string, string>;

function formatVNPayDate(date: Date): string {
  // VNPay sử dụng múi giờ Việt Nam (GMT+7).
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

  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return (
    get("year") +
    get("month") +
    get("day") +
    get("hour") +
    get("minute") +
    get("second")
  );
}

function serializeParams(params: VNPayParams): string {
  const searchParams = new URLSearchParams();

  for (const key of Object.keys(params).sort()) {
    searchParams.append(key, params[key]!);
  }

  return searchParams.toString();
}

function signData(data: string, secret: string): string {
  return crypto.createHmac("sha512", secret).update(data, "utf8").digest("hex");
}

export function createVNPayUrl(input: {
  amount: number;
  txnRef: string;
  orderInfo: string;
  ipAddr: string;
}) {
  const config = getVNPayConfig();

  if (
    !Number.isSafeInteger(input.amount) ||
    input.amount <= 0 ||
    !Number.isSafeInteger(input.amount * 100)
  ) {
    throw new Error("Số tiền VNPay không hợp lệ");
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 15 * 60 * 1000);

  const params: VNPayParams = {
    vnp_Version: "2.1.0",
    vnp_Command: "pay",
    vnp_TmnCode: config.tmnCode,
    vnp_Amount: String(input.amount * 100),
    vnp_CurrCode: "VND",
    vnp_TxnRef: input.txnRef,
    vnp_OrderInfo: input.orderInfo,
    vnp_OrderType: "other",
    vnp_Locale: "vn",
    vnp_ReturnUrl: config.returnUrl,
    vnp_IpAddr: input.ipAddr,
    vnp_CreateDate: formatVNPayDate(now),
    vnp_ExpireDate: formatVNPayDate(expiresAt),
  };

  const signContent = serializeParams(params);
  const secureHash = signData(signContent, config.hashSecret);

  const separator = config.paymentUrl.includes("?") ? "&" : "?";

  return {
    payment_url:
      `${config.paymentUrl}${separator}` +
      `${signContent}&vnp_SecureHash=${secureHash}`,
    expires_at: expiresAt,
  };
}

export function verifyVNPaySignature(query: Record<string, unknown>): boolean {
  const config = getVNPayConfig();

  const receivedHash = query.vnp_SecureHash;

  if (
    typeof receivedHash !== "string" ||
    !/^[a-fA-F0-9]{128}$/.test(receivedHash)
  ) {
    return false;
  }

  const params: VNPayParams = {};

  for (const [key, value] of Object.entries(query)) {
    if (key === "vnp_SecureHash" || key === "vnp_SecureHashType") {
      continue;
    }

    if (!key.startsWith("vnp_") || typeof value !== "string") {
      return false;
    }

    params[key] = value;
  }

  const expectedHash = signData(serializeParams(params), config.hashSecret);

  return crypto.timingSafeEqual(
    Buffer.from(receivedHash, "hex"),
    Buffer.from(expectedHash, "hex"),
  );
}
