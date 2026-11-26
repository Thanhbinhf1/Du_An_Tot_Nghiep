import assert from "node:assert/strict";
import { after, afterEach, before, mock, test } from "node:test";
import type { AddressInfo } from "node:net";
import { randomUUID } from "node:crypto";
import express, { type Response } from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import authRoutes from "../src/routes/authRoutes.js";
import adminRoutes from "../src/routes/adminRoutes.js";
import orderRoutes from "../src/routes/orderRoutes.js";
import User from "../src/models/userModel.js";
import ProductVariant from "../src/models/productVariantModel.js";
import InventoryMovement from "../src/models/inventoryMovementModel.js";
import { AdminController } from "../src/controllers/adminController.js";
import { AppError } from "../src/middlewares/AppError.js";
import type { AuthRequest } from "../src/middlewares/authMiddleware.js";
import { errorHandler } from "../src/middlewares/errorMiddleware.js";
import { configuredPaymentMethods, isPaymentMethodConfigured } from "../src/config/paymentMethods.js";

const app = express();
app.use(express.json());
app.use("/auth", authRoutes);
app.use("/admin", adminRoutes);
app.use("/orders", orderRoutes);
app.get("/invalid-id", (_req, _res, next) => next(new mongoose.Error.CastError("ObjectId", "invalid", "_id")));
app.get("/invalid-data", (_req, _res, next) => next(new mongoose.Error.ValidationError()));
app.use(errorHandler);
const server = app.listen(0, "127.0.0.1");
let base: string;
const previousSecret = process.env.JWT_SECRET;
const secret = randomUUID();
before(async () => {
  if (!server.listening) await new Promise<void>((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  process.env.JWT_SECRET = secret;
});
afterEach(() => mock.restoreAll());
after(async () => {
  if (previousSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = previousSecret;
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

function authorize() {
  const user = new User({ _id: new mongoose.Types.ObjectId(), name: "Audit", email: "audit@example.invalid", role: "admin" });
  mock.method(User, "findById", async () => user);
  return jwt.sign({ id: String(user._id), role: user.role, sessionVersion: 0 }, secret, { expiresIn: "1m" });
}

test("login rejects a missing body, null and arrays as client errors", async () => {
  for (const body of [undefined, "null", "[]"]) {
    const response = await fetch(base + "/auth/login", {
      method: "POST", ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body }),
    });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).stack, undefined);
  }
});

test("CastError and schema validation errors use HTTP 400 without raw input or stack", async () => {
  for (const path of ["/invalid-id", "/invalid-data"]) {
    const response = await fetch(base + path);
    assert.equal(response.status, 400);
    const data = await response.json();
    assert.equal(data.status, "error");
    assert.equal(data.stack, undefined);
    assert.equal(data.message.includes('Cast to ObjectId'), false);
  }
});

test("inventory rejects coercible non-numbers before writing", async () => {
  const token = authorize();
  const write = mock.method(ProductVariant, "findByIdAndUpdate", () => { throw new Error("Invalid input must not write"); });
  for (const stock of [null, false, "", "10", -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    const response = await fetch(base + `/admin/inventory/${new mongoose.Types.ObjectId()}`, {
      method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ stock_quantity: stock }),
    });
    assert.equal(response.status, 400);
  }
  assert.equal(write.mock.callCount(), 0);
});

test("SePay discovery agrees with order validation; retired methods cannot create new orders", async () => {
  const environment = { SEPAY_BANK_CODE: "VietinBank", SEPAY_ACCOUNT_NAME: "QA SHOP", SEPAY_ACCOUNT_NUMBER: "123456789", SEPAY_WEBHOOK_API_KEY: randomUUID(), SEPAY_API_TOKEN: "", SEPAY_ENV: "sandbox" };
  const original = Object.fromEntries(Object.keys(environment).map((key) => [key, process.env[key]])); Object.assign(process.env, environment);
  try {
    assert.equal(isPaymentMethodConfigured("SePay"), true);
    assert.ok(configuredPaymentMethods().includes("SePay"));
    const token = authorize();
    const transaction = mock.method(mongoose.connection, "transaction", async () => { throw new Error("AUDIT reached persistence boundary"); });
    const send = (method: string) => fetch(base + "/orders", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }, body: JSON.stringify({ address_id: String(new mongoose.Types.ObjectId()), payment_method: method }) });
    assert.equal((await send("SePay")).status, 500); assert.equal(transaction.mock.callCount(), 1);
    for (const retired of ["VNPay", "PayOS"]) { assert.ok(!configuredPaymentMethods().map(String).includes(retired)); assert.equal((await send(retired)).status, 400); }
    assert.equal(transaction.mock.callCount(), 1);
    delete process.env.SEPAY_WEBHOOK_API_KEY; assert.equal(configuredPaymentMethods().includes("SePay"), false);
  } finally { for (const [key, value] of Object.entries(original)) if (value === undefined) delete process.env[key]; else process.env[key] = value; }
});

test("inventory refuses stale stock and journals a compatible adjustment in the same session", async () => {
  const id = String(new mongoose.Types.ObjectId());
  const actorId = new mongoose.Types.ObjectId();
  const session = {} as mongoose.ClientSession;
  const stored = { _id: id, stock_quantity: 4, __v: 1 }; // Checkout reduced 5 -> 4 after the admin read version 0.
  mock.method(mongoose.connection, "transaction", async (run: (s: mongoose.ClientSession) => Promise<unknown>) => run(session));
  mock.method(ProductVariant, "exists", () => ({ session: async () => ({ _id: id }) }));
  mock.method(ProductVariant, "findOneAndUpdate", (filter: { __v?: number }, update: { $set: { stock_quantity: number }; $inc: { __v: number } }, options: { session: mongoose.ClientSession; returnDocument: string }) => ({
    populate: () => ({ lean: async () => {
      assert.equal(options.session, session);
      assert.equal(options.returnDocument, "before");
      if (filter.__v !== stored.__v) return null;
      const previous = { ...stored };
      stored.stock_quantity = update.$set.stock_quantity;
      stored.__v += update.$inc.__v;
      return previous;
    } }),
  }));
  const journal = mock.method(InventoryMovement, "create", async () => []);
  const send = async (expected_version?: number) => {
    const req = { params: { id }, user: { _id: actorId }, body: { stock_quantity: 12, expected_version } } as unknown as AuthRequest;
    let response: { data: { __v: number } } | undefined;
    await AdminController.updateInventoryStock(req, { json: (value: typeof response) => { response = value; } } as Response, (error?: unknown) => { if (error) throw error; });
    return response;
  };
  await assert.rejects(send(), (error: unknown) => error instanceof AppError && error.statusCode === 400);
  await assert.rejects(send(0), (error: unknown) => error instanceof AppError && error.statusCode === 409);
  assert.equal(stored.stock_quantity, 4);
  assert.equal(journal.mock.callCount(), 0);
  assert.equal((await send(1))?.data.__v, 2);
  assert.equal(stored.stock_quantity, 12);
  assert.equal(journal.mock.callCount(), 1);
  const [[movement], options] = journal.mock.calls[0]!.arguments as unknown as [{ stock_delta: number; variant_id: string; actor_id: mongoose.Types.ObjectId }[], { session: mongoose.ClientSession }];
  assert.equal(options.session, session);
  assert.equal(movement!.stock_delta, 8);
  assert.equal(movement!.variant_id, id);
  assert.equal(movement!.actor_id, actorId);
});

test("admin upload rejects a forged image MIME before publishing any file URL", async () => {
  const token = authorize();
  const data = new FormData();
  data.append("image", new Blob(["<script>alert(1)</script>"], { type: "image/png" }), "forged.png");
  const response = await fetch(base + "/admin/uploads", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: data });
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.equal(body.data, undefined);
  assert.match(body.message, /Nội dung tệp/);
});
