import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import mongoose, { Types } from "mongoose";

import Order from "../src/models/orderModel.js";
import Payment from "../src/models/paymentModel.js";
import { confirmVNPaySuccess } from "../src/services/vnpaySettlementService.js";

const orderId = new Types.ObjectId();
const paymentId = new Types.ObjectId();

const input = {
  txnRef: "TESTVN123456",
  transactionNo: "123456789",
  amount: "25000000",
};

// Mock MongoDB transaction: không kết nối database thật.
function mockTransaction(t: TestContext) {
  const fakeTransaction = async (
    callback: (session: mongoose.ClientSession) => Promise<unknown>,
  ) => callback({} as mongoose.ClientSession);

  t.mock.method(
    mongoose.connection,
    "transaction",
    fakeTransaction as typeof mongoose.connection.transaction,
  );
}

// Giả lập các câu truy vấn Mongoose có .session()
function sessionQuery<T>(value: T) {
  return {
    session: async () => value,
  };
}

function mockFinds(
  t: TestContext,
  paymentStatus: "pending" | "success" | "failed",
  orderPaymentStatus: "pending" | "success" | "failed",
  orderStatus: "pending" | "cancelled" = "pending",
) {
  const payment = {
    _id: paymentId,
    order_id: orderId,
    payment_method: "VNPay",
    transaction_id: input.txnRef,
    status: paymentStatus,
  };

  const order = {
    _id: orderId,
    payment_method: "VNPay",
    payment_status: orderPaymentStatus,
    order_status: orderStatus,
    final_amount: 250000,
    transaction_id: orderPaymentStatus === "success" ? input.transactionNo : "",
  };

  t.mock.method(Payment, "findOne", (() =>
    sessionQuery(payment)) as unknown as typeof Payment.findOne);

  t.mock.method(Order, "findById", (() =>
    sessionQuery(order)) as unknown as typeof Order.findById);
}

// TEST 1: Xác nhận thành công
test("VNPay cập nhật Order và Payment thành công", async (t) => {
  mockTransaction(t);
  mockFinds(t, "pending", "pending");

  let updatedOrder = false;
  let updatedPayment = false;

  t.mock.method(Order, "findOneAndUpdate", (() => {
    updatedOrder = true;
    return Promise.resolve({ _id: orderId });
  }) as unknown as typeof Order.findOneAndUpdate);

  t.mock.method(Payment, "findOneAndUpdate", (() => {
    updatedPayment = true;
    return Promise.resolve({ _id: paymentId });
  }) as unknown as typeof Payment.findOneAndUpdate);

  const result = await confirmVNPaySuccess(input);

  assert.equal(result, "confirmed");
  assert.equal(updatedOrder, true);
  assert.equal(updatedPayment, true);
});

// TEST 2: Không xác nhận lần hai
test("VNPay từ chối xác nhận trùng", async (t) => {
  mockTransaction(t);
  mockFinds(t, "success", "success");

  const result = await confirmVNPaySuccess(input);

  assert.equal(result, "already_confirmed");
});

// TEST 3: Sai số tiền
test("VNPay từ chối số tiền không khớp", async (t) => {
  mockTransaction(t);
  mockFinds(t, "pending", "pending");

  const result = await confirmVNPaySuccess({
    ...input,
    amount: "99999900",
  });

  assert.equal(result, "conflict");
});

// TEST 4: Không xác nhận đơn đã hủy
test("VNPay không xác nhận đơn đã hủy", async (t) => {
  mockTransaction(t);
  mockFinds(t, "pending", "pending", "cancelled");

  const result = await confirmVNPaySuccess(input);

  assert.equal(result, "conflict");
});
