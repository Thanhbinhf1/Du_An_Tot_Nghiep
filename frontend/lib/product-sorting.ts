import type { Product } from "@/types/product";

export const featuredRatingSort = {
  value: "bestseller", // Preserve the existing sort value for callers.
  label: "Nổi bật & đánh giá",
  compare: (first: Product, second: Product) =>
    Number(Boolean(second.isFeatured)) - Number(Boolean(first.isFeatured)) || second.rating - first.rating,
};
