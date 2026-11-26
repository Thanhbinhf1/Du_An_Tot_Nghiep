import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { afterEach, mock, test } from "node:test";
import type { Response } from "express";
import mongoose, { type ClientSession } from "mongoose";
import { PaymentController } from "../src/controllers/paymentController.js";
import { OrderReturnController } from "../src/controllers/orderReturnController.js";
import type { AuthRequest } from "../src/middlewares/authMiddleware.js";
import Order from "../src/models/orderModel.js";
import History from "../src/models/orderStatusHistoryModel.js";
import Payment from "../src/models/paymentModel.js";
import Variant from "../src/models/productVariantModel.js";

const oid = new mongoose.Types.ObjectId();
const pid = new mongoose.Types.ObjectId();
const admin = { _id: new mongoose.Types.ObjectId(), role: "admin" };
const session = {} as ClientSession;

afterEach(() => mock.restoreAll());

function response() {
  const result = { status: 200 };
  const res = {
    status(code: number) { result.status = code; return this; },
    json() { return this; },
    send() { return this; },
  } as unknown as Response;
  return { res, result };
}

function transaction() {
  mock.method(mongoose.connection, "transaction", async (run: (value: ClientSession) => Promise<unknown>) => run(session));
}

test("bank transfer confirmation checks the amount received before marking either record paid", async () => {
  transaction();
  mock.method(Payment, "findById", () => ({ session: async () => ({ order_id: oid, status: "pending", payment_method: "BankTransfer" }) }));
  let settledAmount: number | undefined;
  mock.method(Order, "findOneAndUpdate", async (filter: { final_amount?: number }) => {
    if (filter.final_amount !== undefined && filter.final_amount !== 195000) return null;
    settledAmount = filter.final_amount;
    return { _id: oid, payment_status: "success" };
  });
  const paymentWrite = mock.method(Payment, "findOneAndUpdate", async () => ({ _id: pid, status: "success" }));
  mock.method(History, "create", async () => []);
  async function confirm(amount?: number) {
    let error: unknown;
    const { res } = response();
    await PaymentController.confirmBankTransfer({
      user: admin, params: { id: String(pid) }, body: { transaction_id: "qa-receipt", amount },
    } as unknown as AuthRequest, res, (cause?: unknown) => { error = cause; });
    return error;
  }
  assert.match((await confirm(190000) as Error)?.message ?? "", /Số tiền/);
  assert.match((await confirm() as Error)?.message ?? "", /Số tiền/);
  assert.equal(paymentWrite.mock.callCount(), 0);
  assert.equal(await confirm(195000), undefined);
  assert.equal(settledAmount, 195000);
  assert.equal(paymentWrite.mock.callCount(), 1);
});

test("a verified late MoMo payment is recorded on the cancelled order once, with inventory intact", async (t) => {
  const env = {
    MOMO_PARTNER_CODE: "VSCQA", MOMO_ACCESS_KEY: "qa", MOMO_SECRET_KEY: randomUUID(),
    MOMO_ENDPOINT: "https://example.invalid", MOMO_REDIRECT_URL: "https://example.invalid", MOMO_IPN_URL: "https://example.invalid",
  };
  for (const [key, value] of Object.entries(env)) {
    const previous = process.env[key];
    process.env[key] = value;
    t.after(() => { if (previous === undefined) delete process.env[key]; else process.env[key] = previous; });
  }
  const body = {
    amount: 195000, extraData: "", message: "QA", orderId: String(oid),
    orderInfo: `Thanh toan FStyle ${oid}`, orderType: "momo_wallet", partnerCode: env.MOMO_PARTNER_CODE, payType: "qr",
    requestId: String(oid), responseTime: Date.now(), resultCode: 0, transId: 1234,
  };
  const sign = (data: typeof body) => createHmac("sha256", env.MOMO_SECRET_KEY).update(
    [`accessKey=${env.MOMO_ACCESS_KEY}`, ...Object.entries(data).map(([key, value]) => `${key}=${value}`)].join("&"),
  ).digest("hex");
  const order = { _id: oid, payment_method: "MoMo", payment_status: "pending", order_status: "cancelled", final_amount: 195000, transaction_id: "" };
  const payment = { _id: pid, order_id: oid, status: "pending" };
  transaction();
  mock.method(Order, "findById", () => ({ session: async () => order }));
  mock.method(Order, "exists", () => ({ session: async () => null }));
  mock.method(Payment, "findOne", () => ({ session: async () => payment }));
  const orderWrite = mock.method(Order, "findOneAndUpdate", async (filter: { order_status: string }, update: { $set: object }) => {
    assert.equal(filter.order_status, "cancelled");
    return Object.assign(order, update.$set);
  });
  mock.method(Payment, "findOneAndUpdate", async (_: unknown, update: { $set: object }) => Object.assign(payment, update.$set));
  const history = mock.method(History, "create", async (_: unknown, options: { session: ClientSession }) => {
    assert.equal(options.session, session);
    return [];
  });
  const stockWrite = mock.method(Variant, "updateOne", async () => { throw new Error("Unexpected restock"); });
  const ipn = async (data = body) => {
    const { res, result } = response();
    await PaymentController.momoIPN({ body: { ...data, signature: sign(data) } } as AuthRequest, res);
    return result.status;
  };
  assert.equal(await ipn({ ...body, amount: 194999 }), 409);
  assert.equal(orderWrite.mock.callCount(), 0);
  assert.equal(await ipn(), 204);
  assert.equal(order.order_status, "cancelled");
  assert.equal(order.payment_status, "success");
  assert.equal(payment.status, "success");
  order.payment_status = "refunded";
  assert.equal(await ipn(), 204);
  assert.equal(orderWrite.mock.callCount(), 1);
  assert.equal(stockWrite.mock.callCount(), 0);
  assert.equal(history.mock.callCount(), 1);
});

test("the same refund bank reference cannot be recorded on a second order", async () => {
  transaction();
  const order = { _id: oid, order_status: "cancelled", payment_status: "success", final_amount: 195000, save: async () => order };
  const save = mock.method(order, "save");
  mock.method(Order, "findOne", () => ({ session: async () => order }));
  mock.method(Order, "exists", () => ({ session: async () => ({ _id: new mongoose.Types.ObjectId() }) }));
  const history = mock.method(History, "create", async () => []);
  let error: unknown;
  const { res } = response();
  await OrderReturnController.recordRefund({
    user: admin, params: { id: String(oid) }, body: { reference: "QA-123", note: "QA refund", confirmed: true, amount: 195000 },
  } as unknown as AuthRequest, res, (cause?: unknown) => { error = cause; });
  assert.match((error as Error)?.message ?? "", /đã được ghi nhận/);
  assert.equal(save.mock.callCount(), 0);
  assert.equal(history.mock.callCount(), 0);
  assert.equal(order.payment_status, "success");
});
