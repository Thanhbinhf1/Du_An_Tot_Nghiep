import { API_BASE_URL, authenticatedHeaders, readApiResponse } from "@/lib/api";
import type { OrderPaymentStatus, OrderStatus, PaymentMethod } from "@/lib/order-api";

export type Choice = { id: string; size: string; color: string; price: number; available: boolean; stock?: number };
export type ProductCard = {
  kind: "product"; id: string; name: string; href: string; category?: string;
  image?: string; material?: string; note?: string; variants: Choice[];
  purchase?: { quantity?: number };
};
export type OutfitCard = {
  kind: "outfit"; name: string; reason: string; total: number; products: ProductCard[];
  href?: string; image?: string; replaced?: string; maxPrice?: number; exclusive?: boolean;
};
export type OrderCard = {
  kind: "order"; id: string; code: string; href: string;
  status: OrderStatus; paymentStatus: OrderPaymentStatus; paymentMethod: PaymentMethod;
  updatedAt: string; trackingNumber?: string; estimatedDelivery?: string; refundAmount?: number;
  actions: { cancel: boolean; pay: boolean; returnRequest: boolean };
};

export type ChatResponse = {
  text: string; cards: (ProductCard | OutfitCard | OrderCard)[];
  links: { label: string; href: string }[]; suggestions: string[];
  context: Record<string, unknown>; aiStatus: "ready" | "unconfigured" | "unavailable";
};

export async function sendChat(
  message: string, context: Record<string, unknown>,
  page: { productId?: string; color?: string; orderId?: string }, token: string, signal: AbortSignal,
) {
  const response = await fetch(`${API_BASE_URL}/chat`, {
    method: "POST", cache: "no-store",
    headers: { "Content-Type": "application/json", ...(token ? authenticatedHeaders(token) : {}) },
    signal: AbortSignal.any([signal, AbortSignal.timeout(25_000)]),
    body: JSON.stringify({ message, context, ...page }),
  });
  return readApiResponse<ChatResponse>(response);
}
