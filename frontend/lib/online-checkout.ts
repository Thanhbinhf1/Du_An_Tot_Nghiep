import type { PaymentMethod } from "./order-api";

import { createMoMoCheckout, createVNPayCheckout } from "./payment-api";

function validatePaymentUrl(value: string, method: "VNPay" | "MoMo") {
  const url = new URL(value);
  const expectedHost = method === "VNPay"
    ? process.env.NEXT_PUBLIC_VNPAY_PAYMENT_HOST?.trim() || "sandbox.vnpayment.vn"
    : process.env.NEXT_PUBLIC_MOMO_PAYMENT_HOST?.trim() || "test-payment.momo.vn";
  if (url.protocol !== "https:" || url.username || url.password || !expectedHost
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
  if (paymentMethod === "MoMo") {
    const payment = await createMoMoCheckout(orderId, token);

    return validatePaymentUrl(payment.payment_url, paymentMethod);
  }

  if (paymentMethod === "VNPay") {
    const payment = await createVNPayCheckout(orderId, token);

    return validatePaymentUrl(payment.payment_url, paymentMethod);
  }

  throw new Error("Phương thức này không hỗ trợ thanh toán qua cổng online.");
}
