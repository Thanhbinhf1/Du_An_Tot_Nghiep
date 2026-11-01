import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { after, before, test } from "node:test";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import express from "express";
import mongoose from "mongoose";
import authRoutes from "../src/routes/authRoutes.js";
import productRoutes from "../src/routes/productRoutes.js";
import { errorHandler, notFound } from "../src/middlewares/errorMiddleware.js";
import User from "../src/models/userModel.js";
import Category from "../src/models/categoryModel.js";
import Brand from "../src/models/brandModel.js";
import Product from "../src/models/productModel.js";
import ProductVariant from "../src/models/productVariantModel.js";

dotenv.config({ quiet: true });
const databaseName = `pv_test_${randomUUID().replaceAll("-", "").slice(0, 24)}`;
const previousSecret = process.env.JWT_SECRET;
const password = randomUUID();
let connected = false;
let server: Server | undefined;
let base: string;
let token: string;
let customerToken: string;
let productId: string;
let otherProductId: string;
let variantId: string;
let secondVariantId: string;
const valid = { sku: " test-m-black ", size: " M ", color: " Đen ", price: 250000, sale_price: 220000, stock_quantity: 10 };

before(async () => {
  const uri = process.env.DATABASE ?? process.env.DATABASE_URL;
  assert.ok(uri, "Cần cấu hình DATABASE hoặc DATABASE_URL trong backend/.env");
  // Luôn ghi đè database trong URI; không dùng database ứng dụng.
  try {
    await mongoose.connect(uri, { dbName: databaseName, serverSelectionTimeoutMS: 10000, autoIndex: false, autoCreate: false });
    connected = true;
  } catch (error) {
    // Không đưa URI/thông tin xác thực vào log của test.
    throw new Error(`Không kết nối được MongoDB (${error instanceof Error ? error.name : "unknown"})`);
  }
  assert.equal(mongoose.connection.name, databaseName);
  await Promise.all([User, Category, Brand, Product, ProductVariant].map((model) => model.createIndexes()));
  process.env.JWT_SECRET = randomUUID();
  await User.create({ name: "Integration Admin", email: "admin@variant-test.invalid", password: await bcrypt.hash(password, 10), role: "admin" });

  const app = express();
  app.use(express.json());
  app.use("/api/auth", authRoutes);
  app.use("/api/products", productRoutes);
  app.use(notFound);
  app.use(errorHandler);
  server = app.listen(0, "127.0.0.1");
  if (!server.listening) await new Promise<void>((resolve) => server!.once("listening", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});

after(async () => {
  try {
    if (server) {
      await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve()));
    }
    if (connected) {
      // Chỉ dọn đúng database ngẫu nhiên do lần chạy này tạo ra.
      assert.match(databaseName, /^pv_test_[a-f0-9]{24}$/);
      assert.equal(mongoose.connection.name, databaseName);
      await mongoose.connection.dropDatabase();
      console.log("Đã dọn database kiểm thử riêng.");
    }
  } finally {
    await mongoose.disconnect();
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  }
});

async function request(method: string, path: string, body?: unknown, authToken?: string) {
  const response = await fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json", ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(15000),
  });
  const result = await response.json();
  return { status: response.status, body: result };
}
const variantsPath = () => `/products/${productId}/variants`;

test("Product Variants: HTTP + xác thực + MongoDB thật", async (t) => {
  await t.test("đăng nhập admin thật và đăng ký khách hàng", async () => {
    const login = await request("POST", "/auth/login", { email: "admin@variant-test.invalid", password });
    assert.equal(login.status, 200);
    assert.equal(login.body.data.role, "admin");
    token = login.body.data.token;
    assert.equal(typeof token, "string");
    const register = await request("POST", "/auth/register", { name: "Integration Customer", email: "customer@variant-test.invalid", password });
    assert.equal(register.status, 201);
    customerToken = register.body.data.token;
  });

  await t.test("tạo sản phẩm qua API với danh mục và thương hiệu riêng", async () => {
    const category = await Category.create({ name: "Test Category", slug: "test-category" });
    const brand = await Brand.create({ name: "Test Brand", slug: "test-brand" });
    for (const slug of ["test-shirt", "other-shirt"]) {
      const response = await request("POST", "/products", {
        category_id: category.id, brand_id: brand.id, name: slug, slug,
      }, token);
      assert.equal(response.status, 201);
      if (slug === "test-shirt") productId = response.body.data._id;
      else otherProductId = response.body.data._id;
    }
  });

  await t.test("chặn khách chưa đăng nhập và khách không có quyền", async () => {
    for (const path of ["/products/admin", `${variantsPath()}/admin`]) {
      assert.equal((await request("GET", path)).status, 401);
      assert.equal((await request("GET", path, undefined, customerToken)).status, 403);
    }
    for (const method of ["POST", "PATCH", "DELETE"]) {
      const path = variantsPath() + (method === "POST" ? "" : `/${new mongoose.Types.ObjectId()}`);
      assert.equal((await request(method, path, valid)).status, 401);
      assert.equal((await request(method, path, valid, customerToken)).status, 403);
    }
  });

  await t.test("thêm biến thể, chuẩn hóa dữ liệu và lưu MongoDB", async () => {
    const response = await request("POST", variantsPath(), valid, token);
    assert.equal(response.status, 201);
    variantId = response.body.data._id;
    const saved = await ProductVariant.findById(variantId).lean();
    assert.ok(saved);
    assert.equal(saved.sku, "TEST-M-BLACK");
    assert.equal(saved.size, "M");
    assert.equal(saved.color, "Đen");
    assert.equal(saved.stock_quantity, 10);
    const list = await request("GET", variantsPath());
    assert.equal(list.status, 200);
    assert.equal(list.body.data.length, 1);
  });

  await t.test("unique index chặn SKU toàn cục và tổ hợp size/màu", async () => {
    assert.equal((await request("POST", `/products/${otherProductId}/variants`, valid, token)).status, 409);
    assert.equal((await request("POST", variantsPath(), { ...valid, sku: "OTHER-SKU" }, token)).status, 409);
    const response = await request("POST", variantsPath(), { ...valid, sku: "TEST-L-BLACK", size: "L" }, token);
    assert.equal(response.status, 201);
    secondVariantId = response.body.data._id;
    assert.equal((await request("PATCH", `${variantsPath()}/${secondVariantId}`, { size: "M" }, token)).status, 409);
    assert.equal((await ProductVariant.findById(secondVariantId))?.size, "L");
  });

  await t.test("hai request thêm cùng SKU chỉ một request thành công", async () => {
    const input = { ...valid, sku: "RACE-SKU", size: "XL" };
    const responses = await Promise.all([request("POST", variantsPath(), input, token), request("POST", variantsPath(), input, token)]);
    assert.deepEqual(responses.map((response) => response.status).sort(), [201, 409]);
    assert.equal(await ProductVariant.countDocuments({ sku: "RACE-SKU" }), 1);
  });

  await t.test("từ chối giá/tồn kho sai và không lưu thay đổi khi lỗi", async () => {
    for (const input of [{ price: -1 }, { stock_quantity: 1.5 }, { sale_price: 260000 }, { price: 200000 }, { product_id: otherProductId }]) {
      assert.equal((await request("PATCH", `${variantsPath()}/${variantId}`, input, token)).status, 400, JSON.stringify(input));
    }
    const saved = await ProductVariant.findById(variantId);
    assert.equal(saved?.price, 250000);
    assert.equal(saved?.sale_price, 220000);
    assert.equal(saved?.stock_quantity, 10);
    assert.equal((await request("POST", variantsPath(), { ...valid, sku: "INVALID-PRICE", size: "XXL", sale_price: 260000 }, token)).status, 400);
  });

  await t.test("sửa giá, bỏ giá khuyến mãi và cho tồn kho bằng 0", async () => {
    const response = await request("PATCH", `${variantsPath()}/${variantId}`, { price: 200000, sale_price: null, stock_quantity: 0 }, token);
    assert.equal(response.status, 200);
    const saved = await ProductVariant.findById(variantId);
    assert.equal(saved?.price, 200000);
    assert.equal(saved?.sale_price, null);
    assert.equal(saved?.stock_quantity, 0);
  });

  await t.test("biến thể không thuộc sản phẩm và ID không hợp lệ", async () => {
    const wrongPath = `/products/${otherProductId}/variants/${variantId}`;
    assert.equal((await request("PATCH", wrongPath, { price: 100 }, token)).status, 404);
    assert.equal((await request("DELETE", wrongPath, undefined, token)).status, 404);
    assert.equal((await request("GET", "/products/invalid/variants")).status, 400);
    assert.equal((await request("PATCH", `${variantsPath()}/invalid`, { price: 100 }, token)).status, 400);
  });

  await t.test("DELETE ẩn biến thể khỏi danh sách và chi tiết; PATCH bật bán lại", async () => {
    assert.equal((await request("DELETE", `${variantsPath()}/${variantId}`, undefined, token)).status, 200);
    assert.equal((await ProductVariant.findById(variantId))?.status, false);
    const adminList = await request("GET", `${variantsPath()}/admin`, undefined, token);
    assert.equal(adminList.status, 200);
    assert.equal(adminList.body.data.find((variant: { _id: string }) => variant._id === variantId)?.status, false);
    const list = await request("GET", variantsPath());
    assert.ok(!list.body.data.some((variant: { _id: string }) => variant._id === variantId));
    const detail = await request("GET", `/products/${productId}`);
    assert.equal(detail.status, 200);
    assert.ok(!detail.body.data.variants.some((variant: { _id: string }) => variant._id === variantId));
    assert.equal((await request("PATCH", `${variantsPath()}/${variantId}`, { status: true }, token)).status, 200);
    assert.equal((await ProductVariant.findById(variantId))?.status, true);
  });

  await t.test("phiên bản MongoDB chặn ghi đè dữ liệu đã được người khác sửa", async () => {
    const first = await ProductVariant.findById(variantId);
    const second = await ProductVariant.findById(variantId);
    assert.ok(first && second);
    first.stock_quantity = 3;
    await first.save();
    second.stock_quantity = 4;
    await assert.rejects(second.save(), mongoose.Error.VersionError);
    assert.equal((await ProductVariant.findById(variantId))?.stock_quantity, 3);
  });

  await t.test("admin vẫn quản lý được sản phẩm đã tắt và danh sách có phân trang", async () => {
    await Product.findByIdAndUpdate(productId, { status: false });
    assert.equal((await request("GET", variantsPath())).status, 404);
    const adminList = await request("GET", "/products/admin?limit=1&page=1", undefined, token);
    assert.equal(adminList.status, 200);
    assert.equal(adminList.body.data.length, 1);
    assert.equal(adminList.body.pagination.total, 2);
    assert.equal(adminList.body.pagination.totalPages, 2);
    const allProducts = await request("GET", "/products/admin?limit=25", undefined, token);
    assert.equal(allProducts.body.data.find((product: { _id: string }) => product._id === productId)?.status, false);
    const variants = await request("GET", `${variantsPath()}/admin`, undefined, token);
    assert.equal(variants.status, 200);
    assert.ok(variants.body.data.length > 0);
    assert.equal((await request("GET", "/products/admin?page=Infinity", undefined, token)).status, 400);
  });
});
