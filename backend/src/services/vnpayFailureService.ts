import mongoose, { Types } from "mongoose";

import Order from "../models/orderModel.js";
import OrderDetail from "../models/orderDetailModel.js";
import Payment from "../models/paymentModel.js";
import ProductVariant from "../models/productVariantModel.js";
import OrderStatusHistory from "../models/orderStatusHistoryModel.js";

type FailureResult =
  | "cancelled_and_restored"
  | "already_processed"
  | "conflict";

export async function applyVerifiedVNPayFailure(input: {
  paymentId: Types.ObjectId;
  adminId: Types.ObjectId;
}): Promise<FailureResult> {
  return mongoose.connection.transaction(async (session) => {
    // 1. Tìm Payment
    const payment = await Payment.findById(input.paymentId).session(session);

    if (!payment || payment.payment_method !== "VNPay") {
      return "conflict";
    }

    // 2. Tìm Order
    const order = await Order.findById(payment.order_id).session(session);

    if (!order || order.payment_method !== "VNPay") {
      return "conflict";
    }

    // Đã hủy và xử lý thất bại trước đó
    if (
      payment.status === "failed" &&
      order.payment_status === "failed" &&
      order.order_status === "cancelled"
    ) {
      return "already_processed";
    }

    // Không xử lý đơn đã thanh toán hoặc đổi trạng thái
    if (
      payment.status !== "pending" ||
      order.payment_status !== "pending" ||
      order.order_status !== "pending"
    ) {
      return "conflict";
    }

    // 3. Lấy chi tiết đơn hàng
    const details = await OrderDetail.find({
      order_id: order._id,
    }).session(session);

    if (details.length === 0) {
      throw new Error("Không có chi tiết đơn hàng để hoàn tồn kho");
    }

    // 4. Gộp số lượng các dòng cùng một biến thể
    const stockToRestore = new Map<string, number>();

    for (const item of details) {
      if (
        !item.product_variant_id ||
        !Number.isSafeInteger(item.quantity) ||
        item.quantity <= 0
      ) {
        throw new Error("Chi tiết đơn hàng không hợp lệ");
      }

      const variantId = String(item.product_variant_id);

      const quantity = (stockToRestore.get(variantId) ?? 0) + item.quantity;

      if (!Number.isSafeInteger(quantity)) {
        throw new Error("Số lượng hoàn kho không hợp lệ");
      }

      stockToRestore.set(variantId, quantity);
    }

    // 5. Chuyển đơn sang cancelled có điều kiện
    const updatedOrder = await Order.findOneAndUpdate(
      {
        _id: order._id,
        payment_method: "VNPay",
        payment_status: "pending",
        order_status: "pending",
      },
      {
        $set: {
          payment_status: "failed",
          order_status: "cancelled",
        },
      },
      {
        session,
        returnDocument: "after",
        runValidators: true,
      },
    );

    if (!updatedOrder) {
      throw new Error("Order state conflict");
    }

    // 6. Chuyển Payment sang failed
    const updatedPayment = await Payment.findOneAndUpdate(
      {
        _id: payment._id,
        payment_method: "VNPay",
        status: "pending",
      },
      {
        $set: {
          status: "failed",
        },
      },
      {
        session,
        returnDocument: "after",
        runValidators: true,
      },
    );

    if (!updatedPayment) {
      throw new Error("Payment state conflict");
    }

    // 7. Hoàn tồn kho
    for (const [variantId, quantity] of stockToRestore) {
      const result = await ProductVariant.updateOne(
        { _id: variantId },
        {
          $inc: {
            stock_quantity: quantity,
          },
        },
        { session },
      );

      if (result.matchedCount !== 1) {
        throw new Error("Không tìm thấy biến thể để hoàn tồn kho");
      }
    }

    // 8. Ghi lịch sử hủy đơn
    await OrderStatusHistory.create(
      [
        {
          order_id: order._id,
          status: "cancelled",
          note: "Admin đối soát VNPay: giao dịch thất bại",
          changed_by: input.adminId,
        },
      ],
      { session },
    );

    return "cancelled_and_restored";
  });
}
