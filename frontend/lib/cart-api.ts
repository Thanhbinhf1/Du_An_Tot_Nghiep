import { API_BASE_URL, authenticatedHeaders, readApiResponse } from "./api";

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
): Promise<CartItem> {
  if (!token) {
    throw new Error("Vui lòng đăng nhập trước khi thêm vào giỏ hàng.");
  }

  if (!productVariantId || !Number.isSafeInteger(quantity) || quantity < 1) {
    throw new Error("Dữ liệu sản phẩm không hợp lệ.");
  }

  const response = await fetch(`${API_BASE_URL}/cart/items`, {
    method: "POST",
    headers: {
      ...authenticatedHeaders(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      product_variant_id: productVariantId,
      quantity,
    }),
  });

  return readApiResponse<CartItem>(response);
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
): Promise<ProductVariant[]> {
  const response = await fetch(
    `${API_BASE_URL}/products/${encodeURIComponent(productId)}/variants`,
    { cache: "no-store" },
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
export async function getBackendCart(token: string): Promise<BackendCart> {
  const response = await fetch(`${API_BASE_URL}/cart`, {
    headers: authenticatedHeaders(token),
    cache: "no-store",
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
}
