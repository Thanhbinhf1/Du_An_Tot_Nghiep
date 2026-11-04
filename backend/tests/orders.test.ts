import assert from "node:assert/strict";
import { after, afterEach, before, mock, test } from "node:test";
import type { AddressInfo } from "node:net";
import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import orderRoutes from "../src/routes/orderRoutes.js";
import Order from "../src/models/orderModel.js";
import OrderDetail from "../src/models/orderDetailModel.js";
import StorefrontProduct from "../src/models/storefrontProductModel.js";
import User from "../src/models/userModel.js";
import { errorHandler } from "../src/middlewares/errorMiddleware.js";

const userId = new mongoose.Types.ObjectId();
const productId = new mongoose.Types.ObjectId();
const app = express();
app.use(express.json());
app.use("/api/orders", orderRoutes);
app.use(errorHandler);
const server = app.listen(0, "127.0.0.1");
let base: string;
const previousSecret = process.env.JWT_SECRET;
const product = {
  _id: productId,
  name: "Áo demo",
  code: "DEMO-01",
  color: "BLACK",
  sizes: ["S", "M"],
  price: 250000,
};

before(async () => {
  if (!server.listening) await new Promise<void>((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/orders`;
  process.env.JWT_SECRET = "order-test-secret";
});
afterEach(() => mock.restoreAll());
after(async () => {
  if (previousSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = previousSecret;
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

function authorize() {
  mock.method(User, "findById", async () => ({
    _id: userId,
    role: "customer",
    is_blocked: false,
  }));
  return jwt.sign({ id: userId.toString(), role: "customer" }, process.env.JWT_SECRET!);
}

function checkoutBody() {
  return {
    items: [{ productId: productId.toString(), size: "M", color: "BLACK", quantity: 2 }],
    receiver: { name: "Khách hàng", phone: "0900000000", address: "Địa chỉ demo" },
    shipping_method: "address",
  };
}

async function request(body: unknown, token?: string) {
  return fetch(base, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
    body: JSON.stringify(body),
  });
}

test("đặt hàng cần đăng nhập và giỏ hàng hợp lệ", async () => {
  assert.equal((await request(checkoutBody())).status, 401);
  const token = authorize();
  assert.equal((await request({ ...checkoutBody(), items: [] }, token)).status, 400);
});

test("POST lưu đơn và snapshot dòng hàng để Admin quản lý", async () => {
  const token = authorize();
  mock.method(StorefrontProduct, "find", () => ({ lean: async () => [product] }));
  mock.method(Order, "create", async (input: Record<string, unknown>) => ({
    ...input,
    _id: new mongoose.Types.ObjectId(),
    created_at: new Date("2026-01-01T00:00:00.000Z"),
    order_status: "pending",
    final_amount: input.final_amount,
    discount_amount: input.discount_amount,
    receiver_name: input.receiver_name,
    receiver_phone: input.receiver_phone,
    shipping_address: input.shipping_address,
    shipping_method: input.shipping_method,
  }));
  let savedDetails: Array<Record<string, unknown>> = [];
  mock.method(OrderDetail, "create", async (details: Array<Record<string, unknown>>) => {
    savedDetails = details;
    return details;
  });

  const response = await request(checkoutBody(), token);
  assert.equal(response.status, 201);
  const result = await response.json();
  assert.equal(result.data.final_amount, 500000);
  assert.equal(result.data.items[0].product_name, "Áo demo");
  assert.equal(savedDetails[0].price_at_buy, 250000);
  assert.equal(savedDetails[0].storefront_product_id.toString(), productId.toString());
});
