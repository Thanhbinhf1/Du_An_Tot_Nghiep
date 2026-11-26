import { AppError } from "../middlewares/AppError.js";

// Chỉ ngừng tạo thanh toán mới; IPN của giao dịch trước đó vẫn được xác minh.
export function isMoMoEnabled() {
  return process.env.MOMO_ENABLED === undefined || process.env.MOMO_ENABLED.trim().toLowerCase() === "true";
}

export function requireMoMoEnabled() {
  if (!isMoMoEnabled()) throw new AppError("Cửa hàng đang hoàn tất đăng ký tài khoản MoMo nhận tiền. Vui lòng chọn phương thức thanh toán khác.", 503);
}

export function getMoMoConfig() {
  const partnerCode = process.env.MOMO_PARTNER_CODE;
  const accessKey = process.env.MOMO_ACCESS_KEY;
  const secretKey = process.env.MOMO_SECRET_KEY;
  const endpoint = process.env.MOMO_ENDPOINT;
  const redirectUrl = process.env.MOMO_REDIRECT_URL;
  const ipnUrl = process.env.MOMO_IPN_URL;

  if (
    !partnerCode ||
    !accessKey ||
    !secretKey ||
    !endpoint ||
    !redirectUrl ||
    !ipnUrl
  ) {
    throw new AppError("Chưa cấu hình đầy đủ tài khoản tích hợp MoMo.", 503);
  }

  return {
    partnerCode,
    accessKey,
    secretKey,
    endpoint,
    redirectUrl,
    ipnUrl,
  };
}
