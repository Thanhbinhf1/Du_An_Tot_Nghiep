import Category from "../models/categoryModel.js";
import Product, { type IProduct } from "../models/productModel.js";
import Image from "../models/productImageModel.js";
import Variant from "../models/productVariantModel.js";
import { visibleCategoryIds } from "./categoryPolicy.js";
import { catalogText, colorKey, objectId, type Criteria } from "./chatIntent.js";

export type Choice = { id: string; size: string; color: string; price: number; available: boolean; stock: number };
export type ProductCard = {
  kind: "product"; id: string; name: string; href: string; category?: string;
  image?: string; material?: string; note?: string; variants: Choice[];
  purchase?: { quantity?: number };
};
const itemProjection = "name slug category_id product_code description material care_instructions gender";
const scopeProjection = "name slug status parent_id";
const words = (text: string) => [...new Set(catalogText(text).match(/[a-z0-9]+/g) ?? [])];
const abbreviations: Record<string, string> = { tshirt: "thun", denim: "jean" };

export function catalogMatch(needle: string, value: string) {
  const queryWords = words(needle).map((word) => abbreviations[word] ?? word);
  const valueWords = new Set(words(value).map((word) => abbreviations[word] ?? word));
  return queryWords.length > 0 && queryWords.every((word) => valueWords.has(word));
}

export async function findCategories(query: string) {
  const categories = await Category.find().select(scopeProjection).lean().maxTimeMS(4000);
  const visible = visibleCategoryIds(categories);
  return categories.filter((category) =>
    visible.has(String(category._id)) && catalogMatch(query, `${category.name} ${category.slug}`));
}

export async function loadCatalog({ queries = [], ids }: {
  queries?: string[]; ids?: string[];
} = {}) {
  const categories = await Category.find().select(scopeProjection).lean().maxTimeMS(4000);
  const visible = visibleCategoryIds(categories);
  const categoryNames = new Map(categories.map((category) => [String(category._id), category.name]));
  const filter: Record<string, unknown> = { status: true, publication_state: { $nin: ["draft", "hidden"] } };
  if (ids) filter._id = { $in: ids.filter(objectId) };
  const cursor = Product.find(filter).select(itemProjection).sort({ is_featured: -1, created_at: -1, _id: 1 })
    .maxTimeMS(4500).lean().cursor({ batchSize: 100 });
  const matches: Array<{
    _id: typeof Product.prototype._id; name: string; slug: string; category_id: IProduct["category_id"];
    product_code?: string; description: string; material?: string; care_instructions?: string; gender?: string;
  }> = [];
  try {
    for await (const item of cursor) {
      const categoryId = String(item.category_id);
      if (item.category_id && !visible.has(categoryId)) continue;
      const category = categoryNames.get(categoryId) ?? "";
      const text = [item.name, item.slug, item.product_code, category, item.gender, item.description].join(" ");
      if (queries.length && !queries.some((query) => catalogMatch(query, text))) continue;
      matches.push(item);
    }
  } finally {
    await cursor.close();
  }
  if (!matches.length) return [];
  const productIds = matches.map((item) => item._id);
  const [variants, images] = await Promise.all([
    Variant.find({ product_id: { $in: productIds }, status: true })
      .select("product_id color size price sale_price stock_quantity").lean().maxTimeMS(4500),
    Image.aggregate<{ _id: IProduct["_id"]; image: string }>([
      { $match: { product_id: { $in: productIds } } },
      { $sort: { is_primary: -1, display_order: 1, _id: 1 } },
      { $group: { _id: "$product_id", image: { $first: "$image_url" } } },
    ]).option({ maxTimeMS: 4500 }),
  ]);
  const pictures = new Map(images.map((item) => [String(item._id), item.image]));
  const variantsByProduct = new Map<string, Choice[]>();
  for (const item of variants) {
    const price = item.sale_price ?? item.price;
    if (!Number.isSafeInteger(price) || price < 0) continue;
    const id = String(item.product_id);
    const list = variantsByProduct.get(id) ?? [];
    list.push({ id: String(item._id), color: item.color, size: item.size, price, available: item.stock_quantity > 0, stock: item.stock_quantity });
    variantsByProduct.set(id, list);
  }
  return matches.map((item) => ({
    ...item,
    id: String(item._id),
    category: categoryNames.get(String(item.category_id)),
    image: pictures.get(String(item._id)),
    variants: (variantsByProduct.get(String(item._id)) ?? []).sort((a, b) => Number(b.available) - Number(a.available) || a.price - b.price || a.id.localeCompare(b.id)),
  }));
}

export type CatalogItem = Awaited<ReturnType<typeof loadCatalog>>[number];

export function meetsFilters(choice: Choice, filters: Criteria, checkColor = true) {
  return (!checkColor || !filters.color || colorKey(choice.color) === colorKey(filters.color) ||
    (filters.color === "xanh" && colorKey(choice.color).startsWith("xanh "))) &&
    (!filters.size || choice.size.trim().toUpperCase() === filters.size.toUpperCase()) &&
    (filters.maxPrice === undefined || (filters.exclusive ? choice.price < filters.maxPrice : choice.price <= filters.maxPrice));
}

export function productCard(item: CatalogItem, variants: Choice[], note?: string): ProductCard {
  return {
    kind: "product", id: item.id, name: item.name, href: `/product/${item.id}`,
    ...(item.category ? { category: item.category } : {}),
    ...(item.image ? { image: item.image } : {}),
    ...(item.material?.trim() ? { material: item.material.trim().slice(0, 200) } : {}),
    ...(note ? { note } : {}),
    variants,
  };
}

export function namedProducts(items: CatalogItem[], query: string) {
  const normalized = catalogText(query);
  const byName = items.filter((item) => [item.name, item.slug, item.product_code ?? ""].some((value) => catalogText(value) === normalized));
  if (byName.length) return byName;
  return items.filter((item) => catalogMatch(query, [item.name, item.slug, item.product_code].join(" ")));
}
