import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import { randomUUID } from "node:crypto";
import mongoose, { type ClientSession } from "mongoose";
import type { NextFunction, Response } from "express";
import type { AuthRequest } from "../src/middlewares/authMiddleware.js";
import { OrderController } from "../src/controllers/orderController.js";
import Address from "../src/models/addressModel.js";
import Cart from "../src/models/cartModel.js";
import CartDetail from "../src/models/cartDetailModel.js";
import Coupon from "../src/models/couponModel.js";
import Order from "../src/models/orderModel.js";
import History from "../src/models/orderStatusHistoryModel.js";
import Detail from "../src/models/orderDetailModel.js";
import Product from "../src/models/productModel.js";
import Variant from "../src/models/productVariantModel.js";
import Setting from "../src/models/settingModel.js";

afterEach(() => mock.restoreAll());
const uid = new mongoose.Types.ObjectId(), aid = new mongoose.Types.ObjectId(), cid = new mongoose.Types.ObjectId();
const pid = new mongoose.Types.ObjectId(), vid = new mongoose.Types.ObjectId(), couponId = new mongoose.Types.ObjectId();
const session = {} as ClientSession;

function setup(stockAvailable = true, provinceCode?: number) {
  const state = { stock: 5, version: 0, couponUses: 0, cartLines: 1, orders: 0, details: 0, history: 0 };
  let savedOrder: InstanceType<typeof Order> | undefined;
  mock.method(mongoose.connection, "transaction", async (callback: (session: ClientSession) => Promise<unknown>) => {
    const before = { ...state };
    try { return await callback(session); } catch (error) { Object.assign(state, before); throw error; }
  });
  const assertSession = (options: { session: ClientSession }) => assert.equal(options.session, session);
  const variant = { _id: vid, product_id: pid, sku: "AUDIT-M", size: "M", color: "Đen", status: true, price: 100000, sale_price: 90000, get stock_quantity() { return state.stock; } };
  const items = [{ _id: new mongoose.Types.ObjectId(), product_variant_id: vid, quantity: 2, outfit_id: null }];
  mock.method(Address, "findOne", (filter: { user_id: unknown }) => ({ session: async (value: ClientSession | null) => {
    assert.ok(value === session || value === null); assert.equal(filter.user_id, uid);
    return { _id: aid, receiver_name: "Test", receiver_phone: "0900000000", address_detail: "Test", ward: "Test", province: "Test", province_code: provinceCode, ward_code: 100 };
  } }));
  mock.method(Cart, "findOne", () => ({ session: async () => ({ _id: cid }), select: () => ({ lean: async () => ({ _id: cid }) }) }));
  mock.method(CartDetail, "find", () => ({ session: async () => state.cartLines ? items : [], populate: () => ({ lean: async () => items.map((item) => ({ ...item, product_variant_id: variant })) }) }));
  mock.method(Variant, "findById", () => ({ session: async () => variant }));
  mock.method(Product, "findById", () => ({ session: async () => ({ _id: pid, status: true, name: "Áo test" }) }));
  mock.method(Product, "find", () => ({ select: () => ({ lean: async () => [{ _id: pid }] }) }));
  mock.method(Setting, "findOne", () => ({ session: () => ({ lean: async () => ({ value: { standard_shipping_fee: 35000, express_shipping_province_code: 79, express_shipping_ward_codes: [100] } }) }) }));
  mock.method(Coupon, "findOne", () => ({ session: () => ({ lean: async () => ({ _id: couponId, discount_type: "percent", discount_value: 10 }) }) }));
  mock.method(Coupon, "updateOne", async (_filter: unknown, _update: unknown, options: { session: ClientSession }) => {
    assertSession(options); state.couponUses += 1; return { matchedCount: 1 };
  });
  mock.method(Variant, "findOneAndUpdate", async (filter: { stock_quantity: { $gte: number } }, update: { $inc: { stock_quantity: number; __v: number } }, options: { session: ClientSession }) => {
    assertSession(options); assert.equal(filter.stock_quantity.$gte, 2);
    if (!stockAvailable) return null;
    state.stock += update.$inc.stock_quantity; state.version += update.$inc.__v;
    return { ...variant, stock_quantity: state.stock };
  });
  mock.method(Order.prototype, "save", async function (this: InstanceType<typeof Order>, options: { session: ClientSession }) {
    assertSession(options); await this.validate();
    assert.equal(this.final_amount, 197000); assert.equal(this.shipping_fee, 35000); assert.equal(this.discount_amount, 18000);
    savedOrder = this;
    state.orders += 1; return this;
  });
  mock.method(Order, "findOne", (filter: { user_id: unknown; checkout_snapshot: string }) => ({
    session: async () => savedOrder?.get("checkout_snapshot") === filter.checkout_snapshot &&
      filter.user_id === uid ? savedOrder : null,
  }));
  mock.method(Detail, "insertMany", async (details: Array<{ quantity: number; price_at_buy: number; product_name: string }>, options: { session: ClientSession }) => {
    assertSession(options); assert.equal(details[0]?.quantity, 2); assert.equal(details[0]?.price_at_buy, 90000);
    assert.equal(details[0]?.product_name, "Áo test"); state.details += details.length; return details;
  });
  mock.method(CartDetail, "deleteMany", async (_filter: unknown, options: { session: ClientSession }) => {
    assertSession(options); state.cartLines = 0; return { deletedCount: 1 };
  });
  mock.method(History, "create", async ([entry]: Array<{ status: string }>, options: { session: ClientSession }) => {
    assertSession(options); assert.equal(entry?.status, "pending"); state.history += 1; return [];
  });
  return state;
}

async function call(handler: (req: AuthRequest, res: Response, next: NextFunction) => unknown, paymentMethod: string, expectedTotal = 197000, snapshot?: string, note?: string, shippingMethod = "Standard") {
  let error: unknown, status = 200, body: { data?: { order_id?: string; total_amount?: number; final_amount?: number; payment_method?: string; total_items?: number; cart_snapshot?: string; express_available?: boolean } } = {};
  const req = { user: { _id: uid }, body: { address_id: String(aid), payment_method: paymentMethod, coupon_code: "TEST10", expected_total: expectedTotal, expected_cart_snapshot: snapshot, note, shipping_method: shippingMethod } } as AuthRequest;
  const res = { status(value: number) { status = value; return this; }, json(value: typeof body) { body = value; return this; } } as unknown as Response;
  await handler(req, res, (value?: unknown) => { error = value; });
  return { error, status, body };
}

for (const method of ["COD", "SePay"]) test(`${method} checkout matches the quote and atomically writes order, stock, coupon and cart`, async () => {
  const config = { SEPAY_BANK_CODE: "VietinBank", SEPAY_ACCOUNT_NAME: "QA SHOP", SEPAY_ACCOUNT_NUMBER: "123456789", SEPAY_WEBHOOK_API_KEY: randomUUID(), SEPAY_API_TOKEN: "", SEPAY_ENV: "sandbox" };
  const original = Object.fromEntries(Object.keys(config).map((key) => [key, process.env[key]]));
  Object.assign(process.env, config);
  try {
    const state = setup();
    const quote = await call(OrderController.quoteCheckout, method);
    assert.equal(quote.error, undefined); assert.equal(quote.body.data?.final_amount, 197000);
    assert.ok(quote.body.data?.cart_snapshot);
    const result = await call(OrderController.createOrder, method, 197000, quote.body.data.cart_snapshot);
    assert.equal(result.error, undefined); assert.equal(result.status, 201);
    assert.equal(result.body.data?.total_amount, quote.body.data?.final_amount);
    assert.equal(result.body.data?.payment_method, method); assert.equal(result.body.data?.total_items, 2);
    assert.deepEqual(state, { stock: 3, version: 1, couponUses: 1, cartLines: 0, orders: 1, details: 1, history: 1 });
  } finally {
    for (const [key, value] of Object.entries(original)) if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});

test("a destination outside the configured province cannot quote or place an express order", async () => {
  const state = setup(true, 1);
  for (const handler of [OrderController.quoteCheckout, OrderController.createOrder]) {
    const result = await call(handler, "COD", 207000, undefined, undefined, "Express");
    assert.match((result.error as Error | undefined)?.message ?? "", /hỏa tốc/);
  }
  assert.deepEqual(state, { stock: 5, version: 0, couponUses: 0, cartLines: 1, orders: 0, details: 0, history: 0 });
});

test("checkout quote offers express only in the configured province", async () => {
  setup(true, 79);
  const result = await call(OrderController.quoteCheckout, "COD", 207000, undefined, undefined, "Express");
  assert.equal(result.error, undefined);
  assert.equal(result.body.data?.express_available, true);
  assert.equal(result.body.data?.final_amount, 207000);
});

test("insufficient stock rolls back the simulated coupon update and leaves cart/order untouched", async () => {
  const state = setup(false);
  const result = await call(OrderController.createOrder, "COD");
  assert.ok(result.error && typeof result.error === "object" && "statusCode" in result.error);
  assert.equal(result.error.statusCode, 409);
  assert.deepEqual(state, { stock: 5, version: 0, couponUses: 0, cartLines: 1, orders: 0, details: 0, history: 0 });
});

test("changed checkout total fails before any stock, coupon, order or cart write", async () => {
  const state = setup();
  const result = await call(OrderController.createOrder, "COD", 180000);
  assert.ok(result.error && typeof result.error === "object" && "statusCode" in result.error);
  assert.equal(result.error.statusCode, 409);
  assert.deepEqual(state, { stock: 5, version: 0, couponUses: 0, cartLines: 1, orders: 0, details: 0, history: 0 });
});

test("retry after a lost checkout response returns the original order and never writes again", async () => {
  const state = setup();
  const quote = await call(OrderController.quoteCheckout, "COD");
  const snapshot = quote.body.data?.cart_snapshot;
  assert.ok(snapshot);
  const first = await call(OrderController.createOrder, "COD", 197000, snapshot);
  assert.equal(first.status, 201);
  const retry = await call(OrderController.createOrder, "COD", 197000, snapshot);
  assert.equal(retry.error, undefined);
  assert.equal(retry.status, 200);
  assert.deepEqual(retry.body.data, first.body.data);
  const changed = await call(OrderController.createOrder, "COD", 197000, snapshot, "Địa chỉ khác");
  assert.match((changed.error as Error).message, /đã được dùng/);
  assert.deepEqual(state, { stock: 3, version: 1, couponUses: 1, cartLines: 0, orders: 1, details: 1, history: 1 });
});
