import { API_BASE_URL, authenticatedHeaders, readApiResponse } from "./api";

export type PaymentMethod = "COD" | "BankTransfer" | "VNPay" | "MoMo";

export interface CreateOrderRequest {
  address_id: string;
  payment_method: PaymentMethod;
  note?: string;
}

export interface CreateOrderResponse {
  order_id: string;
  total_amount: number;
  total_items: number;
  payment_method: PaymentMethod;
  payment_status: "pending";
  order_status: "pending";
}

export async function createBackendOrder(
  data: CreateOrderRequest,
  token: string,
): Promise<CreateOrderResponse> {
  if (!token) {
    throw new Error("Vui lòng đăng nhập để đặt hàng.");
  }

  const response = await fetch(`${API_BASE_URL}/orders`, {
    method: "POST",
    headers: {
      ...authenticatedHeaders(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  return readApiResponse<CreateOrderResponse>(response);
}

export type OrderPaymentStatus = "pending" | "success" | "failed" | "refunded";

export type OrderStatus =
  | "pending"
  | "processing"
  | "shipping"
  | "completed"
  | "cancelled";

export interface BackendOrder {
  _id: string;
  user_id: string;
  final_amount: number;
  payment_method: PaymentMethod;
  payment_status: OrderPaymentStatus;
  order_status: OrderStatus;
  receiver_name: string;
  receiver_phone: string;
  shipping_address: string;
  note?: string;
  created_at?: string;
}

export async function getMyBackendOrders(
  token: string,
): Promise<BackendOrder[]> {
  if (!token) {
    throw new Error("Vui lòng đăng nhập.");
  }

  const response = await fetch(`${API_BASE_URL}/orders/my`, {
    method: "GET",
    headers: authenticatedHeaders(token),
    cache: "no-store",
  });

  return readApiResponse<BackendOrder[]>(response);
}
