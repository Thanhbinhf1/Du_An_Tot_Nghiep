import { getBankConfig } from "./bankConfig.js";
import { getMoMoConfig } from "./momoConfig.js";
import { getVNPayConfig } from "./vnpayConfig.js";
import { AppError } from "../middlewares/AppError.js";

const providers = { BankTransfer: getBankConfig, MoMo: getMoMoConfig, VNPay: getVNPayConfig };

export function getPaymentResultPage(method: "MoMo" | "VNPay") {
  const value = method === "VNPay" ? process.env.VNP_RESULT_PAGE_URL : process.env.MOMO_RESULT_PAGE_URL;
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
    if (method !== "BankTransfer") getPaymentResultPage(method);
    return true;
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
    return false;
  }
}

export function configuredPaymentMethods() {
  return (["COD", "BankTransfer", "MoMo", "VNPay"] as const).filter(isPaymentMethodConfigured);
}
