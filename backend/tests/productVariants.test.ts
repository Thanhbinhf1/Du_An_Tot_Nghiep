import assert from "node:assert/strict";
import { after, afterEach, before, mock, test } from "node:test";
import type { AddressInfo } from "node:net";
import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import productRoutes from "../src/routes/productRoutes.js";
import Product from "../src/models/productModel.js";
import ProductVariant from "../src/models/productVariantModel.js";
import User from "../src/models/userModel.js";
import { errorHandler } from "../src/middlewares/errorMiddleware.js";

const productId = "507f1f77bcf86cd799439011";
const variantId = "507f1f77bcf86cd799439012";
const userId = "507f1f77bcf86cd799439013";
const valid = { sku: " shirt-m-red ", size: " M ", color: " Red ", price: 200, stock_quantity: 5 };
const app = express();
app.use(express.json());
app.use("/api/products", productRoutes);
app.use(errorHandler);
const server = app.listen(0, "127.0.0.1");
let base: string;
const previousSecret = process.env.JWT_SECRET;

before(async () => {
  if (!server.listening) await new Promise<void>((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/products/${productId}/variants`;
  process.env.JWT_SECRET = "product-variant-test-secret";
});
afterEach(() => mock.restoreAll());
after(async () => {
  if (previousSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = previousSecret;
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

// Chỉ giả lập tầng lưu trữ; Express, JWT, phân quyền và schema chạy thực.
function authorize(role = "admin") {
  mock.method(User, "findById", async () => ({ _id: userId, role, is_blocked: false }));
  return jwt.sign({ id: userId, role }, process.env.JWT_SECRET!);
}
async function request(method: string, body?: unknown, suffix = "", token?: string) {
  return fetch(base + suffix, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

test("schema giữ collection hiện tại và hai unique index", () => {
  assert.equal(ProductVariant.collection.name, "productvariants");
  assert.ok(ProductVariant.schema.indexes().some(([keys, options]) => keys.sku === 1 && options.unique));
  assert.ok(ProductVariant.schema.indexes().some(([keys, options]) => keys.product_id === 1 && keys.size === 1 && keys.color === 1 && options.unique));
});

test("schema chuẩn hóa SKU và kiểm tra giá, tồn kho", async () => {
  const doc = new ProductVariant({ ...valid, product_id: productId });
  assert.equal(doc.sku, "SHIRT-M-RED");
  assert.equal(doc.size, "M");
  assert.equal(doc.color, "Red");
  await doc.validate();
  for (const invalid of [{ stock_quantity: 1.5 }, { stock_quantity: -1 }, { price: Infinity }, { price: 100.5 }, { price: Number.MAX_SAFE_INTEGER + 1 }, { sale_price: 150.25 }, { sale_price: 201 }, { sale_price: -1 }]) {
    await assert.rejects(new ProductVariant({ ...valid, product_id: productId, ...invalid }).validate(), mongoose.Error.ValidationError);
  }
  doc.sale_price = 150;
  doc.price = 100;
  await assert.rejects(doc.validate(), mongoose.Error.ValidationError);
  doc.sale_price = null;
  await doc.validate();
});

test("GET chỉ lấy biến thể đang bán của sản phẩm đang hoạt động", async () => {
  mock.method(Product, "findOne", async (filter: unknown) => {
    assert.deepEqual(filter, { _id: productId, status: true });
    return { _id: productId };
  });
  mock.method(ProductVariant, "find", (filter: unknown) => {
    assert.deepEqual(filter, { product_id: productId, status: true });
    return { sort: () => ({ lean: async () => [{ _id: variantId }] }) };
  });
  const response = await request("GET");
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).data, [{ _id: variantId }]);
});

test("GET trả 404 khi không có sản phẩm và 400 khi ID sai", async () => {
  mock.method(Product, "findOne", async () => null);
  assert.equal((await request("GET")).status, 404);
  const response = await fetch(base.replace(productId, "invalid"));
  assert.equal(response.status, 400);
});

test("mọi thao tác ghi yêu cầu đăng nhập và quyền admin", async () => {
  for (const method of ["POST", "PATCH", "DELETE"]) {
    const suffix = method === "POST" ? "" : `/${variantId}`;
    assert.equal((await request(method, valid, suffix)).status, 401);
  }
  const token = authorize("customer");
  for (const method of ["POST", "PATCH", "DELETE"]) {
    const suffix = method === "POST" ? "" : `/${variantId}`;
    assert.equal((await request(method, valid, suffix, token)).status, 403);
  }
});

test("POST/PATCH từ chối kiểu sai, trường lạ và cập nhật rỗng", async () => {
  const token = authorize();
  const invalid = [null, [], {}, { ...valid, sku: 10 }, { ...valid, size: " " },
    { ...valid, price: "200" }, { ...valid, price: null }, { ...valid, price: 100.5 }, { ...valid, sale_price: 100.5 }, { ...valid, status: "false" },
    { ...valid, stock_quantity: 0.5 }, { ...valid, sale_price: -1 }, { ...valid, product_id: productId }];
  for (const body of invalid) {
    assert.equal((await request("POST", body, "", token)).status, 400, JSON.stringify(body));
  }
  assert.equal((await request("PATCH", {}, `/${variantId}`, token)).status, 400);
  assert.equal((await request("PATCH", { price: "100" }, `/${variantId}`, token)).status, 400);
  assert.equal((await request("PATCH", { price: 100 }, "/invalid", token)).status, 400);
});

test("lỗi lưu trữ không dự kiến được chuyển cho error handler", async () => {
  mock.method(Product, "findOne", async () => { throw new Error("storage unavailable"); });
  assert.equal((await request("GET")).status, 500);
});

// Write-path regressions migrated to real MongoDB transactions in catalogWorkspace.test.ts (CAT-P03..P12).
