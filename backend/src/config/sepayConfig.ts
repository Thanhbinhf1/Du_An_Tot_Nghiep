import { AppError } from "../middlewares/AppError.js";

export function getSePayConfig() {
  const bankCode = process.env.SEPAY_BANK_CODE?.trim();
  const accountNumber = process.env.SEPAY_ACCOUNT_NUMBER?.trim();
  const accountName = process.env.SEPAY_ACCOUNT_NAME?.trim();
  const webhookApiKey = process.env.SEPAY_WEBHOOK_API_KEY?.trim();
  const apiToken = process.env.SEPAY_API_TOKEN?.trim();
  const environment = process.env.SEPAY_ENV?.trim() || "production";
  if (!bankCode || !accountNumber || !accountName || (!webhookApiKey && !apiToken)) {
    throw new AppError("Cửa hàng chưa cấu hình thanh toán SePay.", 503);
  }
  if (!/^[a-zA-Z][a-zA-Z0-9]{1,29}$/.test(bankCode) || !/^[a-zA-Z0-9]{3,40}$/.test(accountNumber) ||
      !["production", "sandbox"].includes(environment)) {
    throw new AppError("Cấu hình ngân hàng hoặc môi trường SePay không hợp lệ.", 503);
  }
  const apiBaseUrl = environment === "sandbox"
    ? "https://userapi-sandbox.sepay.vn/v2"
    : "https://userapi.sepay.vn/v2";
  return { bankCode, accountNumber, accountName, webhookApiKey, apiToken, apiBaseUrl };
}
