import crypto from "node:crypto";
import { getMoMoConfig, requireMoMoEnabled } from "../config/momoConfig.js";
import { AppError } from "../middlewares/AppError.js";

function signMoMo(content: string, secretKey: string): string {
  return crypto
    .createHmac("sha256", secretKey)
    .update(content, "utf8")
    .digest("hex");
}

interface CreateMoMoInput {
  orderId: string;
  amount: number;
  orderInfo: string;
}

interface MoMoCreateResponse {
  partnerCode: string;
  orderId: string;
  requestId: string;
  resultCode: number;
  message: string;
  payUrl?: string;
  deeplink?: string;
  qrCodeUrl?: string;
}

export async function createMoMoPayment(input: CreateMoMoInput) {
  requireMoMoEnabled();
  const config = getMoMoConfig();

  if (
    !Number.isSafeInteger(input.amount) ||
    input.amount < 1000 ||
    input.amount > 50_000_000
  ) {
    throw new Error("Số tiền thanh toán MoMo không hợp lệ");
  }

  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(input.orderId) || !input.orderInfo.trim()) {
    throw new Error("Thông tin đơn hàng không hợp lệ");
  }

  const requestId = input.orderId;
  const requestType = "captureWallet";
  const extraData = "";
  const amount = String(input.amount);

  const rawSignature = [
    `accessKey=${config.accessKey}`,
    `amount=${amount}`,
    `extraData=${extraData}`,
    `ipnUrl=${config.ipnUrl}`,
    `orderId=${input.orderId}`,
    `orderInfo=${input.orderInfo}`,
    `partnerCode=${config.partnerCode}`,
    `redirectUrl=${config.redirectUrl}`,
    `requestId=${requestId}`,
    `requestType=${requestType}`,
  ].join("&");

  const signature = signMoMo(rawSignature, config.secretKey);

  const payload = {
    partnerCode: config.partnerCode,
    requestId,
    amount: input.amount,
    orderId: input.orderId,
    orderInfo: input.orderInfo,
    redirectUrl: config.redirectUrl,
    ipnUrl: config.ipnUrl,
    requestType,
    extraData,
    lang: "vi",
    autoCapture: true,
    signature,
  };

  const response = await fetch(config.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30_000),
  }).catch(() => {
    throw new AppError("MoMo chưa phản hồi. Bạn có thể thử lại thanh toán trên đơn này.", 502);
  });

  if (response.status === 422) {
    const result = await response.json().catch(() => null);
    if (result?.resultCode === 7000) {
      throw new AppError("MoMo đang xử lý yêu cầu. Vui lòng chờ một chút rồi thử lại.", 409);
    }
  }
  if (!response.ok) {
    throw new AppError("MoMo chưa nhận yêu cầu thanh toán. Bạn có thể thử lại trên đơn này.", 502);
  }

  const data: unknown = await response.json();

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Phản hồi MoMo không hợp lệ");
  }

  const result = data as Partial<MoMoCreateResponse>;

  if (
    result.partnerCode !== config.partnerCode ||
    result.orderId !== input.orderId ||
    result.requestId !== requestId ||
    result.resultCode !== 0 ||
    typeof result.payUrl !== "string" ||
    !result.payUrl.startsWith("https://")
  ) {
    throw new Error("Không thể tạo yêu cầu thanh toán MoMo");
  }

  return {
    order_id: input.orderId,
    request_id: requestId,
    amount: input.amount,
    payment_url: result.payUrl,
  };
}

export interface MoMoIPNData {
  partnerCode: string;
  orderId: string;
  requestId: string;
  amount: number;
  orderInfo: string;
  orderType: string;
  transId: number;
  resultCode: number;
  message: string;
  payType: string;
  responseTime: number;
  extraData: string;
  signature: string;
}

export function verifyMoMoIPNSignature(body: unknown): body is MoMoIPNData {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return false;
  }

  const data = body as Record<string, unknown>;

  const stringFields = [
    "partnerCode",
    "orderId",
    "requestId",
    "orderInfo",
    "orderType",
    "message",
    "payType",
    "extraData",
    "signature",
  ];

  for (const field of stringFields) {
    if (typeof data[field] !== "string") {
      return false;
    }
  }

  const numberFields = ["amount", "transId", "resultCode", "responseTime"];

  for (const field of numberFields) {
    if (typeof data[field] !== "number" || !Number.isSafeInteger(data[field])) {
      return false;
    }
  }

  const signature = data.signature as string;

  // Từ chối chữ ký không đúng định dạng trước
  if (!/^[a-fA-F0-9]{64}$/.test(signature)) {
    return false;
  }

  // Chỉ đọc cấu hình sau khi kiểm tra dữ liệu đầu vào
  const config = getMoMoConfig();

  if (data.partnerCode !== config.partnerCode) {
    return false;
  }

  const rawSignature = [
    `accessKey=${config.accessKey}`,
    `amount=${data.amount}`,
    `extraData=${data.extraData}`,
    `message=${data.message}`,
    `orderId=${data.orderId}`,
    `orderInfo=${data.orderInfo}`,
    `orderType=${data.orderType}`,
    `partnerCode=${data.partnerCode}`,
    `payType=${data.payType}`,
    `requestId=${data.requestId}`,
    `responseTime=${data.responseTime}`,
    `resultCode=${data.resultCode}`,
    `transId=${data.transId}`,
  ].join("&");

  const expected = signMoMo(rawSignature, config.secretKey);

  return crypto.timingSafeEqual(
    Buffer.from(signature, "hex"),
    Buffer.from(expected, "hex"),
  );
}
