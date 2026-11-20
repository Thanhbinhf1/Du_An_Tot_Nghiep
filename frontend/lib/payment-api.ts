import { API_BASE_URL, authenticatedHeaders, readApiEnvelope, readApiResponse } from "./api";
import type { PaymentMethod } from "./order-api";

export async function getPaymentMethods(token: string) {
  const response = await fetch(`${API_BASE_URL}/payments/methods`, {
    headers: authenticatedHeaders(token),
    cache: "no-store",
  });
  return readApiResponse<PaymentMethod[]>(response);
}

export type PaymentStatus = "pending" | "success" | "failed" | "refunded";

export interface PaymentRecord {
  _id: string;
  order_id: string;
  payment_method: Exclude<PaymentMethod, "COD">;
  status: "pending" | "success" | "failed";
  paid_at?: string | null;
}

export interface OrderPaymentResponse {
  order_id: string;
  order_payment_status: PaymentStatus;
  payments: PaymentRecord[];
}

export async function getOrderPayments(
  orderId: string,
  token: string,
): Promise<OrderPaymentResponse> {
  const response = await fetch(
    `${API_BASE_URL}/payments/order/${encodeURIComponent(orderId)}`,
    {
      method: "GET",
      headers: authenticatedHeaders(token),
      cache: "no-store",
    },
  );

  return readApiResponse<OrderPaymentResponse>(response);
}

export interface CreateOnlinePaymentResponse {
  payment_id: string;
  order_id: string;
  payment_url: string;
  reused?: boolean;
}

async function createGatewayCheckout<T>(
  gateway: "momo" | "sepay" | "vnpay",
  orderId: string,
  token: string,
): Promise<T> {
  if (!token) {
    throw new Error("Vui lòng đăng nhập để thanh toán.");
  }

  if (!/^[a-fA-F0-9]{24}$/.test(orderId)) {
    throw new Error("Mã đơn hàng không hợp lệ.");
  }

  const response = await fetch(`${API_BASE_URL}/payments/${gateway}/create`, {
    method: "POST",
    headers: {
      ...authenticatedHeaders(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      order_id: orderId,
    }),
  });

  return readApiResponse<T>(response);
}

export function createMoMoCheckout(orderId: string, token: string) {
  return createGatewayCheckout<CreateOnlinePaymentResponse>("momo", orderId, token);
}

export interface SePayPaymentResponse {
  payment_id: string;
  order_id: string;
  amount: number;
  payment_method: "SePay";
  qr_url: string;
  transfer_content: string;
  bank: {
    bank_name: string;
    account_number: string;
    account_name: string;
  };
}

export function createSePayCheckout(orderId: string, token: string) {
  return createGatewayCheckout<SePayPaymentResponse>("sepay", orderId, token);
}

export async function reconcileSePayOrder(orderId: string, token: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/payments/sepay/orders/${encodeURIComponent(orderId)}/reconcile`, {
    method: "POST",
    headers: authenticatedHeaders(token),
  });
  await readApiEnvelope(response, true);
}

export interface CreateVNPayResponse {
  payment_id: string;
  order_id: string;
  payment_url: string;
  expires_at: string;
  reused: boolean;
}

export function createVNPayCheckout(orderId: string, token: string) {
  return createGatewayCheckout<CreateVNPayResponse>("vnpay", orderId, token);
}

export interface BankTransferPaymentResponse {
  payment_id: string;
  order_id: string;
  amount: number;
  payment_method: "BankTransfer";
  payment_status: "pending";
  bank: {
    bank_name: string;
    account_number: string;
    account_name: string;
  };
  transfer_content: string;
}

export async function createBankTransferCheckout(
  orderId: string,
  token: string,
): Promise<BankTransferPaymentResponse> {
  if (!token) {
    throw new Error("Vui lòng đăng nhập để thanh toán.");
  }

  if (!/^[a-fA-F0-9]{24}$/.test(orderId)) {
    throw new Error("Mã đơn hàng không hợp lệ.");
  }

  const response = await fetch(`${API_BASE_URL}/payments/bank-transfer`, {
    method: "POST",
    headers: {
      ...authenticatedHeaders(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      order_id: orderId,
    }),
  });

  return readApiResponse<BankTransferPaymentResponse>(response);
}
