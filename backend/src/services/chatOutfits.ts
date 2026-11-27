import Outfit from "../models/outfitModel.js";
import OutfitDetail from "../models/outfitDetailModel.js";
import { productAudiences } from "./catalogAudience.js";
import { catalogText, type Criteria } from "./chatIntent.js";
import { catalogMatch, loadCatalog, meetsFilters, namedProducts, productCard, type CatalogItem, type ProductCard } from "./chatCatalog.js";

export type OutfitCard = {
  kind: "outfit"; name: string; reason: string; total: number; products: ProductCard[];
  href?: string; image?: string; replaced?: string;
  maxPrice?: number; exclusive?: true;
};

const typePattern = /\b(ao|quan|chan vay|vay|dam|giay|tui|phu kien)\b/;
const group = (item: CatalogItem) => catalogText(`${item.name} ${item.category ?? ""}`).match(typePattern)?.[0];
const priceOf = (item: ProductCard) => item.variants[0]?.price ?? 0;

function compatibleAudiences(first: CatalogItem, second: CatalogItem) {
  const a = productAudiences(first.gender);
  const b = productAudiences(second.gender);
  if (a.includes("em-be") || b.includes("em-be")) return a.includes("em-be") && b.includes("em-be");
  return (!a.length && !b.length) || a.some((audience) => b.includes(audience));
}

export async function suggestOutfits(filters: Criteria, productId?: string) {
  const query = filters.query;
  const [outfits, inventory] = await Promise.all([
    Outfit.find({ is_active: true }).sort({ created_at: -1 }).limit(40).lean().maxTimeMS(4000),
    loadCatalog(),
  ]);
  const byId = new Map(inventory.map((item) => [item.id, item]));
  const required = productId ? byId.get(productId) : undefined;
  if (productId && !required) return { unavailable: true, cards: [], omitted: [] };
  const matchesAnchor = (item: CatalogItem) => query
    ? catalogMatch(query, `${item.name} ${item.category ?? ""} ${item.description}`)
    : required ? item.id === required.id : true;
  const matchesBudget = (price: number) => filters.maxPrice === undefined ||
    (filters.exclusive ? price < filters.maxPrice : price <= filters.maxPrice);
  function piece(item: CatalogItem, isAnchor: boolean) {
    const choices = item.variants.filter((choice) => choice.available && (!isAnchor || meetsFilters(choice, filters)));
    return choices.length ? productCard(item, choices) : undefined;
  }

  const details = await OutfitDetail.find({ outfit_id: { $in: outfits.map((outfit) => outfit._id) } })
    .select("outfit_id product_id").sort({ display_order: 1 }).lean().maxTimeMS(4000);
  const grouped = new Map<string, string[]>();
  for (const row of details) {
    const key = String(row.outfit_id);
    const list = grouped.get(key) ?? [];
    list.push(String(row.product_id));
    grouped.set(key, list);
  }
  const ranks = (outfit: (typeof outfits)[number]) => Number(Boolean(filters.occasion &&
    catalogMatch(filters.occasion, `${outfit.occasion ?? ""} ${outfit.style ?? ""} ${outfit.title}`)));
  const cards: OutfitCard[] = [];
  const omitted: string[] = [];
  for (const outfit of outfits.sort((a, b) => ranks(b) - ranks(a))) {
    const ids = grouped.get(String(outfit._id)) ?? [];
    if (ids.length < 2 || ids.length > 8 || (required && !ids.includes(required.id))) continue;
    const rows = ids.map((id) => byId.get(id));
    if (query && !rows.some((item) => item && matchesAnchor(item))) continue;
    const anchor = required ?? rows.find((item) => item && matchesAnchor(item));
    const products: ProductCard[] = [];
    const used = new Set(ids);
    const replaced: string[] = [];
    for (const item of rows) {
      const line = item && piece(item, item.id === anchor?.id);
      if (line) { products.push(line); continue; }
      const replacement = item && item.id !== required?.id && group(item)
        ? inventory.flatMap((candidate) => {
            if (used.has(candidate.id) || group(candidate) !== group(item) || !compatibleAudiences(item, candidate) ||
              (item.id === anchor?.id && !matchesAnchor(candidate))) return [];
            const line = piece(candidate, item.id === anchor?.id);
            return line ? [line] : [];
          }).sort((a, b) => priceOf(a) - priceOf(b))[0]
        : undefined;
      if (!replacement) {
        omitted.push(item ? `${outfit.title} — ${item.name} không còn biến thể phù hợp` : `${outfit.title} — có món không còn bán`);
        break;
      }
      used.add(replacement.id);
      replaced.push(`${item!.name} → ${replacement.name}`);
      products.push(replacement);
    }
    if (products.length !== rows.length) continue;
    const total = products.reduce((sum, product) => sum + priceOf(product), 0);
    if (!matchesBudget(total)) continue;
    cards.push({
      kind: "outfit", name: outfit.title, total, products,
      reason: [outfit.occasion, outfit.style].filter(Boolean).join(" · ") ||
        "Các món được shop chọn chung trong bộ phối này.",
      ...(replaced.length ? { replaced: replaced.join("; ") } : { href: `/outfit?bo-phoi=${outfit._id}#shop-the-look`, image: outfit.image }),
    });
    if (cards.length === 2) break;
  }
  if (cards.length) return { cards, omitted };

  const anchors = required ? [required] : query ? [...namedProducts(inventory, query), ...inventory.filter(matchesAnchor)] : inventory;
  const pairs = new Set<string>();
  for (const item of anchors) {
    const kind = group(item);
    const first = piece(item, true);
    if (!kind || !first) continue;
    const allowed = kind === "ao" ? ["quan", "chan vay", "vay"] :
      ["quan", "chan vay", "vay"].includes(kind) ? ["ao"] : kind === "dam" ? ["giay", "tui", "phu kien"] : ["ao", "quan", "dam"];
    for (const candidate of inventory) {
      if (!allowed.includes(group(candidate) ?? "") || candidate.id === item.id || !compatibleAudiences(item, candidate)) continue;
      const second = piece(candidate, false);
      const total = priceOf(first) + (second ? priceOf(second) : 0);
      const key = [item.id, candidate.id].sort().join(":");
      if (!second || !matchesBudget(total) || pairs.has(key)) continue;
      pairs.add(key);
      cards.push({ kind: "outfit", name: `${item.name} + ${candidate.name}`, products: [first, second], total,
        reason: `Gợi ý ghép ${first.category?.toLowerCase() || item.name} với ${second.category?.toLowerCase() || candidate.name} để tạo một bộ phối.` });
      break;
    }
    if (cards.length === 2) break;
  }
  return { cards, omitted };
}
