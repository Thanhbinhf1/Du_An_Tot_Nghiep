import type { Product } from "../types/product";

type SkuFilter = {
  sizes: string[];
  colors: string[];
  min: number;
  max: number;
  status: string;
};

export function matchesCatalogFilter(product: Product, { sizes, colors, min, max, status }: SkuFilter) {
  if (status === "featured" && !product.isFeatured) return false;
  const inRange = (price: number) => price >= min && price <= max;
  const scoped = sizes.length > 0 || colors.length > 0;
  const variants = product.variants?.filter((variant) => variant.status !== false &&
    (!sizes.length || sizes.includes(variant.size)) && (!colors.length || colors.includes(variant.color)));

  if (!variants?.length) {
    if (scoped || product.variants?.length) return false;
    const soldOut = product.variants?.length === 0 || product.inStock === false;
    if (status === "instock" && soldOut || status === "outofstock" && !soldOut) return false;
    return inRange(product.price) && (status !== "sale" || (product.originalPrice ?? product.price) > product.price);
  }

  const available = variants.filter((variant) => variant.stock_quantity > 0);
  if (status === "outofstock" && available.length) return false;
  if (!available.length && (status === "instock" || (scoped && status !== "outofstock"))) return false;
  return (available.length ? available : variants).some((variant) => {
    const price = variant.sale_price ?? variant.price;
    return inRange(price) && (status !== "sale" || price < variant.price);
  });
}
