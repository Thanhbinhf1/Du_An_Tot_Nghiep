import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import mongoose, { type ClientSession } from "mongoose";
import type { Response, NextFunction } from "express";
import type { AuthRequest } from "../src/middlewares/authMiddleware.js";
import { AppError } from "../src/middlewares/AppError.js";
import { AdminController } from "../src/controllers/adminController.js";
import { OrderController } from "../src/controllers/orderController.js";
import { deleteProduct } from "../src/controllers/productController.js";
import { restoreOrderStock } from "../src/services/orderStock.js";
import Product from "../src/models/productModel.js";
import Variant from "../src/models/productVariantModel.js";
import ProductImage from "../src/models/productImageModel.js";
import Order from "../src/models/orderModel.js";
import Detail from "../src/models/orderDetailModel.js";
import History from "../src/models/orderStatusHistoryModel.js";
import Coupon from "../src/models/couponModel.js";
import Outfit from "../src/models/outfitModel.js";
import OutfitDetail from "../src/models/outfitDetailModel.js";

const pid = new mongoose.Types.ObjectId();
const vid = new mongoose.Types.ObjectId();
const oid = new mongoose.Types.ObjectId();
const session = {} as ClientSession;
afterEach(() => mock.restoreAll());

function transaction() {
  return mock.method(mongoose.connection, "transaction", async (callback: (value: ClientSession) => Promise<unknown>) => callback(session));
}
async function call(handler: (req: AuthRequest, res: Response, next: NextFunction) => unknown, input: object) {
  const result: { status: number; error?: unknown; body?: unknown } = { status: 200 };
  const response = {
    status(code: number) { result.status = code; return this; },
    json(body: unknown) { result.body = body; return this; },
  } as unknown as Response;
  await handler({ params: {}, query: {}, ...input } as AuthRequest, response, (error?: unknown) => { result.error = error; });
  return result;
}

test("restoration groups variants, preserves legacy lines and uses the transaction session", async () => {
  const updates: number[] = [];
  mock.method(Variant, "updateOne", async (_filter: unknown, update: { $inc: { stock_quantity: number } }, options: { session: ClientSession }) => {
    assert.equal(options.session, session); updates.push(update.$inc.stock_quantity); return { matchedCount: 1 };
  });
  await restoreOrderStock([
    { product_variant_id: vid, quantity: 2 }, { product_variant_id: vid, quantity: 3 },
    { storefront_product_id: pid, quantity: 1 },
  ], session);
  assert.deepEqual(updates, [5]);
});

test("invalid or missing restoration lines fail before any stock write", async () => {
  const write = mock.method(Variant, "updateOne", async () => ({ matchedCount: 1 }));
  for (const lines of [[], [{ product_variant_id: vid, quantity: -1 }], [{ product_variant_id: vid, quantity: 1.5 }], [{ quantity: 1 }]]) {
    await assert.rejects(restoreOrderStock(lines, session), AppError);
  }
  assert.equal(write.mock.callCount(), 0);
});

test("restoration cannot overflow the safe stock range", async () => {
  mock.method(Variant, "updateOne", async (filter: { stock_quantity: { $lte: number; $gte: number; $mod: number[] } }) => {
    assert.equal(filter.stock_quantity.$lte, Number.MAX_SAFE_INTEGER - 2);
    assert.equal(filter.stock_quantity.$gte, 0);
    assert.deepEqual(filter.stock_quantity.$mod, [1, 0]);
    return { matchedCount: 0 }; // Stored stock is already MAX_SAFE_INTEGER.
  });
  await assert.rejects(restoreOrderStock([{ product_variant_id: vid, quantity: 2 }], session), { statusCode: 409 });
});

test("admin cancellation does not claim success when the variant cannot be restored", async () => {
  transaction();
  let saved = false;
  mock.method(Order, "findById", () => ({ session: async () => ({
    _id: oid, order_status: "pending", payment_status: "pending", payment_method: "COD",
    async save() { saved = true; },
  }) }));
  mock.method(Detail, "find", () => ({ session: async () => [{ product_variant_id: vid, quantity: 2 }] }));
  mock.method(Variant, "updateOne", async () => ({ matchedCount: 0 }));
  const history = mock.method(History.prototype, "save", async function (this: unknown) { return this; });
  const result = await call(AdminController.cancelOrderAdmin, { params: { id: String(oid) }, body: {} });
  assert.ok(result.error instanceof AppError); assert.equal(result.error.statusCode, 409);
  assert.equal(saved, false); assert.equal(history.mock.callCount(), 0);
});

test("a customer must give a reason before cancellation can write to the database", async () => {
  const tx = mock.method(mongoose.connection, "transaction", async () => { throw new Error("Must not start a transaction"); });
  const result = await call(OrderController.cancelOrder, {
    params: { id: String(oid) }, user: { _id: pid, role: "customer" }, body: { reason: "  " },
  });
  assert.ok(result.error instanceof AppError);
  assert.equal(result.error.statusCode, 400);
  assert.equal(tx.mock.callCount(), 0);
});

test("cancelling open COD restores stock and coupon once and records the customer's reason", async () => {
  transaction();
  const order = { _id: oid, order_status: "pending", payment_status: "pending", payment_method: "COD", coupon_id: new mongoose.Types.ObjectId() };
  mock.method(Order, "findOne", (filter: { user_id: unknown }) => ({ session: async () => {
    assert.equal(filter.user_id, pid);
    return order;
  } }));
  mock.method(Order, "findOneAndUpdate", async (_filter: unknown, update: { $set: { order_status: string } }, options: { session: ClientSession }) => {
    assert.equal(options.session, session);
    Object.assign(order, update.$set);
    return order;
  });
  mock.method(Detail, "find", () => ({ session: async () => [{ product_variant_id: vid, quantity: 2 }] }));
  const stock = mock.method(Variant, "updateOne", async (_filter: unknown, update: { $inc: { stock_quantity: number } }, options: { session: ClientSession }) => {
    assert.equal(options.session, session);
    assert.equal(update.$inc.stock_quantity, 2);
    return { matchedCount: 1 };
  });
  const coupon = mock.method(Coupon, "updateOne", async (_filter: unknown, update: { $inc: { used_count: number } }, options: { session: ClientSession }) => {
    assert.equal(options.session, session);
    assert.equal(update.$inc.used_count, -1);
    return { matchedCount: 1 };
  });
  const history = mock.method(History, "create", async ([entry]: Array<{ note: string; changed_by: unknown }>, options: { session: ClientSession }) => {
    assert.equal(options.session, session);
    assert.equal(entry?.note, "Khách hàng hủy đơn COD: Đặt nhầm size");
    assert.equal(entry?.changed_by, pid);
    return [];
  });
  const input = { params: { id: String(oid) }, user: { _id: pid, role: "customer" }, body: { reason: "  Đặt nhầm size  " } };
  const first = await call(OrderController.cancelOrder, input);
  assert.equal(first.error, undefined);
  assert.equal(first.status, 200);
  assert.equal(order.order_status, "cancelled");
  assert.equal(order.payment_status, "pending");
  const second = await call(OrderController.cancelOrder, input);
  assert.ok(second.error instanceof AppError);
  assert.equal(second.error.statusCode, 409);
  for (const effect of [stock, coupon, history]) assert.equal(effect.mock.callCount(), 1);
});

test("product deletion hides product and variants without deleting references or images", async () => {
  const tx = transaction();
  mock.method(Product, "findByIdAndUpdate", async (_id: unknown, update: { $set: { status: boolean } }, options: { session: ClientSession }) => {
    assert.equal(update.$set.status, false); assert.equal(options.session, session); return { _id: pid };
  });
  const stopVariants = mock.method(Variant, "updateMany", async (_filter: unknown, update: { $set: { status: boolean } }, options: { session: ClientSession }) => {
    assert.equal(update.$set.status, false); assert.equal(options.session, session); return { matchedCount: 2 };
  });
  const deleteVariants = mock.method(Variant, "deleteMany", async () => { throw new Error("Must preserve variants"); });
  const deleteImages = mock.method(ProductImage, "deleteMany", async () => { throw new Error("Must preserve images"); });
  const result = await call(deleteProduct, { params: { id: String(pid) } });
  assert.equal(result.error, undefined); assert.equal(result.status, 200);
  assert.equal(tx.mock.callCount(), 1); assert.equal(stopVariants.mock.callCount(), 1);
  assert.equal(deleteVariants.mock.callCount(), 0); assert.equal(deleteImages.mock.callCount(), 0);
});

test("outfit replacement failure propagates through the transaction with every write bound to its session", async () => {
  let details = [String(pid)];
  const tx = mock.method(mongoose.connection, "transaction", async (callback: (value: ClientSession) => Promise<unknown>) => {
    const snapshot = [...details];
    try { return await callback(session); } catch (error) { details = snapshot; throw error; }
  });
  mock.method(Product, "countDocuments", async () => 1);
  mock.method(Outfit, "findByIdAndUpdate", async (_id: unknown, _update: unknown, options: { session: ClientSession }) => {
    assert.equal(options.session, session); return { _id: oid };
  });
  mock.method(OutfitDetail, "deleteMany", async (_filter: unknown, options: { session: ClientSession }) => {
    assert.equal(options.session, session); details = []; return { deletedCount: 1 };
  });
  mock.method(OutfitDetail, "insertMany", async (_docs: unknown, options: { session: ClientSession }) => {
    assert.equal(options.session, session); throw new Error("Injected insertion failure");
  });
  const result = await call(AdminController.saveOutfit, {
    params: { id: String(oid) }, body: { title: "Audit outfit", image: "/audit.png", product_ids: [String(pid)] },
  });
  assert.ok(result.error instanceof Error);
  assert.equal(tx.mock.callCount(), 1); assert.deepEqual(details, [String(pid)]);
});

test("completing a COD order marks payment successful in the same transaction", async () => {
  transaction();
  const order = { _id: oid, order_status: "shipping", payment_status: "pending", payment_method: "COD" };
  mock.method(Order, "findById", () => ({ session: async () => order }));
  let update: { $set: { order_status: string; payment_status?: string } } | undefined;
  mock.method(Order, "findOneAndUpdate", async (_filter: unknown, values: typeof update, options: { session: ClientSession }) => {
    update = values; assert.equal(options.session, session); return { ...order, ...values?.$set };
  });
  mock.method(History, "create", async () => []);
  const result = await call(OrderController.updateOrderStatus, {
    params: { id: String(oid) }, body: { status: "completed" }, user: { _id: pid, role: "admin" },
  });
  assert.equal(result.error, undefined); assert.equal(result.status, 200);
  assert.equal(update?.$set.order_status, "completed"); assert.equal(update?.$set.payment_status, "success");
});

test("refunded COD cannot be overwritten as a new payment success", async () => {
  transaction();
  mock.method(Order, "findById", () => ({ session: async () => ({
    _id: oid, order_status: "shipping", payment_status: "refunded", payment_method: "COD",
  }) }));
  const update = mock.method(Order, "findOneAndUpdate", async () => null);
  const result = await call(OrderController.updateOrderStatus, {
    params: { id: String(oid) }, body: { status: "completed" }, user: { _id: pid, role: "admin" },
  });
  assert.ok(result.error instanceof AppError); assert.equal(result.error.statusCode, 409);
  assert.equal(update.mock.callCount(), 0);
});
