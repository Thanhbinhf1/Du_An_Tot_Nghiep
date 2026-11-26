import nodemailer from "nodemailer";
import { AppError } from "../middlewares/AppError.js";

export function getEmailConfig() {
  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT || 465);
  const user = process.env.SMTP_USER?.trim();
  const password = process.env.SMTP_PASSWORD;
  const from = process.env.SMTP_FROM?.trim() || (user ? `VSC_BAPD <${user}>` : undefined);
  if (!host || !user || !password || !from || !Number.isSafeInteger(port) || port < 1 || port > 65535 ||
      /[\r\n]/.test(host + user + from)) {
    throw new AppError("Cửa hàng chưa bật gửi email khôi phục mật khẩu. Vui lòng liên hệ hỗ trợ.", 503);
  }
  return { host, port, user, password, from };
}

export class EmailService {
  static async sendPasswordResetCode(email: string, code: string) {
    const config = getEmailConfig();
    const transport = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      requireTLS: config.port !== 465,
      auth: { user: config.user, pass: config.password },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
      disableFileAccess: true,
      disableUrlAccess: true,
    });
    await transport.sendMail({
      from: config.from,
      to: email,
      subject: "Mã xác minh lấy lại mật khẩu",
      text: `Mã xác minh của bạn là ${code}. Mã có hiệu lực trong 10 phút và chỉ dùng một lần. Nếu bạn không yêu cầu lấy lại mật khẩu, hãy bỏ qua email này.`,
      html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:32px;color:#221c1a"><h1 style="font-size:24px">Lấy lại mật khẩu</h1><p>Nhập mã dưới đây trên trang lấy lại mật khẩu của cửa hàng.</p><p style="font-size:32px;font-weight:700;letter-spacing:8px;color:#842f44">${code}</p><p>Mã có hiệu lực trong 10 phút và chỉ dùng một lần.</p><p style="color:#73675f">Nếu bạn không yêu cầu lấy lại mật khẩu, hãy bỏ qua email này.</p></div>`,
    });
  }
}
