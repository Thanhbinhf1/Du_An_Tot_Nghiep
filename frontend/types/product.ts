import type { ProductVariant } from "@/lib/cart-api";

export type Product = {
  id: string;
  name: string;
  code: string;
  color: string;
  sizes: string[];
  price: number;
  originalPrice?: number;
  discountPercent?: number;
  image: string;
  images?: string[];
  category: string;
  categoryId?: string;
  categorySlug?: string;
  audiences?: string[];
  brand?: string;
  brandId?: string;
  rating: number;
  reviewCount?: number;
  isFeatured?: boolean;
  inStock?: boolean;
  totalStock?: number;
  createdAt?: string;
  variants?: ProductVariant[];
  description?: string;
};
