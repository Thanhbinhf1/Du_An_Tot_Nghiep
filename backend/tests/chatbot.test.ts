import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import { Types } from "mongoose";
import { EventEmitter } from "node:events";
import type { Response } from "express";
import type { AuthRequest } from "../src/middlewares/authMiddleware.js";
import { handleChatMessage } from "../src/routes/chatRoutes.js";
import { CartController } from "../src/controllers/cartController.js";
import Cart from "../src/models/cartModel.js";
import Category from "../src/models/categoryModel.js";
import Product from "../src/models/productModel.js";
import Variant from "../src/models/productVariantModel.js";
import Image from "../src/models/productImageModel.js";
import Outfit from "../src/models/outfitModel.js";
import OutfitDetail from "../src/models/outfitDetailModel.js";
import Coupon from "../src/models/couponModel.js";
import Setting from "../src/models/settingModel.js";
import SizeRecommendation, { ProductSizeChart } from "../src/models/sizeRecommendationModel.js";
import Order from "../src/models/orderModel.js";
import { interpretWithAi } from "../src/services/chatAi.js";
import { parseTurn, readChatRequest, readContext, splitQuestions } from "../src/services/chatIntent.js";
import { adviseSize, compareProducts, makeOutfit, preparePurchase, searchProducts } from "../src/services/chatShopping.js";
import { couponAdvice, readOrders, shippingAdvice } from "../src/services/chatAccount.js";

afterEach(() => mock.restoreAll());

function query<T>(value: T) {
  const chain = {
    select: () => chain, sort: () => chain, limit: () => chain, session: () => chain, option: () => chain,
    lean: () => chain, maxTimeMS: () => chain,
    then: (resolve: (result: T) => unknown) => Promise.resolve(value).then(resolve),
    cursor: () => ({
      async *[Symbol.asyncIterator]() { if (Array.isArray(value)) yield* value; },
      close: async () => undefined,
    }),
  };
  return chain;
}

const id = () => new Types.ObjectId();
const categoryId = id();
const shirtId = id();
const bottomId = id();
const oldBottomId = id();
const outfitId = id();
const blackId = id();
const whiteId = id();

function seedCatalog() {
  const items = [
    { _id: shirtId, name: "Áo Thun Dệt", category_id: categoryId, description: "Áo thun đi học.", slug: "ao-thun-det", material: "Cotton" },
    { _id: bottomId, name: "Quần Jean Xanh", category_id: null, description: "", slug: "quan-jean-xanh" },
    { _id: oldBottomId, name: "Quần Jean Cũ", category_id: null, description: "", slug: "quan-jean-cu" },
  ];
  const variants = [
    { _id: blackId, product_id: shirtId, color: "Đen", size: "L", price: 290000, stock_quantity: 0 },
    { _id: whiteId, product_id: shirtId, color: "Trắng", size: "L", price: 275000, sale_price: 269000, stock_quantity: 5 },
    { _id: id(), product_id: shirtId, color: "Đỏ", size: "L", price: 300000, stock_quantity: 5 },
    { _id: id(), product_id: shirtId, color: "Đen", size: "M", price: 240000, stock_quantity: 5 },
    { _id: id(), product_id: bottomId, color: "Xanh", size: "M", price: 220000, stock_quantity: 5 },
    { _id: id(), product_id: oldBottomId, color: "Xanh", size: "M", price: 250000, stock_quantity: 0 },
  ];
  const sizeChart = { product_id: shirtId, size: "M", fit_type: "Regular", min_height: 163, max_height: 174, min_weight: 53, max_weight: 62 };
  mock.method(Category, "find", () => query([{ _id: categoryId, name: "Áo thun", status: true, parent_id: null }]));
  mock.method(Product, "findOne", (condition: { _id: Types.ObjectId }) => query(items.find((item) => item._id.equals(condition._id))));
  mock.method(Product, "find", (condition: { _id?: { $in?: string[] }; category_id?: Types.ObjectId }) =>
    query(items.filter((item) => (!condition._id?.$in || condition._id.$in.map(String).includes(String(item._id))) &&
      (!condition.category_id || item.category_id?.equals(condition.category_id)))));
  mock.method(Variant, "find", (condition: { product_id: { $in: Types.ObjectId[] }; stock_quantity?: unknown }) =>
    query(variants.filter((row) => condition.product_id.$in.map(String).includes(String(row.product_id)) &&
      (!condition.stock_quantity || row.stock_quantity > 0))));
  mock.method(Image, "aggregate", () => query([{ _id: shirtId, image: "/uploads/chat-shirt.png" }]));
  mock.method(ProductSizeChart, "find", (condition: { product_id: Types.ObjectId | { $in: Types.ObjectId[] } }) =>
    query((condition.product_id instanceof Types.ObjectId ? [condition.product_id] : condition.product_id.$in).some((item) => item.equals(shirtId)) ? [sizeChart] : []));
  mock.method(SizeRecommendation, "find", () => query([]));
  mock.method(Outfit, "find", () => query([{ _id: outfitId, title: "Bộ phối đi học", occasion: "Đi học", image: "/uploads/outfit.png" }]));
  mock.method(OutfitDetail, "find", () => query([
    { outfit_id: outfitId, product_id: shirtId }, { outfit_id: outfitId, product_id: oldBottomId },
  ]));
}

test("chat validates payload and keeps search constraints through a Vietnamese colour change", async () => {
  seedCatalog();
  assert.throws(() => readChatRequest({ message: "g".repeat(501) }), /500/);
  assert.throws(() => readChatRequest({ message: "tìm áo", productId: { $ne: null } }), /ID/);
  const first = parseTurn("tim ao thun den size L duoi 300k", {});
  assert.deepEqual(first.filters, { query: "ao thun", color: "den", size: "L", maxPrice: 300000, exclusive: true });
  const soldOut = await searchProducts(first.filters);
  assert.match(soldOut.text, /hết hàng/);
  assert.deepEqual(soldOut.cards?.[0]?.kind === "product" && soldOut.cards[0].variants.map(({ id, available }) => ({ id, available })), [{ id: String(blackId), available: false }]);
  const next = parseTurn("có mẫu trắng không?", readContext(first));
  assert.deepEqual(next.filters, { query: "ao thun", color: "trang", size: "l", maxPrice: 300000, exclusive: true });
  const search = await searchProducts(next.filters);
  assert.equal(search.cards?.[0]?.kind === "product" && search.cards[0].variants[0]?.price, 269000);
  const cap = await searchProducts(parseTurn("Áo thun đỏ size L dưới 300k", {}).filters);
  assert.ok(cap.cards?.length);
  assert.equal(cap.cards.some((card) => card.kind === "product" && card.variants.some((choice) => choice.color === "Đỏ")), false);
  assert.equal(splitQuestions("Tìm áo thun size L và phí giao hàng đơn 200k?").length, 2);
});

test("Smart Size validates the viewed product and keeps the recommended size when its selected colour is unavailable", async () => {
  seedCatalog();
  const first = parseTurn("1m68, 57kg", {}, String(shirtId), "Trắng");
  assert.equal(first.height, 168);
  assert.equal(first.weight, 57);
  assert.equal(first.filters?.color, "trang");
  const white = await adviseSize(first);
  assert.match(white.text, /size M/);
  assert.match(white.text, /Màu trắng size M hiện chưa có biến thể/);
  const black = await adviseSize(parseTurn("Em cao 1m68, nặng 57kg, áo này mặc size gì?", {}, String(shirtId), "Đen"));
  assert.match(black.text, /Màu đen size M hiện còn hàng/);
  const missing = await adviseSize(parseTurn("1m68", {}, String(shirtId)));
  assert.match(missing.text, /cân nặng/);
});

test("outfit replaces an unavailable piece under budget and product comparison shows missing material", async () => {
  seedCatalog();
  const outfit = await makeOutfit(parseTurn("phối đồ đi học với quần jean, tổng dưới 700k", {}));
  assert.equal(outfit.cards?.[0]?.kind, "outfit");
  if (outfit.cards?.[0]?.kind !== "outfit") assert.fail("Expected an outfit");
  assert.equal(outfit.cards[0].total, 460000);
  assert.match(outfit.cards[0].replaced ?? "", /Quần Jean Cũ → Quần Jean Xanh/);
  assert.equal(outfit.cards[0].maxPrice, 700000);
  const comparison = await compareProducts(parseTurn("So sánh áo thun dệt và quần jean xanh", {}));
  assert.equal(comparison.cards?.length, 2);
  assert.match(comparison.text, /Cotton/);
  assert.match(comparison.text, /chưa có thông tin chất liệu/);
});

test("coupon and shipping use the pricing service and surface the reason and real fee", async () => {
  const base = { _id: id(), status: true, discount_type: "percent", discount_value: 20,
    used_count: 0, usage_limit: 10, min_order_value: 500000, max_discount: 90000, start_date: new Date(0) };
  mock.method(Coupon, "findOne", (filter: { code: string; min_order_value?: { $lte: number } }) => {
    const expired = filter.code === "EXPIRED";
    if (filter.min_order_value && (expired || filter.min_order_value.$lte < base.min_order_value)) return query(null);
    return query({ ...base, end_date: expired ? new Date(1) : new Date(Date.now() + 3_600_000) });
  });
  mock.method(Coupon, "updateOne", () => assert.fail("Chat reads must not reserve a coupon"));
  mock.method(Setting, "findOne", () => query({ value: { standard_shipping_fee: 35000 } }));
  const expired = await couponAdvice(parseTurn("Mã giảm giá EXPIRED cho đơn 600k", {}));
  assert.match(expired.text, /hết hạn/);
  const belowTurn = parseTurn("Mã giảm giá TEST cho đơn 200k", {});
  assert.match((await couponAdvice(belowTurn)).text, /500\.000/);
  assert.match((await couponAdvice(parseTurn("Đơn 600k", readContext(belowTurn)))).text, /90\.000/);
  assert.match((await shippingAdvice(parseTurn("Phí giao hàng cho đơn 200k", {}))).text, /35\.000/);
  assert.match((await shippingAdvice(parseTurn("Phí giao hàng cho đơn 600k", {}))).text, /0 ₫/);
});

test("order reads are bound to the signed-in user and preserve pending payment while shipping", async () => {
  const user = id();
  const order = id();
  const other = id();
  const find = mock.method(Order, "find", (condition: { user_id: Types.ObjectId; _id?: string }) => {
    assert.equal(String(condition.user_id), String(user));
    return query(condition._id === String(other) ? [] : [{
      _id: order, order_status: "shipping", payment_status: "pending", payment_method: "BankTransfer",
      final_amount: 100000, updated_at: new Date(), shipping_address: "QA private",
    }]);
  });
  assert.match((await readOrders(parseTurn("Đơn của tôi tới đâu?", {}))).links?.[0]?.href ?? "", /dang-nhap/);
  assert.equal(find.mock.callCount(), 0);
  const blocked = await readOrders(parseTurn(`Tra đơn #${other}`, {}), user);
  assert.match(blocked.text, /không thể mở đơn này/);
  const result = await readOrders(parseTurn(`Tra đơn #${order}`, {}), user);
  assert.deepEqual(result.cards?.[0]?.actions, { cancel: false, pay: false, returnRequest: false });
  assert.equal(result.cards?.[0]?.status, "shipping");
  assert.equal(result.cards?.[0]?.paymentStatus, "pending");
  assert.match(result.text, /Đơn đang chờ xác nhận thanh toán/);
  assert.doesNotMatch(JSON.stringify(result), /QA private/);
});

test("greetings answer naturally, without a contact link or replacing the shopping context", async () => {
  const context = readContext({ intent: "search", filters: { query: "quan jean", maxPrice: 500000 }, resultProductIds: [String(bottomId)] });
  for (const message of ["xin chào", "chao shop!", "Hello", "cảm ơn bạn"]) {
    let result: { data: { text: string; links: unknown[]; suggestions: string[]; context: unknown } } | undefined;
    const res = Object.assign(new EventEmitter(), { json: (value: typeof result) => { result = value; } });
    await handleChatMessage({ body: { message, context } } as AuthRequest, res as unknown as Response, (error) => { throw error; });
    assert.match(result?.data.text ?? "", /Chào bạn|Không có gì/);
    assert.deepEqual(result?.data.links, []);
    if (message === "xin chào") assert.deepEqual(result?.data.suggestions, ["Tìm quần jean đen size L dưới 500k"]);
    assert.deepEqual(result?.data.context, context);
  }
  assert.equal(parseTurn("Xin chào, tìm quần jean", {}).intent, "search");
});

test("filter changes and ordinal references keep the correct shopping context", async () => {
  seedCatalog();
  const first = readContext({ ...parseTurn("Tìm quần jean đen size l dưới 500k", {}), resultProductIds: [String(shirtId), String(bottomId)] });
  const blue = readContext(parseTurn("Có màu xanh không?", first));
  assert.equal(blue.filters?.maxPrice, 500000);
  assert.deepEqual(parseTurn("Bỏ giới hạn giá", blue).filters, { query: "quan jean", color: "xanh", size: "l" });
  assert.equal(parseTurn("Tư vấn size mẫu thứ hai", first, String(shirtId)).productId, String(bottomId));
  assert.equal(parseTurn("Tư vấn size áo này", first, String(shirtId)).productId, String(shirtId));
  assert.equal(parseTurn("Tra đơn của tôi", first).filters, undefined);

  const previous = readContext({ intent: "search", resultProductIds: [String(bottomId)] });
  const purchase = parseTurn("Thêm quần đó vào giỏ", previous);
  assert.equal(purchase.addToCart, true);
  assert.equal(purchase.filters?.color, undefined);
  const reply = await preparePurchase(purchase, previous);
  assert.equal(reply.productId, String(bottomId));
  assert.deepEqual(reply.cards?.[0]?.kind === "product" && reply.cards[0].purchase, {});
  assert.equal(parseTurn("2 chiếc", readContext({ intent: "cart", purchasePending: true, productId: reply.productId })).quantity, 2);
});

test("cart does not write when the confirmed price or stock changed", async () => {
  mock.method(Variant, "findById", async () => ({ status: true, product_id: shirtId, price: 275000, sale_price: 269000, stock_quantity: 3 }));
  mock.method(Product, "exists", async () => ({ _id: shirtId }));
  const write = mock.method(Cart, "findOneAndUpdate", () => assert.fail("A stale quote cannot write the cart"));
  for (const [price, stock, expected] of [[275000, 3, /Giá .*đã thay đổi/], [269000, 5, /Tồn kho .*đã thay đổi/]] as const) {
    let failure: unknown;
    await CartController.addItem({
      user: { _id: id() }, body: { quantity: 1, product_variant_id: String(whiteId), expected_unit_price: price, expected_stock: stock },
    } as AuthRequest, {} as Response, (error: unknown) => { failure = error; });
    assert.ok(failure instanceof Error && "statusCode" in failure && failure.statusCode === 409);
    assert.match(failure.message, expected);
  }
  assert.equal(write.mock.callCount(), 0);
});

test("provider timeout and missing configuration preserve local search, and private intents stay server-side", async () => {
  const key = process.env.CHAT_OPENAI_API_KEY;
  const model = process.env.CHAT_OPENAI_MODEL;
  try {
    delete process.env.CHAT_OPENAI_API_KEY;
    delete process.env.CHAT_OPENAI_MODEL;
    const text = "Tìm áo thun";
    const local = parseTurn(text, {});
    assert.deepEqual(await interpretWithAi(text, local), { turn: local, ai: "unconfigured" });
    process.env.CHAT_OPENAI_API_KEY = "test-key-only";
    process.env.CHAT_OPENAI_MODEL = "test-model-only";
    const fetch = mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
      assert.equal(url, "https://api.openai.com/v1/responses");
      assert.ok(init.signal instanceof AbortSignal);
      assert.equal(JSON.parse(String(init.body)).store, false);
      throw new DOMException("test timeout", "TimeoutError");
    });
    const size = "Em cao 1m68, nặng 57kg";
    await interpretWithAi(size, parseTurn(size, {}));
    assert.equal(fetch.mock.callCount(), 0);
    assert.deepEqual(await interpretWithAi(text, local), { turn: local, ai: "unavailable" });
    assert.equal(fetch.mock.callCount(), 1);
  } finally {
    if (key === undefined) delete process.env.CHAT_OPENAI_API_KEY; else process.env.CHAT_OPENAI_API_KEY = key;
    if (model === undefined) delete process.env.CHAT_OPENAI_MODEL; else process.env.CHAT_OPENAI_MODEL = model;
  }
});
