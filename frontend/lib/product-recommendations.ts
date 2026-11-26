import type { Product } from "@/types/product";

function recommendationAudiences(product: Product) {
  const audiences = product.audiences ?? [];
  // Baby products also belong to the kids catalog, but are not interchangeable outfits.
  if (audiences.includes("em-be")) return ["em-be"];
  if (audiences.includes("tre-em")) return ["tre-em"];
  return audiences.filter((audience) => audience === "nam" || audience === "nu");
}

export function recommendOutfitProducts(product: Product, catalog: Product[], limit = 3) {
  const audiences = recommendationAudiences(product);
  if (!audiences.length) return [];
  const compatible = catalog.filter((item) =>
    item.id !== product.id && item.inStock === true &&
    recommendationAudiences(item).some((audience) => audiences.includes(audience)),
  );
  return [
    ...compatible.filter((item) => item.category !== product.category),
    ...compatible.filter((item) => item.category === product.category),
  ].slice(0, limit);
}
