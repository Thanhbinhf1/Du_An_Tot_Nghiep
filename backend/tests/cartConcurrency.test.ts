import assert from "node:assert/strict";
import { after, afterEach, before, mock, test } from "node:test";
import type { AddressInfo } from "node:net";
import { randomUUID } from "node:crypto";
import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import cartRoutes from "../src/routes/cartRoutes.js";
import User from "../src/models/userModel.js";
import Cart from "../src/models/cartModel.js";
import CartDetail from "../src/models/cartDetailModel.js";
import Product from "../src/models/productModel.js";
import Variant from "../src/models/productVariantModel.js";
import { errorHandler } from "../src/middlewares/errorMiddleware.js";

const uid = new mongoose.Types.ObjectId();
const pid = new mongoose.Types.ObjectId();
const vid = new mongoose.Types.ObjectId();
const cid = new mongoose.Types.ObjectId();
const itemId = new mongoose.Types.ObjectId();
const secret = randomUUID();
const previousSecret = process.env.JWT_SECRET;
const app = express();
app.use(express.json()); app.use("/cart", cartRoutes); app.use(errorHandler);
const server = app.listen(0, "127.0.0.1");
let base: string;
before(async () => {
  if (!server.listening) await new Promise<void>((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/cart`;
  process.env.JWT_SECRET = secret;
});
afterEach(() => mock.restoreAll());
after(async () => {
  if (previousSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previousSecret;
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});
function setup(stock = 10) {
  mock.method(User, "findById", async () => ({ _id: uid, role: "customer", session_version: 0 }));
  mock.method(Variant, "findById", async () => ({ _id: vid, product_id: pid, status: true, stock_quantity: stock }));
  mock.method(Product, "exists", async () => ({ _id: pid }));
  mock.method(Cart, "findOneAndUpdate", async () => ({ _id: cid }));
  return jwt.sign({ id: String(uid), role: "customer", sessionVersion: 0 }, secret, { expiresIn: "1m" });
}
function request(token: string, quantity = 1) {
  return fetch(base + "/items", {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ product_variant_id: String(vid), quantity }),
  });
}

test("two successful concurrent cart increments preserve both quantities", async () => {
  const token = setup();
  let stored = 1;
  let reads = 0;
  let release!: () => void;
  const firstReads = new Promise<void>((resolve) => { release = resolve; });
  mock.method(CartDetail, "findOne", async () => {
    const quantity = stored;
    if (++reads <= 2) { if (reads === 2) release(); await firstReads; }
    return { _id: itemId, quantity };
  });
  mock.method(CartDetail, "findOneAndUpdate", async (filter: { quantity: number }, update: { $set: { quantity: number } }) => {
    if (filter.quantity !== stored) return null;
    stored = update.$set.quantity;
    return { _id: itemId, quantity: stored };
  });
  const results = await Promise.all([request(token), request(token)]);
  assert.deepEqual(results.map((result) => result.status), [200, 200]);
  assert.equal(stored, 3);
});

test("simultaneous first inserts retry the unique-index conflict", async () => {
  const token = setup();
  let stored = 0;
  let reads = 0;
  let release!: () => void;
  const firstReads = new Promise<void>((resolve) => { release = resolve; });
  mock.method(CartDetail, "findOne", async () => {
    const quantity = stored;
    if (++reads <= 2) { if (reads === 2) release(); await firstReads; }
    return quantity ? { _id: itemId, quantity } : null;
  });
  mock.method(CartDetail, "create", async () => {
    if (stored) throw Object.assign(new Error("duplicate"), { code: 11000 });
    stored = 1; return { _id: itemId, quantity: stored };
  });
  mock.method(CartDetail, "findOneAndUpdate", async (filter: { quantity: number }, update: { $set: { quantity: number } }) => {
    if (filter.quantity !== stored) return null;
    stored = update.$set.quantity; return { _id: itemId, quantity: stored };
  });
  const results = await Promise.all([request(token), request(token)]);
  assert.ok(results.every((result) => result.status === 200 || result.status === 201));
  assert.equal(stored, 2);
});

test("a hidden parent is rejected before a cart write", async () => {
  const token = setup();
  mock.method(Product, "exists", async () => null);
  assert.equal((await request(token)).status, 404);
  assert.equal((Cart.findOneAndUpdate as unknown as { mock: { callCount(): number } }).mock.callCount(), 0);
});

test("cart increment never exceeds stock", async () => {
  const token = setup(2);
  mock.method(CartDetail, "findOne", async () => ({ _id: itemId, quantity: 2 }));
  const write = mock.method(CartDetail, "findOneAndUpdate", async () => null);
  assert.equal((await request(token)).status, 400);
  assert.equal(write.mock.callCount(), 0);
});

test("absolute quantity updates reject a concurrent modification", async () => {
  const token = setup();
  mock.method(Cart, "findOne", async () => ({ _id: cid }));
  mock.method(CartDetail, "findOne", async () => ({ _id: itemId, quantity: 1, product_variant_id: vid }));
  mock.method(CartDetail, "findOneAndUpdate", async () => null);
  const response = await fetch(base + `/items/${itemId}`, {
    method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ quantity: 3 }),
  });
  assert.equal(response.status, 409);
});
