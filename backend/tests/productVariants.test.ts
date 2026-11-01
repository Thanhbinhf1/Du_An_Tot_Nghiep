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
  for (const invalid of [{ stock_quantity: 1.5 }, { stock_quantity: -1 }, { price: Infinity }, { sale_price: 201 }, { sale_price: -1 }]) {
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

test("POST tạo biến thể đã chuẩn hóa và trả 201", async () => {
  const token = authorize();
  mock.method(Product, "findById", async () => ({ _id: productId }));
  mock.method(ProductVariant, "create", async (input: any) => {
    assert.deepEqual(input, { ...valid, sku: "SHIRT-M-RED", size: "M", color: "Red", product_id: productId });
    return { _id: variantId, ...input };
  });
  assert.equal((await request("POST", valid, "", token)).status, 201);
});

test("POST/PATCH từ chối kiểu sai, trường lạ và cập nhật rỗng", async () => {
  const token = authorize();
  const invalid = [null, [], {}, { ...valid, sku: 10 }, { ...valid, size: " " },
    { ...valid, price: "200" }, { ...valid, price: null }, { ...valid, status: "false" },
    { ...valid, stock_quantity: 0.5 }, { ...valid, sale_price: -1 }, { ...valid, product_id: productId }];
  for (const body of invalid) {
    assert.equal((await request("POST", body, "", token)).status, 400, JSON.stringify(body));
  }
  assert.equal((await request("PATCH", {}, `/${variantId}`, token)).status, 400);
  assert.equal((await request("PATCH", { price: "100" }, `/${variantId}`, token)).status, 400);
  assert.equal((await request("PATCH", { price: 100 }, "/invalid", token)).status, 400);
});

test("POST trả 404 cho sản phẩm không tồn tại và 409 cho duplicate key", async () => {
  const token = authorize();
  const lookup = mock.method(Product, "findById", async (): Promise<any> => null);
  assert.equal((await request("POST", valid, "", token)).status, 404);
  lookup.mock.mockImplementation(async () => ({ _id: productId }));
  mock.method(ProductVariant, "create", async () => { throw Object.assign(new Error("duplicate"), { code: 11000 }); });
  assert.equal((await request("POST", valid, "", token)).status, 409);
});

test("PATCH kiểm tra giá sau khi gộp với dữ liệu cũ; cho phép bỏ giá giảm", async () => {
  const token = authorize();
  mock.method(Product, "exists", async () => ({ _id: productId }));
  const doc = new ProductVariant({ ...valid, _id: variantId, product_id: productId, sale_price: 150 });
  mock.method(ProductVariant, "findOne", async (filter: unknown) => {
    assert.deepEqual(filter, { _id: variantId, product_id: productId });
    return doc;
  });
  mock.method(doc, "save", async () => { await doc.validate(); return doc; });
  assert.equal((await request("PATCH", { price: 100 }, `/${variantId}`, token)).status, 400);
  const response = await request("PATCH", { price: 100, sale_price: null, stock_quantity: 0, status: false }, `/${variantId}`, token);
  assert.equal(response.status, 200);
  const { data } = await response.json();
  assert.equal(data.price, 100);
  assert.equal(data.sale_price, null);
  assert.equal(data.stock_quantity, 0);
  assert.equal(data.status, false);
});

test("PATCH/DELETE không thao tác biến thể thuộc sản phẩm khác", async () => {
  const token = authorize();
  mock.method(Product, "exists", async () => ({ _id: productId }));
  mock.method(ProductVariant, "findOne", async (filter: unknown) => {
    assert.deepEqual(filter, { _id: variantId, product_id: productId });
    return null;
  });
  assert.equal((await request("PATCH", { price: 100 }, `/${variantId}`, token)).status, 404);
  assert.equal((await request("DELETE", undefined, `/${variantId}`, token)).status, 404);
});

test("DELETE ngừng bán và giữ bản ghi tham chiếu", async () => {
  const token = authorize();
  mock.method(Product, "exists", async () => ({ _id: productId }));
  const doc = new ProductVariant({ ...valid, _id: variantId, product_id: productId });
  mock.method(ProductVariant, "findOne", async () => doc);
  const save = mock.method(doc, "save", async () => doc);
  const remove = mock.method(ProductVariant, "deleteOne", () => { throw new Error("Không được xóa cứng"); });
  assert.equal((await request("DELETE", undefined, `/${variantId}`, token)).status, 200);
  assert.equal(doc.status, false);
  assert.equal(save.mock.callCount(), 1);
  assert.equal(remove.mock.callCount(), 0);
});

test("PATCH/DELETE trả 404 khi sản phẩm cha không tồn tại", async () => {
  const token = authorize();
  mock.method(Product, "exists", async () => null);
  const lookup = mock.method(ProductVariant, "findOne", () => { throw new Error("Không được tìm biến thể mồ côi"); });
  assert.equal((await request("PATCH", { price: 100 }, `/${variantId}`, token)).status, 404);
  assert.equal((await request("DELETE", undefined, `/${variantId}`, token)).status, 404);
  assert.equal(lookup.mock.callCount(), 0);
});

test("PATCH trả 409 khi trùng khóa hoặc phiên bản đã thay đổi", async () => {
  const token = authorize();
  mock.method(Product, "exists", async () => ({ _id: productId }));
  const doc = new ProductVariant({ ...valid, _id: variantId, product_id: productId });
  mock.method(ProductVariant, "findOne", async () => doc);
  const save = mock.method(doc, "save", async () => { throw Object.assign(new Error("duplicate"), { code: 11000 }); });
  assert.equal((await request("PATCH", { sku: "OTHER" }, `/${variantId}`, token)).status, 409);
  save.mock.mockImplementation(async () => { throw new mongoose.Error.VersionError(doc, 1, ["price"]); });
  assert.equal((await request("PATCH", { price: 100 }, `/${variantId}`, token)).status, 409);
  assert.equal(ProductVariant.schema.options.optimisticConcurrency, true);
});

test("POST kiểm tra schema thật trước khi lưu giá khuyến mãi", async () => {
  const token = authorize();
  mock.method(Product, "findById", async () => ({ _id: productId }));
  mock.method(ProductVariant, "create", async (input: any) => {
    const doc = new ProductVariant(input);
    await doc.validate();
    return doc;
  });
  assert.equal((await request("POST", { ...valid, sale_price: 201 }, "", token)).status, 400);
});

test("lỗi lưu trữ không dự kiến được chuyển cho error handler", async () => {
  mock.method(Product, "findOne", async () => { throw new Error("storage unavailable"); });
  assert.equal((await request("GET")).status, 500);
});
