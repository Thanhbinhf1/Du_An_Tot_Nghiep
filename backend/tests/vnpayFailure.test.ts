import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import mongoose, { Types } from "mongoose";

import Order from "../src/models/orderModel.js";
import Payment from "../src/models/paymentModel.js";
import OrderDetail from "../src/models/orderDetailModel.js";
import ProductVariant from "../src/models/productVariantModel.js";
import OrderStatusHistory from "../src/models/orderStatusHistoryModel.js";

import { applyVerifiedVNPayFailure } from "../src/services/vnpayFailureService.js";

const orderId = new Types.ObjectId();
const paymentId = new Types.ObjectId();
const adminId = new Types.ObjectId();
const variantId = new Types.ObjectId();

const input = {
  paymentId,
  adminId,
};

function query<T>(value: T) {
  return {
    session: async () => value,
  };
}

function setup(
  t: TestContext,
  options: {
    paymentStatus?: "pending" | "success" | "failed";
    orderPaymentStatus?: "pending" | "success" | "failed";
    orderStatus?: "pending" | "cancelled";
    quantity?: number;
  } = {},
) {
  const {
    paymentStatus = "pending",
    orderPaymentStatus = "pending",
    orderStatus = "pending",
    quantity = 2,
  } = options;

  // Mock transaction để không truy cập MongoDB thật.
  t.mock.method(mongoose.connection, "transaction", (async (
    callback: (session: mongoose.ClientSession) => Promise<unknown>,
  ) => {
    return callback({} as mongoose.ClientSession);
  }) as typeof mongoose.connection.transaction);

  t.mock.method(Payment, "findById", (() =>
    query({
      _id: paymentId,
      order_id: orderId,
      payment_method: "VNPay",
      status: paymentStatus,
    })) as unknown as typeof Payment.findById);

  t.mock.method(Order, "findById", (() =>
    query({
      _id: orderId,
      payment_method: "VNPay",
      payment_status: orderPaymentStatus,
      order_status: orderStatus,
    })) as unknown as typeof Order.findById);

  t.mock.method(OrderDetail, "find", (() =>
    query([
      {
        order_id: orderId,
        product_variant_id: variantId,
        quantity,
      },
    ])) as unknown as typeof OrderDetail.find);
}

// TEST 1: Giao dịch thất bại, hoàn kho thành công.
test("VNPay thất bại: hủy đơn và hoàn tồn kho", async (t) => {
  setup(t);

  let orderUpdated = false;
  let paymentUpdated = false;
  let restoredQuantity = 0;
  let historyCreated = false;

  t.mock.method(Order, "findOneAndUpdate", (async () => {
    orderUpdated = true;
    return { _id: orderId };
  }) as unknown as typeof Order.findOneAndUpdate);

  t.mock.method(Payment, "findOneAndUpdate", (async () => {
    paymentUpdated = true;
    return { _id: paymentId };
  }) as unknown as typeof Payment.findOneAndUpdate);

  t.mock.method(ProductVariant, "updateOne", (async (
    _filter: unknown,
    update: {
      $inc: { stock_quantity: number };
    },
  ) => {
    restoredQuantity += update.$inc.stock_quantity;
    return { matchedCount: 1 };
  }) as unknown as typeof ProductVariant.updateOne);

  t.mock.method(OrderStatusHistory, "create", (async () => {
    historyCreated = true;
    return [];
  }) as unknown as typeof OrderStatusHistory.create);

  const result = await applyVerifiedVNPayFailure(input);

  assert.equal(result, "cancelled_and_restored");
  assert.equal(orderUpdated, true);
  assert.equal(paymentUpdated, true);
  assert.equal(restoredQuantity, 2);
  assert.equal(historyCreated, true);
});

// TEST 2: Giao dịch đã xử lý, không hoàn kho tiếp.
test("VNPay không hoàn kho lần hai", async (t) => {
  setup(t, {
    paymentStatus: "failed",
    orderPaymentStatus: "failed",
    orderStatus: "cancelled",
  });

  let stockUpdateCalled = false;

  t.mock.method(ProductVariant, "updateOne", (async () => {
    stockUpdateCalled = true;
    return { matchedCount: 1 };
  }) as unknown as typeof ProductVariant.updateOne);

  const result = await applyVerifiedVNPayFailure(input);

  assert.equal(result, "already_processed");
  assert.equal(stockUpdateCalled, false);
});

// TEST 3: Đơn thanh toán thành công không được hủy.
test("VNPay không hủy đơn đã thanh toán", async (t) => {
  setup(t, {
    paymentStatus: "success",
    orderPaymentStatus: "success",
  });

  const result = await applyVerifiedVNPayFailure(input);

  assert.equal(result, "conflict");
});

// TEST 4: Số lượng sản phẩm không hợp lệ.
test("VNPay từ chối chi tiết đơn không hợp lệ", async (t) => {
  setup(t, { quantity: -2 });

  await assert.rejects(
    applyVerifiedVNPayFailure(input),
    /Chi tiết đơn hàng không hợp lệ/,
  );
});

// TEST 5: Cập nhật tồn kho lỗi thì Service phải báo lỗi.
// TEST 5: Cập nhật tồn kho lỗi thì Service phải báo lỗi.
test("VNPay báo lỗi nếu không thể hoàn tồn kho", async (t) => {
  setup(t);

  const mockOrderUpdate = async () => ({
    _id: orderId,
  });

  const mockPaymentUpdate = async () => ({
    _id: paymentId,
  });

  const mockStockUpdate = async () => ({
    matchedCount: 0,
  });

  t.mock.method(
    Order,
    "findOneAndUpdate",
    mockOrderUpdate as unknown as typeof Order.findOneAndUpdate,
  );

  t.mock.method(
    Payment,
    "findOneAndUpdate",
    mockPaymentUpdate as unknown as typeof Payment.findOneAndUpdate,
  );

  t.mock.method(
    ProductVariant,
    "updateOne",
    mockStockUpdate as unknown as typeof ProductVariant.updateOne,
  );

  await assert.rejects(
    applyVerifiedVNPayFailure(input),
    /Không tìm thấy biến thể để hoàn tồn kho/,
  );
});
