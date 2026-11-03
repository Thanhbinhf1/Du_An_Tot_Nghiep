import mongoose from "mongoose";
import Order from "../models/orderModel.js";
import Payment from "../models/paymentModel.js";

type SettlementResult = "confirmed" | "already_confirmed" | "conflict";

export async function confirmVNPaySuccess(input: {
  txnRef: string;
  transactionNo: string;
  amount: string;
}): Promise<SettlementResult> {
  if (
    !/^[a-zA-Z0-9]{1,100}$/.test(input.txnRef) ||
    !/^\d{1,15}$/.test(input.transactionNo) ||
    !/^\d+$/.test(input.amount)
  ) {
    return "conflict";
  }

  return mongoose.connection.transaction(async (session) => {
    const payment = await Payment.findOne({
      payment_method: "VNPay",
      transaction_id: input.txnRef,
    }).session(session);

    if (!payment) {
      return "conflict";
    }

    const order = await Order.findById(payment.order_id).session(session);

    if (!order || order.payment_method !== "VNPay") {
      return "conflict";
    }

    if (
      !Number.isSafeInteger(order.final_amount) ||
      !Number.isSafeInteger(order.final_amount * 100) ||
      input.amount !== String(order.final_amount * 100)
    ) {
      return "conflict";
    }

    // Giao dịch đã được ghi nhận thành công trước đó
    if (
      payment.status === "success" &&
      order.payment_status === "success" &&
      order.transaction_id === input.transactionNo
    ) {
      return "already_confirmed";
    }

    // Không xác nhận trạng thái đã thay đổi hoặc đơn đã hủy
    if (
      payment.status !== "pending" ||
      order.payment_status !== "pending" ||
      order.order_status !== "pending"
    ) {
      return "conflict";
    }

    const updatedOrder = await Order.findOneAndUpdate(
      {
        _id: order._id,
        payment_method: "VNPay",
        payment_status: "pending",
        order_status: "pending",
      },
      {
        $set: {
          payment_status: "success",
          transaction_id: input.transactionNo,
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

    const updatedPayment = await Payment.findOneAndUpdate(
      {
        _id: payment._id,
        payment_method: "VNPay",
        status: "pending",
      },
      {
        $set: {
          status: "success",
          paid_at: new Date(),
        },
      },
      {
        session,
        returnDocument: "after",
        runValidators: true,
      },
    );

    if (!updatedPayment) {
      // Lỗi làm transaction rollback cả Order
      throw new Error("Payment state conflict");
    }

    return "confirmed";
  });
}
