import type { PaymentMethod } from "./order-api";

import { createMoMoCheckout, createVNPayCheckout } from "./payment-api";

export async function createOnlineCheckout(
  orderId: string,
  paymentMethod: PaymentMethod,
  token: string,
): Promise<string> {
  if (paymentMethod === "MoMo") {
    const payment = await createMoMoCheckout(orderId, token);

    return payment.payment_url;
  }

  if (paymentMethod === "VNPay") {
    const payment = await createVNPayCheckout(orderId, token);

    return payment.payment_url;
  }

  throw new Error("Phương thức này không hỗ trợ thanh toán qua cổng online.");
}
