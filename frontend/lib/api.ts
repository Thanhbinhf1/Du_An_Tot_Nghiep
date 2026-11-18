import type { ProductVariant } from "./cart-api";
import type { Product } from "@/types/product";

export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api").replace(/\/+$/, "");

export async function readApiEnvelope<T>(response: Response, allowMissingData = false) {
  const result = (await response.json().catch(() => ({}))) as {
    status?: string;
    message?: string;
    data?: T;
    pagination?: { totalPages: number; total?: number };
  };
  if (!response.ok || result.status === "error" || (!allowMissingData && result.data === undefined)) {
    throw new Error(result.message ?? "Không thể hoàn tất yêu cầu đến máy chủ.");
  }
  return { data: result.data as T, pagination: result.pagination };
}

export async function readApiResponse<T>(response: Response): Promise<T> {
  return (await readApiEnvelope<T>(response)).data;
}

export function authenticatedHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export type ApiCategory = {
  _id: string;
  name: string;
  slug: string;
  parent_id?: string | null;
  audiences?: string[];
  image?: string;
  thumbnail?: string;
  description?: string;
};

export type ApiBrand = {
  _id: string;
  name: string;
  slug: string;
  logo?: string;
};

export type ApiProduct = {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  is_featured?: boolean;
  audiences?: string[];
  image?: string;
  average_rating?: number;
  review_count?: number;
  created_at?: string;
  createdAt?: string;
  category_id: string | Pick<ApiCategory, "_id" | "name" | "slug"> | null;
  brand_id?: string | Pick<ApiBrand, "_id" | "name" | "slug"> | null;
  images: { image_url: string; is_primary: boolean }[];
  variants: ProductVariant[];
};

export function resolveProductImage(image: string) {
  return image.startsWith("/uploads/")
    ? `${API_BASE_URL.replace(/\/api\/?$/, "")}${image}`
    : image;
}

export function mapApiProduct(product: ApiProduct): Product & { variants: ProductVariant[] } {
  const variants = product.variants ?? [];
  const available = variants.filter((variant) => variant.stock_quantity > 0);
  const pricedVariants = available.length ? available : variants;
  const primaryImage = product.images?.find((entry) => entry.is_primary) ?? product.images?.[0];
  const allImages = (product.images ?? [])
    .map((entry) => resolveProductImage(entry.image_url))
    .filter(Boolean);
  const legacyImage = product.image ? resolveProductImage(product.image) : "";

  const effectivePrice = pricedVariants.length
    ? Math.min(...pricedVariants.map((variant) => variant.sale_price ?? variant.price))
    : 0;

  // Find original price corresponding to the best-priced variant or highest base price
  const matchingVariant =
    pricedVariants.find((variant) => (variant.sale_price ?? variant.price) === effectivePrice) ??
    pricedVariants[0];
  const originalPrice = matchingVariant ? matchingVariant.price : effectivePrice;
  const discountPercent =
    originalPrice > effectivePrice && originalPrice > 0
      ? Math.round(((originalPrice - effectivePrice) / originalPrice) * 100)
      : 0;

  const totalStock = variants.reduce((sum, variant) => sum + Math.max(0, variant.stock_quantity ?? 0), 0);
  const inStock = variants.length > 0 && totalStock > 0;

  return {
    id: product._id,
    name: product.name,
    code: product.slug,
    color: [...new Set(variants.map((variant) => variant.color).filter(Boolean))].join(", "),
    sizes: [...new Set(variants.map((variant) => variant.size).filter(Boolean))],
    price: effectivePrice,
    originalPrice: originalPrice > effectivePrice ? originalPrice : undefined,
    discountPercent: discountPercent > 0 ? discountPercent : undefined,
    image: primaryImage ? resolveProductImage(primaryImage.image_url) : legacyImage,
    images: allImages.length ? allImages : legacyImage ? [legacyImage] : [],
    category: typeof product.category_id === "object" ? product.category_id?.name ?? "" : "",
    categoryId: typeof product.category_id === "string" ? product.category_id : product.category_id?._id,
    categorySlug: typeof product.category_id === "object" ? product.category_id?.slug : undefined,
    audiences: product.audiences,
    brand: typeof product.brand_id === "object" ? product.brand_id?.name ?? "F.Style" : "F.Style",
    brandId: typeof product.brand_id === "string" ? product.brand_id : product.brand_id?._id,
    rating: product.average_rating ?? 0,
    reviewCount: product.review_count,
    isFeatured: Boolean(product.is_featured),
    inStock,
    totalStock,
    createdAt: product.created_at ?? product.createdAt,
    description: product.description,
    variants,
  };
}
