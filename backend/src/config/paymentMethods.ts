import { getBankConfig } from "./bankConfig.js";
import { getMoMoConfig, isMoMoEnabled } from "./momoConfig.js";
import { getSePayConfig } from "./sepayConfig.js";
import { AppError } from "../middlewares/AppError.js";

const providers = { BankTransfer: getBankConfig, MoMo: getMoMoConfig, SePay: getSePayConfig };
export const PAYMENT_METHODS = ["COD", "BankTransfer", "SePay", "MoMo"] as const;
export type SupportedPaymentMethod = (typeof PAYMENT_METHODS)[number];
export const STORED_PAYMENT_METHODS = [...PAYMENT_METHODS, "VNPay", "PayOS"] as const;
export function isStoredPaymentMethod(value: unknown) { return STORED_PAYMENT_METHODS.some((method) => method === value); }

export function isSupportedPaymentMethod(value: unknown): value is SupportedPaymentMethod {
  return PAYMENT_METHODS.some((method) => method === value);
}

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

export function isPaymentMethodConfigured(method: SupportedPaymentMethod) {
  if (method === "COD") return true;
  if (method === "MoMo" && !isMoMoEnabled()) return false;
  try {
    providers[method]();
    if (method === "MoMo") getPaymentResultPage(method);
    return true;
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
    return false;
  }
}

export function configuredPaymentMethods() {
  return PAYMENT_METHODS.filter(isPaymentMethodConfigured);
}

export function checkoutPaymentMethodIssue(method: SupportedPaymentMethod, amount: number) {
  if (amount === 0 && method !== "COD") return "Vui lòng chọn COD cho đơn hàng có tổng tiền bằng 0.";
  if (method === "MoMo" && (amount < 1_000 || amount > 50_000_000)) return "MoMo không hỗ trợ tổng tiền đơn hàng này.";
  if (method === "SePay" && !Number.isSafeInteger(amount)) return "SePay yêu cầu tổng tiền là số nguyên VNĐ.";
  return undefined;
}
