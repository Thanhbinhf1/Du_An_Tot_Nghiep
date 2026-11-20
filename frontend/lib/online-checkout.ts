import type { PaymentMethod } from "./order-api";

import { createMoMoCheckout, createVNPayCheckout } from "./payment-api";

const gateways = {
  VNPay: { create: createVNPayCheckout, host: process.env.NEXT_PUBLIC_VNPAY_PAYMENT_HOST?.trim() || "sandbox.vnpayment.vn" },
  MoMo: { create: createMoMoCheckout, host: process.env.NEXT_PUBLIC_MOMO_PAYMENT_HOST?.trim() || "test-payment.momo.vn" },
};

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
  if (paymentMethod === "SePay") {
    return `/payment/sepay?orderId=${encodeURIComponent(orderId)}`;
  }
  if (paymentMethod === "COD" || paymentMethod === "BankTransfer") {
    throw new Error("Phương thức này không hỗ trợ thanh toán qua cổng online.");
  }
  const gateway = gateways[paymentMethod];
  const payment = await gateway.create(orderId, token);
  return validatePaymentUrl(payment.payment_url, gateway.host);
}
