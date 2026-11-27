import { API_BASE_URL, authenticatedHeaders, readApiResponse } from "./api";

export const cartChangedEvent = "bapd-cart-api-change";
export const cartToastEvent = "bapd-cart-toast";

export interface CartToastDetail {
  message: string;
  quantity?: number;
}

export function notifyCartChanged() {
  window.dispatchEvent(new Event(cartChangedEvent));
}

export function notifyCartToast(message = "Đã thêm sản phẩm vào giỏ hàng!", quantity?: number) {
  window.dispatchEvent(
    new CustomEvent<CartToastDetail>(cartToastEvent, {
      detail: { message, quantity },
    }),
  );
}

export interface CartItem {
  _id: string;
  cart_id: string;
  product_variant_id: string;
  outfit_id: string | null;
  quantity: number;
}

export async function addCartItem(
  productVariantId: string,
  quantity: number,
  token: string,
  outfit?: { id: string; productId: string },
  signal?: AbortSignal,
  quote?: { unitPrice: number; stock?: number },
): Promise<CartItem> {
  if (!token) {
    throw new Error("Vui lòng đăng nhập trước khi thêm vào giỏ hàng.");
  }

  if (!productVariantId || !Number.isSafeInteger(quantity) || quantity < 1) {
    throw new Error("Dữ liệu sản phẩm không hợp lệ.");
  }

  const response = await fetch(`${API_BASE_URL}/cart/items`, {
    method: "POST",
    signal,
    headers: {
      ...authenticatedHeaders(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      product_variant_id: productVariantId,
      quantity,
      ...(quote ? { expected_unit_price: quote.unitPrice, expected_stock: quote.stock } : {}),
      ...(outfit ? { source_outfit_id: outfit.id, product_id: outfit.productId } : {}),
    }),
  });

  const item = await readApiResponse<CartItem>(response);
  notifyCartChanged();
  if (!outfit) notifyCartToast(`Đã thêm ${quantity} sản phẩm vào giỏ hàng!`, quantity);
  return item;
}

export interface ProductVariant {
  _id: string;
  product_id: string;
  sku: string;
  size: string;
  color: string;
  price: number;
  sale_price?: number | null;
  stock_quantity: number;
  status: boolean;
}

export async function getProductVariants(
  productId: string,
  signal?: AbortSignal,
): Promise<ProductVariant[]> {
  const response = await fetch(
    `${API_BASE_URL}/products/${encodeURIComponent(productId)}/variants`,
    { cache: "no-store", signal },
  );

  return readApiResponse<ProductVariant[]>(response);
}

export interface BackendCartVariant {
  _id: string;
  product_id: string;
  sku: string;
  size: string;
  color: string;
  price: number;
  sale_price?: number | null;
  stock_quantity: number;
  status: boolean;
}

export interface BackendCartItem {
  _id: string;
  cart_id: string;
  product_variant_id: BackendCartVariant | null;
  quantity: number;
  price: number;
  subtotal: number;
}

export interface BackendCart {
  cart_id?: string;
  items: BackendCartItem[];
  total_quantity: number;
  total_price: number;
}

// GET /api/cart
export async function getBackendCart(token: string, signal?: AbortSignal): Promise<BackendCart> {
  const response = await fetch(`${API_BASE_URL}/cart`, {
    headers: authenticatedHeaders(token),
    cache: "no-store",
    signal,
  });

  return readApiResponse<BackendCart>(response);
}

// PATCH /api/cart/items/:itemId
export async function updateBackendCartItem(
  itemId: string,
  quantity: number,
  token: string,
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/cart/items/${encodeURIComponent(itemId)}`,
    {
      method: "PATCH",
      headers: {
        ...authenticatedHeaders(token),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ quantity }),
    },
  );

  await readApiResponse<BackendCartItem>(response);
  notifyCartChanged();
}

// DELETE /api/cart/items/:itemId
export async function deleteBackendCartItem(
  itemId: string,
  token: string,
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/cart/items/${encodeURIComponent(itemId)}`,
    {
      method: "DELETE",
      headers: authenticatedHeaders(token),
    },
  );

  if (!response.ok) {
    const result = await response.json().catch(() => null);

    throw new Error(result?.message ?? "Không thể xóa sản phẩm.");
  }
  notifyCartChanged();
}

// DELETE /api/cart
export async function clearBackendCart(token: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/cart`, {
    method: "DELETE",
    headers: authenticatedHeaders(token),
  });

  if (!response.ok) {
    const result = await response.json().catch(() => null);
    throw new Error(result?.message ?? "Không thể xóa giỏ hàng.");
  }
  notifyCartChanged();
}
