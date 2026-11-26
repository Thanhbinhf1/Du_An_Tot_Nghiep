import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { after, afterEach, before, mock, test } from "node:test";
import type { AddressInfo } from "node:net";
import express from "express";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import paymentRoutes from "../src/routes/paymentRoutes.js";
import { errorHandler } from "../src/middlewares/errorMiddleware.js";
import User from "../src/models/userModel.js";
import Order from "../src/models/orderModel.js";
import Payment from "../src/models/paymentModel.js";
import { configuredPaymentMethods } from "../src/config/paymentMethods.js";
import { isMoMoEnabled } from "../src/config/momoConfig.js";
import { createMoMoPayment, verifyMoMoIPNSignature } from "../src/services/momoService.js";

const settings = {
  JWT_SECRET: randomUUID(), MOMO_ENABLED: "true", MOMO_PARTNER_CODE: "OWN_TEST_FIXTURE",
  MOMO_ACCESS_KEY: randomUUID(), MOMO_SECRET_KEY: randomUUID(),
  MOMO_ENDPOINT: "https://test-payment.momo.vn/v2/gateway/api/create",
  MOMO_REDIRECT_URL: "https://shop.example.invalid/api/payments/momo/return",
  MOMO_IPN_URL: "https://shop.example.invalid/api/payments/momo/ipn",
  MOMO_RESULT_PAGE_URL: "https://shop.example.invalid/payment/result",
};
const previous = Object.keys(settings).map((key) => [key, process.env[key]] as const);
const app = express(); app.use(express.json()); app.use("/payments", paymentRoutes); app.use(errorHandler);
const server = app.listen(0, "127.0.0.1");
let base: string;
before(async () => {
  Object.assign(process.env, settings);
  if (!server.listening) await new Promise<void>((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/payments`;
});
afterEach(() => { mock.restoreAll(); Object.assign(process.env, settings); });
after(async () => {
  for (const [key, value] of previous) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test("MoMo bị tắt không mở URL thanh toán cũ hoặc ghi dữ liệu thanh toán mới", async () => {
  process.env.MOMO_ENABLED = "false";
  const user = new User({ name: "Activation fixture", email: "activation@test.invalid", role: "customer" });
  mock.method(User, "findById", async () => user);
  const orderRead = mock.method(Order, "findOne", () => { throw new Error("Disabled checkout must not access orders"); });
  const paymentWrite = mock.method(Payment, "findOneAndUpdate", () => { throw new Error("Disabled checkout must not write"); });
  const token = jwt.sign({ id: String(user._id), role: user.role, sessionVersion: 0 }, settings.JWT_SECRET);
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const methods = await fetch(base + "/methods", { headers });
  assert.ok(!(await methods.json()).data.includes("MoMo"));
  const response = await fetch(base + "/momo/create", { method: "POST", headers, body: JSON.stringify({ order_id: String(new mongoose.Types.ObjectId()) }) });
  assert.equal(response.status, 503);
  assert.match((await response.json()).message, /hoàn tất đăng ký tài khoản MoMo/);
  assert.equal(orderRead.mock.callCount(), 0); assert.equal(paymentWrite.mock.callCount(), 0);
});

test("tắt tạo thanh toán không làm mất xác minh chữ ký IPN đã phát sinh", () => {
  process.env.MOMO_ENABLED = "false";
  const body = { partnerCode: settings.MOMO_PARTNER_CODE, amount: 100000, extraData: "", message: "Success", orderId: randomUUID(), orderInfo: "Fixture", orderType: "momo_wallet", payType: "qr", requestId: randomUUID(), responseTime: Date.now(), resultCode: 0, transId: 12345, signature: "" };
  const raw = [
    `accessKey=${settings.MOMO_ACCESS_KEY}`, `amount=${body.amount}`, `extraData=${body.extraData}`,
    `message=${body.message}`, `orderId=${body.orderId}`, `orderInfo=${body.orderInfo}`, `orderType=${body.orderType}`,
    `partnerCode=${body.partnerCode}`, `payType=${body.payType}`, `requestId=${body.requestId}`,
    `responseTime=${body.responseTime}`, `resultCode=${body.resultCode}`, `transId=${body.transId}`,
  ].join("&");
  body.signature = createHmac("sha256", settings.MOMO_SECRET_KEY).update(raw).digest("hex");
  assert.equal(verifyMoMoIPNSignature(body), true);
  assert.equal(verifyMoMoIPNSignature({ ...body, amount: 1 }), false);
});

test("cờ kích hoạt MoMo hỗ trợ cấu hình cũ và không gọi cổng khi bị tắt", async () => {
  delete process.env.MOMO_ENABLED;
  assert.equal(isMoMoEnabled(), true);
  assert.ok(configuredPaymentMethods().includes("MoMo"));
  process.env.MOMO_ENABLED = "true";
  assert.equal(isMoMoEnabled(), true);
  process.env.MOMO_ENABLED = "false";
  const gateway = mock.method(globalThis, "fetch", async () => { throw new Error("Must not contact gateway"); });
  await assert.rejects(createMoMoPayment({ orderId: randomUUID(), amount: 1000, orderInfo: "Fixture" }), /hoàn tất đăng ký tài khoản MoMo/);
  assert.equal(gateway.mock.callCount(), 0);
});
