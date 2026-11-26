import type { PaymentMethod } from "./order-api";

import { createMoMoCheckout } from "./payment-api";

function validatePaymentUrl(value: string, expectedHost: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password
      || url.hostname.toLowerCase() !== expectedHost.toLowerCase()) {
    throw new Error("URL cổng thanh toán chưa được cấu hình hoặc không hợp lệ.");
  }
  return url.toString();
}

export async function createOnlineCheckout(
  orderId: string,
  paymentMethod: PaymentMethod,
  token: string,
): Promise<string> {
  if (!token || !/^[a-fA-F0-9]{24}$/.test(orderId)) {
    throw new Error("Vui lòng đăng nhập và kiểm tra mã đơn hàng.");
  }
  if (paymentMethod === "SePay") return "/payment/sepay?orderId=" + encodeURIComponent(orderId);
  if (paymentMethod === "PayOS" || paymentMethod === "VNPay") {
    throw new Error("Phương thức của đơn cũ đã ngừng thanh toán mới. Vui lòng liên hệ cửa hàng để được đối soát.");
  }
  if (paymentMethod === "COD" || paymentMethod === "BankTransfer") {
    throw new Error("Phương thức này không hỗ trợ thanh toán qua cổng online.");
  }
  const payment = await createMoMoCheckout(orderId, token);
  return validatePaymentUrl(payment.payment_url, process.env.NEXT_PUBLIC_MOMO_PAYMENT_HOST?.trim() || "test-payment.momo.vn");
}
