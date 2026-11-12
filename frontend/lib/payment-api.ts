import { API_BASE_URL, authenticatedHeaders, readApiResponse } from "./api";

export type PaymentStatus = "pending" | "success" | "failed" | "refunded";

export interface PaymentRecord {
  _id: string;
  order_id: string;
  payment_method: "VNPay" | "MoMo" | "BankTransfer";
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

export async function createMoMoCheckout(
  orderId: string,
  token: string,
): Promise<CreateOnlinePaymentResponse> {
  if (!token) {
    throw new Error("Vui lòng đăng nhập để thanh toán.");
  }

  if (!/^[a-fA-F0-9]{24}$/.test(orderId)) {
    throw new Error("Mã đơn hàng không hợp lệ.");
  }

  const response = await fetch(`${API_BASE_URL}/payments/momo/create`, {
    method: "POST",
    headers: {
      ...authenticatedHeaders(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      order_id: orderId,
    }),
  });

  return readApiResponse<CreateOnlinePaymentResponse>(response);
}

export interface CreateVNPayResponse {
  payment_id: string;
  order_id: string;
  payment_url: string;
  expires_at: string;
  reused: boolean;
}

export async function createVNPayCheckout(
  orderId: string,
  token: string,
): Promise<CreateVNPayResponse> {
  if (!token) {
    throw new Error("Vui lòng đăng nhập để thanh toán.");
  }

  if (!/^[a-fA-F0-9]{24}$/.test(orderId)) {
    throw new Error("Mã đơn hàng không hợp lệ.");
  }

  const response = await fetch(`${API_BASE_URL}/payments/vnpay/create`, {
    method: "POST",
    headers: {
      ...authenticatedHeaders(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      order_id: orderId,
    }),
  });

  return readApiResponse<CreateVNPayResponse>(response);
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
