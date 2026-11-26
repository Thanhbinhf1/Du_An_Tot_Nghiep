import assert from "node:assert/strict";
import { after, afterEach, before, mock, test } from "node:test";
import type { AddressInfo } from "node:net";
import { randomUUID } from "node:crypto";
import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import adminRoutes from "../src/routes/adminRoutes.js";
import User from "../src/models/userModel.js";
import Order from "../src/models/orderModel.js";
import Detail from "../src/models/orderDetailModel.js";
import Payment from "../src/models/paymentModel.js";
import Review from "../src/models/productCommentModel.js";
import BlockedWord from "../src/models/blockedWordModel.js";
import { errorHandler } from "../src/middlewares/errorMiddleware.js";
import { literalSearch, readPagination } from "../src/services/listQuery.js";

const app = express(); app.use(express.json()); app.use("/admin", adminRoutes); app.use(errorHandler);
const server = app.listen(0, "127.0.0.1");
const uid = new mongoose.Types.ObjectId();
const secret = randomUUID();
const previousSecret = process.env.JWT_SECRET;
let base: string;
before(async () => {
  if (!server.listening) await new Promise<void>((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/admin`;
  process.env.JWT_SECRET = secret;
});
afterEach(() => mock.restoreAll());
after(async () => {
  if (previousSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previousSecret;
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});
function headers() {
  mock.method(User, "findById", async () => ({ _id: uid, role: "admin", session_version: 0 }));
  return { Authorization: `Bearer ${jwt.sign({ id: String(uid), role: "admin", sessionVersion: 0 }, secret, { expiresIn: "1m" })}` };
}
function query<T>(rows: T[]) {
  let skip = 0, limit = rows.length;
  const value = {
    populate: () => value, sort: () => value, select: () => value,
    skip: (number: number) => { skip = number; return value; },
    limit: (number: number) => { limit = number; return value; },
    lean: async () => rows.slice(skip, skip + limit),
  };
  return value;
}

test("admin orders can retrieve records beyond the former 200-order cutoff", async () => {
  const rows = Array.from({ length: 225 }, () => ({ _id: new mongoose.Types.ObjectId(), order_status: "pending" }));
  mock.method(Order, "find", (filter: unknown) => { assert.deepEqual(filter, { order_status: "pending" }); return query(rows); });
  mock.method(Order, "countDocuments", async () => rows.length);
  mock.method(Order, "aggregate", async () => [{ _id: "pending", count: rows.length }]);
  mock.method(Detail, "find", () => query([]));
  const response = await fetch(base + "/orders?page=9&limit=25&status=pending", { headers: headers() });
  assert.equal(response.status, 200);
  const { data, pagination } = await response.json();
  assert.equal(data.length, 25); assert.equal(data[0]._id, String(rows[200]!._id));
  assert.equal(pagination.total, 225); assert.equal(pagination.totalPages, 9); assert.equal(pagination.statusCounts.pending, 225);
});

test("payments can retrieve the page after the former 100-payment cutoff", async () => {
  const rows = Array.from({ length: 125 }, () => ({ _id: new mongoose.Types.ObjectId() }));
  mock.method(Payment, "find", () => query(rows));
  mock.method(Payment, "countDocuments", async () => rows.length);
  const response = await fetch(base + "/payments?page=5&limit=25", { headers: headers() });
  assert.equal(response.status, 200);
  const { data, pagination } = await response.json();
  assert.equal(data[0]._id, String(rows[100]!._id)); assert.equal(pagination.totalPages, 5);
});

test("reviews apply server-side filters before pagination and escape regex metacharacters", async () => {
  const rows = Array.from({ length: 125 }, () => ({ _id: new mongoose.Types.ObjectId(), comment: "Góp ý sản phẩm", rating: 5 }));
  mock.method(BlockedWord, "find", () => query([]));
  let filter: Record<string, unknown> = {};
  mock.method(Review, "find", (input: typeof filter) => { filter = input; return query(rows); });
  mock.method(Review, "countDocuments", async () => rows.length);
  const response = await fetch(base + "/reviews?page=5&limit=25&rating=5&search=A.*", { headers: headers() });
  assert.equal(response.status, 200);
  const { data, pagination } = await response.json();
  assert.equal(data[0]._id, String(rows[100]!._id)); assert.equal(pagination.total, 125);
  assert.equal(filter.rating, 5);
  assert.deepEqual(filter.$or, ["product_key", "user_name", "user_email", "comment"].map((key) => ({ [key]: { $regex: "A\\.\\*", $options: "i" } })));
});

test("pagination rejects invalid, fractional, array and overflowing input", () => {
  for (const query of [{ page: "Infinity" }, { page: "0" }, { page: "1.5" }, { page: ["1"] }, { limit: "101" }, { page: String(Number.MAX_SAFE_INTEGER), limit: "100" }]) {
    assert.throws(() => readPagination(query), /phân trang/);
  }
  assert.throws(() => literalSearch("x".repeat(101)), /100 ký tự/);
  assert.equal(literalSearch("[abc].*"), "\\[abc\\]\\.\\*");
});
