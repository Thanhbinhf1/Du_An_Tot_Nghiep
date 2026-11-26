import test from "node:test";
import assert from "node:assert/strict";
import type { Product } from "../types/product";
import { recommendOutfitProducts } from "../lib/product-recommendations";
import { featuredRatingSort } from "../lib/product-sorting";

function product(id: string, audiences: string[], changes: Partial<Product> = {}): Product {
  return { id, name: id, code: id, color: "Đen", sizes: ["M"], price: 100000, image: "", category: "Áo", rating: 4, inStock: true, audiences, ...changes };
}

test("adult outfit recommendations exclude baby, kids, other audiences and unavailable products", () => {
  const current = product("shirt", ["nam"]);
  const catalog = [current, product("cradle", ["em-be", "tre-em"]), product("kids", ["tre-em"]),
    product("women", ["nu"]), product("sold-out", ["nam"], { inStock: false }),
    product("shirt-2", ["nam"]), product("trousers", ["nam", "nu"], { category: "Quần" })];
  assert.deepEqual(recommendOutfitProducts(current, catalog).map((item) => item.id), ["trousers", "shirt-2"]);
  assert.deepEqual(catalog.map((item) => item.id), ["shirt", "cradle", "kids", "women", "sold-out", "shirt-2", "trousers"]);
});

test("baby and kids outfits remain separate even when baby is also a kids catalog audience", () => {
  const baby = product("baby", ["em-be", "tre-em"]);
  const kids = product("kids", ["tre-em"]);
  const catalog = [baby, kids, product("baby-2", ["em-be", "tre-em"]), product("kids-2", ["tre-em"])];
  assert.deepEqual(recommendOutfitProducts(baby, catalog).map((item) => item.id), ["baby-2"]);
  assert.deepEqual(recommendOutfitProducts(kids, catalog).map((item) => item.id), ["kids-2"]);
});

test("missing audience or no compatible stock yields no unrelated fallback", () => {
  assert.deepEqual(recommendOutfitProducts(product("unknown", []), [product("adult", ["nam"])]), []);
  assert.deepEqual(recommendOutfitProducts(product("adult", ["nam"]), [product("baby", ["em-be"])]), []);
});

test("featured and rating sort describes and preserves its actual ranking", () => {
  const sorted = [product("rating", ["nam"], { rating: 5 }), product("featured-low", ["nam"], { isFeatured: true, rating: 3 }), product("featured-high", ["nam"], { isFeatured: true, rating: 4 })].sort(featuredRatingSort.compare);
  assert.deepEqual(sorted.map((item) => item.id), ["featured-high", "featured-low", "rating"]);
  assert.equal(featuredRatingSort.label, "Nổi bật & đánh giá");
});
