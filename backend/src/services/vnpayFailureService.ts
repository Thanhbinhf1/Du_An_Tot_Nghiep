import mongoose, { Types } from "mongoose";

import Order from "../models/orderModel.js";
import OrderDetail from "../models/orderDetailModel.js";
import Payment from "../models/paymentModel.js";
import OrderStatusHistory from "../models/orderStatusHistoryModel.js";
import { restoreCouponUse } from "./checkoutPricing.js";
import { restoreOrderStock } from "./orderStock.js";

type FailureResult =
  | "cancelled_and_restored"
  | "failed_after_cancellation"
  | "already_processed"
  | "conflict";

export async function applyVerifiedVNPayFailure(input: {
  paymentId: Types.ObjectId;
  adminId: Types.ObjectId;
}): Promise<FailureResult> {
  return applyVerifiedPaymentFailure({
    paymentId: input.paymentId,
    method: "VNPay",
    note: "Admin đối soát VNPay: giao dịch thất bại",
    changedBy: input.adminId,
  });
}

export async function applyVerifiedPaymentFailure(input: {
  paymentId: Types.ObjectId;
  method: "MoMo" | "VNPay";
  note: string;
  changedBy?: Types.ObjectId;
}): Promise<FailureResult> {
  return mongoose.connection.transaction(async (session) => {
    // 1. Tìm Payment
    const payment = await Payment.findById(input.paymentId).session(session);

    if (!payment || payment.payment_method !== input.method) {
      return "conflict";
    }

    // 2. Tìm Order
    const order = await Order.findById(payment.order_id).session(session);

    if (!order || order.payment_method !== input.method) {
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

    const previouslyCancelled = order.order_status === "cancelled";
    if (
      payment.status !== "pending" ||
      order.payment_status !== "pending" ||
      (order.order_status !== "pending" && !previouslyCancelled)
    ) {
      return "conflict";
    }

    if (!previouslyCancelled) {
      const details = await OrderDetail.find({ order_id: order._id }).session(session);
      if (!details.length) throw new Error("Không có chi tiết đơn hàng để hoàn tồn kho");
      await restoreOrderStock(details, session, false);
    }

    // 5. Chuyển đơn sang cancelled có điều kiện
    const updatedOrder = await Order.findOneAndUpdate(
      {
        _id: order._id,
        payment_method: input.method,
        payment_status: "pending",
        order_status: order.order_status,
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
        payment_method: input.method,
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

    if (!previouslyCancelled) await restoreCouponUse(order.coupon_id, session);

    // 8. Ghi lịch sử hủy đơn
    await OrderStatusHistory.create(
      [
        {
          order_id: order._id,
          status: "cancelled" as const,
          note: input.note,
          ...(input.changedBy ? { changed_by: input.changedBy } : {}),
        },
      ],
      { session },
    );

    return previouslyCancelled ? "failed_after_cancellation" : "cancelled_and_restored";
  });
}
