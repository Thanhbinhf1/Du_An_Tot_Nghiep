import { getBankConfig } from "./bankConfig.js";
import { getMoMoConfig } from "./momoConfig.js";
import { getSePayConfig } from "./sepayConfig.js";
import { getVNPayConfig } from "./vnpayConfig.js";
import { AppError } from "../middlewares/AppError.js";

const providers = { BankTransfer: getBankConfig, MoMo: getMoMoConfig, VNPay: getVNPayConfig, SePay: getSePayConfig };

export function getPaymentResultPage(method: "MoMo" | "VNPay") {
  const value = {
    VNPay: process.env.VNP_RESULT_PAGE_URL,
    MoMo: process.env.MOMO_RESULT_PAGE_URL,
  }[method];
  if (!value?.trim()) {
    throw new AppError(`Chưa cấu hình trang kết quả ${method}.`, 500);
  }
  const url = URL.parse(value.trim());
  if (!url || !["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new AppError(`URL trang kết quả ${method} không hợp lệ.`, 500);
  }
  return url;
}

export function isPaymentMethodConfigured(method: "COD" | keyof typeof providers) {
  if (method === "COD") return true;
  try {
    providers[method]();
    if (method === "VNPay" || method === "MoMo") getPaymentResultPage(method);
    return true;
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
    return false;
  }
}

export function configuredPaymentMethods() {
  return (["COD", "BankTransfer", "MoMo", "SePay"] as const).filter(isPaymentMethodConfigured);
}
