import { AppError } from "../middlewares/AppError.js";

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
    throw new AppError("Chưa cấu hình đầy đủ MoMo Sandbox", 500);
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
