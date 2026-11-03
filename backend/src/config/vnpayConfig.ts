import { AppError } from "../middlewares/AppError.js";

export function getVNPayConfig() {
  const tmnCode = process.env.VNP_TMN_CODE;
  const hashSecret = process.env.VNP_HASH_SECRET;
  const paymentUrl = process.env.VNP_URL;
  const returnUrl = process.env.VNP_RETURN_URL;

  if (!tmnCode || !hashSecret || !paymentUrl || !returnUrl) {
    throw new AppError("Chưa cấu hình đầy đủ VNPay Sandbox", 500);
  }

  return {
    tmnCode,
    hashSecret,
    paymentUrl,
    returnUrl,
    version: "2.1.0",
  };
}
