import type { Response, NextFunction } from "express";
import mongoose from "mongoose";

import Payment from "../models/paymentModel.js";
import Order from "../models/orderModel.js";
import { getBankConfig } from "../config/bankConfig.js";
import { AppError } from "../middlewares/AppError.js";
import type { AuthRequest } from "../middlewares/authMiddleware.js";

function getValidId(
  value: string | string[] | undefined,
  field: string,
): mongoose.Types.ObjectId {
  if (typeof value !== "string" || !mongoose.isValidObjectId(value)) {
    throw new AppError(`${field} không hợp lệ`, 400);
  }

  return new mongoose.Types.ObjectId(value);
}

export class PaymentController {
  // 1. Tạo yêu cầu chuyển khoản ngân hàng
  // POST /api/payments/bank-transfer
  static async createBankTransfer(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      if (!req.user) {
        throw new AppError("Bạn chưa đăng nhập", 401);
      }

      const userId = req.user._id;
      const orderId = getValidId(req.body?.order_id, "ID đơn hàng");

      // Kiểm tra cấu hình ngân hàng
      const bank = getBankConfig();

      const result = await mongoose.connection.transaction(async (session) => {
        // Chỉ được thanh toán đơn của chính mình
        const order = await Order.findOne({
          _id: orderId,
          user_id: userId,
        }).session(session);

        if (!order) {
          throw new AppError("Không tìm thấy đơn hàng", 404);
        }

        if (order.payment_method !== "BankTransfer") {
          throw new AppError("Đơn hàng không chọn chuyển khoản ngân hàng", 400);
        }

        if (order.payment_status !== "pending") {
          throw new AppError("Đơn hàng không còn chờ thanh toán", 409);
        }

        if (order.order_status !== "pending") {
          throw new AppError(
            "Trạng thái đơn hàng không cho phép tạo thanh toán",
            409,
          );
        }

        // Dùng lại payment đã có, không tạo trùng
        let payment = await Payment.findOne({
          order_id: order._id,
          payment_method: "BankTransfer",
        }).session(session);

        if (payment && payment.status !== "pending") {
          throw new AppError("Yêu cầu thanh toán đã được xử lý", 409);
        }

        if (!payment) {
          const created = await Payment.create(
            [
              {
                order_id: order._id,
                payment_method: "BankTransfer",
                transaction_id: "",
                status: "pending",
                payment_url: "",
              },
            ],
            { session },
          );

          payment = created[0] ?? null;
        }

        if (!payment) {
          throw new AppError("Không thể tạo yêu cầu thanh toán", 500);
        }

        return {
          payment_id: payment._id,
          order_id: order._id,
          amount: order.final_amount,
          payment_method: payment.payment_method,
          payment_status: payment.status,
          bank,
          transfer_content: `FSTYLE ${String(order._id)}`,
        };
      });

      return res.status(200).json({
        status: "success",
        message: "Đã tạo yêu cầu chuyển khoản",
        data: result,
      });
    } catch (error) {
      // Hai request đồng thời có thể tranh chấp unique index
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === 11000
      ) {
        return next(
          new AppError("Yêu cầu thanh toán đã tồn tại, vui lòng tải lại", 409),
        );
      }

      next(error);
    }
  }

  // 2. Xem trạng thái thanh toán theo đơn hàng
  // GET /api/payments/order/:orderId
  static async getPaymentByOrder(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      if (!req.user) {
        throw new AppError("Bạn chưa đăng nhập", 401);
      }

      const orderId = getValidId(req.params.orderId, "ID đơn hàng");

      const order = await Order.findById(orderId).lean();

      if (
        !order ||
        (req.user.role !== "admin" &&
          String(order.user_id) !== String(req.user._id))
      ) {
        throw new AppError("Không tìm thấy đơn hàng", 404);
      }

      const payments = await Payment.find({
        order_id: orderId,
      })
        .sort({ created_at: -1 })
        .lean();

      return res.status(200).json({
        status: "success",
        results: payments.length,
        data: {
          order_id: orderId,
          order_payment_status: order.payment_status,
          payments,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // 3. Admin xác nhận đã nhận tiền
  // PATCH /api/payments/:id/confirm
  static async confirmBankTransfer(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      if (!req.user || req.user.role !== "admin") {
        throw new AppError("Bạn không có quyền Admin", 403);
      }

      const paymentId = getValidId(req.params.id, "ID thanh toán");

      const transactionId = req.body?.transaction_id;

      if (
        typeof transactionId !== "string" ||
        !transactionId.trim() ||
        transactionId.trim().length > 100
      ) {
        throw new AppError("Mã giao dịch không hợp lệ", 400);
      }

      const result = await mongoose.connection.transaction(async (session) => {
        const payment = await Payment.findById(paymentId).session(session);

        if (!payment) {
          throw new AppError("Không tìm thấy thanh toán", 404);
        }

        if (payment.payment_method !== "BankTransfer") {
          throw new AppError("Không phải thanh toán chuyển khoản", 400);
        }

        if (payment.status !== "pending") {
          throw new AppError("Thanh toán đã được xử lý", 409);
        }

        const order = await Order.findOneAndUpdate(
          {
            _id: payment.order_id,
            payment_method: "BankTransfer",
            payment_status: "pending",
            order_status: "pending",
          },
          {
            $set: {
              payment_status: "success",
              transaction_id: transactionId.trim(),
            },
          },
          {
            session,
            returnDocument: "after",
            runValidators: true,
          },
        );

        if (!order) {
          throw new AppError("Đơn hàng không thể xác nhận thanh toán", 409);
        }

        const updatedPayment = await Payment.findOneAndUpdate(
          {
            _id: paymentId,
            status: "pending",
            payment_method: "BankTransfer",
          },
          {
            $set: {
              status: "success",
              transaction_id: transactionId.trim(),
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
          throw new AppError("Trạng thái thanh toán đã thay đổi", 409);
        }

        return {
          payment: updatedPayment,
          order_id: order._id,
          order_payment_status: order.payment_status,
        };
      });

      return res.status(200).json({
        status: "success",
        message: "Xác nhận thanh toán thành công",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}
