export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api";

export async function readApiResponse<T>(response: Response): Promise<T> {
  const result = (await response.json()) as {
    status?: string;
    message?: string;
    data?: T;
  };
  if (!response.ok || result.status === "error" || result.data === undefined) {
    throw new Error(result.message ?? "Không thể hoàn tất yêu cầu đến máy chủ.");
  }
  return result.data;
}

export function authenticatedHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export type ApiCategory = {
  _id: string;
  name: string;
  slug: string;
  description?: string;
};

export type ApiProduct = {
  _id: string;
  name: string;
  code: string;
  color: string;
  sizes: string[];
  price: number;
  image: string;
  rating: number;
  category_id: string | Pick<ApiCategory, "_id" | "name" | "slug">;
};

export function mapApiProduct(product: ApiProduct) {
  const category = typeof product.category_id === "string"
    ? ""
    : product.category_id.name;
  return {
    id: product._id,
    name: product.name,
    code: product.code,
    color: product.color,
    sizes: product.sizes,
    price: product.price,
    image: product.image.startsWith("/uploads/")
      ? `${API_BASE_URL.replace(/\/api\/?$/, "")}${product.image}`
      : product.image,
    category,
    rating: product.rating,
  };
}
