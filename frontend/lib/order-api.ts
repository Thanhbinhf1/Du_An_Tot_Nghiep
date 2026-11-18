import { API_BASE_URL, authenticatedHeaders, readApiResponse } from "./api";

export type PaymentMethod = "COD" | "BankTransfer" | "VNPay" | "MoMo";
export type ShippingMethod = "Standard" | "Express";

type CheckoutOptions = {
  shipping_method?: ShippingMethod;
  coupon_code?: string;
};

export type CheckoutQuote = {
  total_product_amount: number;
  discount_amount: number;
  shipping_fee: number;
  final_amount: number;
  standard_shipping_fee: number;
  express_shipping_fee: number;
  free_shipping_threshold: number;
};

export interface CreateOrderRequest extends CheckoutOptions {
  address_id: string;
  payment_method: PaymentMethod;
  note?: string;
  expected_total?: number;
}

export async function getCheckoutQuote(options: CheckoutOptions, token: string, signal?: AbortSignal) {
  const response = await fetch(`${API_BASE_URL}/orders/quote`, {
    method: "POST",
    headers: { ...authenticatedHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(options),
    signal,
  });
  return readApiResponse<CheckoutQuote>(response);
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
  total_product_amount?: number;
  discount_amount?: number;
  shipping_fee?: number;
  shipping_method?: ShippingMethod;
  payment_method: PaymentMethod;
  payment_status: OrderPaymentStatus;
  order_status: OrderStatus;
  receiver_name: string;
  receiver_phone: string;
  shipping_address: string;
  note?: string;
  created_at?: string;
  createdAt?: string;
}

export const orderStatusText: Record<OrderStatus, string> = {
  pending: "Chờ xác nhận",
  processing: "Đang chuẩn bị",
  shipping: "Đang giao",
  completed: "Hoàn thành",
  cancelled: "Đã hủy",
};

export const paymentStatusText: Record<OrderPaymentStatus, string> = {
  pending: "Chờ thanh toán",
  success: "Đã thanh toán",
  failed: "Thanh toán thất bại",
  refunded: "Đã hoàn tiền",
};

export const paymentMethodText: Record<PaymentMethod, string> = {
  COD: "Thanh toán khi nhận hàng (COD)",
  BankTransfer: "Chuyển khoản ngân hàng",
  VNPay: "VNPay",
  MoMo: "Ví MoMo",
};

export interface BackendOrderItem {
  _id: string;
  product_variant_id?: string;
  review_product_id?: string | null;
  product_name: string;
  sku: string;
  size: string;
  color: string;
  quantity: number;
  price_at_buy: number;
}

export interface BackendOrderDetail extends BackendOrder {
  items: BackendOrderItem[];
}

export async function getBackendOrder(id: string, token: string) {
  const response = await fetch(`${API_BASE_URL}/orders/${encodeURIComponent(id)}`, {
    headers: authenticatedHeaders(token),
    cache: "no-store",
  });
  return readApiResponse<BackendOrderDetail>(response);
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

export async function cancelBackendOrder(
  id: string,
  token: string,
): Promise<void> {
  if (!token) {
    throw new Error("Vui lòng đăng nhập.");
  }

  const response = await fetch(`${API_BASE_URL}/orders/${encodeURIComponent(id)}/cancel`, {
    method: "PATCH",
    headers: authenticatedHeaders(token),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || "Không thể hủy đơn hàng.");
  }
}
