import type { Response, NextFunction } from "express";
import mongoose from "mongoose";

import crypto from "node:crypto";
import {
  createVNPayUrl,
  verifyVNPaySignature,
} from "../services/vnpayService.js";
import { getVNPayConfig } from "../config/vnpayConfig.js";
import Payment from "../models/paymentModel.js";
import Order from "../models/orderModel.js";
import { getBankConfig } from "../config/bankConfig.js";
import { AppError } from "../middlewares/AppError.js";
import type { AuthRequest } from "../middlewares/authMiddleware.js";
import { queryVNPayTransaction } from "../services/vnpayQueryService.js";
import { confirmVNPaySuccess } from "../services/vnpaySettlementService.js";
import { applyVerifiedVNPayFailure } from "../services/vnpayFailureService.js";

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

  static async createVNPayPayment(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      if (!req.user) {
        throw new AppError("Bạn chưa đăng nhập", 401);
      }

      const orderId = getValidId(req.body?.order_id, "ID đơn hàng");

      const result = await mongoose.connection.transaction(async (session) => {
        const order = await Order.findOne({
          _id: orderId,
          user_id: req.user!._id,
          payment_method: "VNPay",
        }).session(session);

        if (!order) {
          throw new AppError("Không tìm thấy đơn hàng VNPay", 404);
        }

        if (
          order.payment_status !== "pending" ||
          order.order_status !== "pending"
        ) {
          throw new AppError("Đơn hàng không còn chờ thanh toán", 409);
        }

        const existing = await Payment.findOne({
          order_id: order._id,
          payment_method: "VNPay",
        }).session(session);

        if (existing) {
          if (existing.status !== "pending") {
            throw new AppError("Yêu cầu thanh toán đã được xử lý", 409);
          }

          let expiresAt: Date;

          try {
            const url = new URL(existing.payment_url);
            const expireValue = url.searchParams.get("vnp_ExpireDate");

            if (!expireValue || !/^\d{14}$/.test(expireValue)) {
              throw new Error("Invalid expiry");
            }

            const year = Number(expireValue.slice(0, 4));
            const month = Number(expireValue.slice(4, 6));
            const day = Number(expireValue.slice(6, 8));
            const hour = Number(expireValue.slice(8, 10));
            const minute = Number(expireValue.slice(10, 12));
            const second = Number(expireValue.slice(12, 14));

            // VNPay sử dụng giờ Việt Nam UTC+7
            expiresAt = new Date(
              Date.UTC(year, month - 1, day, hour - 7, minute, second),
            );

            if (
              Number.isNaN(expiresAt.getTime()) ||
              expiresAt.getUTCFullYear() !== year
            ) {
              throw new Error("Invalid expiry");
            }
          } catch {
            throw new AppError(
              "URL thanh toán không hợp lệ, cần kiểm tra giao dịch",
              409,
            );
          }

          if (Date.now() >= expiresAt.getTime()) {
            throw new AppError(
              "URL VNPay đã hết hạn, cần kiểm tra trạng thái giao dịch trước khi thử lại",
              409,
            );
          }

          return {
            payment_id: existing._id,
            order_id: order._id,
            payment_url: existing.payment_url,
            expires_at: expiresAt,
            reused: true,
          };
        }

        const txnRef = crypto.randomBytes(16).toString("hex");

        const vnpay = createVNPayUrl({
          amount: order.final_amount,
          txnRef,
          orderInfo: `Thanh toan don hang ${String(order._id)}`,
          ipAddr: req.ip ?? "127.0.0.1",
        });

        const created = await Payment.create(
          [
            {
              order_id: order._id,
              payment_method: "VNPay",
              transaction_id: txnRef,
              status: "pending",
              payment_url: vnpay.payment_url,
            },
          ],
          { session },
        );

        const payment = created[0];

        if (!payment) {
          throw new AppError("Không thể tạo yêu cầu thanh toán", 500);
        }

        return {
          payment_id: payment._id,
          order_id: order._id,
          payment_url: vnpay.payment_url,
          expires_at: vnpay.expires_at,
          reused: false,
        };
      });

      return res.status(200).json({
        status: "success",
        message: "Đã tạo URL thanh toán VNPay",
        data: result,
      });
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === 11000
      ) {
        return next(
          new AppError("Yêu cầu VNPay đã tồn tại, vui lòng tải lại", 409),
        );
      }

      next(error);
    }
  }

  static async vnpayReturn(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const validSignature = verifyVNPaySignature(
        req.query as Record<string, unknown>,
      );

      if (!validSignature) {
        return res.status(400).json({
          status: "error",
          message: "Chữ ký VNPay không hợp lệ",
        });
      }

      const txnRef = req.query.vnp_TxnRef;

      if (typeof txnRef !== "string") {
        throw new AppError("Mã giao dịch không hợp lệ", 400);
      }

      const payment = await Payment.findOne({
        payment_method: "VNPay",
        transaction_id: txnRef,
      });

      if (!payment) {
        throw new AppError("Không tìm thấy yêu cầu thanh toán", 404);
      }

      const order = await Order.findById(payment.order_id);

      if (!order) {
        throw new AppError("Không tìm thấy đơn hàng", 404);
      }

      const config = getVNPayConfig();

      const validOrder =
        req.query.vnp_TmnCode === config.tmnCode &&
        Number.isSafeInteger(order.final_amount) &&
        String(order.final_amount * 100) === req.query.vnp_Amount;

      if (!validOrder) {
        throw new AppError("Thông tin thanh toán không khớp", 400);
      }

      return res.status(200).json({
        status: "success",
        message: "Đã tiếp nhận kết quả trả về từ VNPay",
        data: {
          order_id: order._id,
          payment_status: payment.status,
          gateway_response_code: req.query.vnp_ResponseCode,
          gateway_transaction_status: req.query.vnp_TransactionStatus,
          note: "Kết quả trả về không thay thế xác nhận IPN",
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async vnpayIPN(req: AuthRequest, res: Response) {
    const reply = (code: string, message: string) =>
      res.status(200).json({
        RspCode: code,
        Message: message,
      });

    try {
      const query = req.query as Record<string, unknown>;

      // 1. Kiểm tra chữ ký VNPay
      if (!verifyVNPaySignature(query)) {
        return reply("97", "Invalid checksum");
      }

      const {
        vnp_TmnCode,
        vnp_TxnRef,
        vnp_Amount,
        vnp_ResponseCode,
        vnp_TransactionStatus,
        vnp_TransactionNo,
      } = query;

      const config = getVNPayConfig();

      // 2. Kiểm tra dữ liệu bắt buộc
      if (
        vnp_TmnCode !== config.tmnCode ||
        typeof vnp_TxnRef !== "string" ||
        typeof vnp_Amount !== "string" ||
        typeof vnp_ResponseCode !== "string" ||
        typeof vnp_TransactionStatus !== "string"
      ) {
        return reply("97", "Invalid payment data");
      }

      // 3. Tìm payment theo mã tham chiếu
      const payment = await Payment.findOne({
        payment_method: "VNPay",
        transaction_id: vnp_TxnRef,
      });

      if (!payment) {
        return reply("01", "Order not found");
      }

      // 4. Kiểm tra đơn hàng
      const order = await Order.findById(payment.order_id);

      if (!order || order.payment_method !== "VNPay") {
        return reply("01", "Order not found");
      }

      // 5. Đối chiếu số tiền
      if (
        !Number.isSafeInteger(order.final_amount) ||
        order.final_amount <= 0 ||
        !Number.isSafeInteger(order.final_amount * 100) ||
        vnp_Amount !== String(order.final_amount * 100)
      ) {
        return reply("04", "Invalid amount");
      }

      // 6. Kiểm tra kết quả thanh toán
      const isSuccess =
        vnp_ResponseCode === "00" && vnp_TransactionStatus === "00";

      if (!isSuccess) {
        // Tạm thời chưa tự động cập nhật failed hoặc hoàn kho.
        // Cần hoàn thiện nhánh xử lý thất bại bằng transaction.
        console.warn("VNPay requires reconciliation", {
          txnRef: vnp_TxnRef,
          responseCode: vnp_ResponseCode,
          transactionStatus: vnp_TransactionStatus,
        });

        return reply("99", "Payment requires reconciliation");
      }

      // 7. Kiểm tra mã giao dịch VNPay
      if (
        typeof vnp_TransactionNo !== "string" ||
        !/^\d{1,15}$/.test(vnp_TransactionNo)
      ) {
        return reply("97", "Invalid transaction number");
      }

      // 8. Xác nhận thanh toán bằng Service dùng chung
      const result = await confirmVNPaySuccess({
        txnRef: vnp_TxnRef,
        transactionNo: vnp_TransactionNo,
        amount: vnp_Amount,
      });

      if (result === "confirmed") {
        return reply("00", "Confirm Success");
      }

      if (result === "already_confirmed") {
        return reply("02", "Order already confirmed");
      }

      // Đơn đã hủy hoặc trạng thái không khớp:
      // cần kiểm tra thủ công, đặc biệt nếu khách đã bị trừ tiền.
      return reply("99", "Payment state conflict");
    } catch (error) {
      console.error("VNPay IPN error:", error);
      return reply("99", "Unknown error");
    }
  }

  static async reconcileVNPayPayment(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      // Chỉ Admin được đối soát
      if (!req.user || req.user.role !== "admin") {
        throw new AppError("Không có quyền truy cập", 403);
      }

      const paymentId = getValidId(req.params.id, "ID thanh toán");

      const payment = await Payment.findById(paymentId);

      if (!payment || payment.payment_method !== "VNPay") {
        throw new AppError("Không tìm thấy thanh toán VNPay", 404);
      }

      const order = await Order.findById(payment.order_id);

      if (!order || order.payment_method !== "VNPay") {
        throw new AppError("Không tìm thấy đơn hàng VNPay", 404);
      }

      if (
        !Number.isSafeInteger(order.final_amount) ||
        order.final_amount <= 0 ||
        !Number.isSafeInteger(order.final_amount * 100)
      ) {
        throw new AppError("Số tiền đơn hàng không hợp lệ", 409);
      }

      // Lấy ngày tạo giao dịch từ URL VNPay đã lưu
      let transactionDate: string;

      try {
        const url = new URL(payment.payment_url);
        const date = url.searchParams.get("vnp_CreateDate");

        if (!date || !/^\d{14}$/.test(date)) {
          throw new Error("Invalid date");
        }

        transactionDate = date;
      } catch {
        throw new AppError("Không đọc được ngày tạo giao dịch VNPay", 409);
      }

      // Service đã kiểm tra chữ ký phản hồi VNPay
      const result = await queryVNPayTransaction({
        txnRef: payment.transaction_id,
        transactionDate,
      });

      const amountMatches = result.amount === String(order.final_amount * 100);

      if (!amountMatches) {
        throw new AppError("Số tiền đối soát không khớp đơn hàng", 409);
      }

      let conclusion = "unknown";

      if (result.responseCode === "00" && result.transactionStatus === "00") {
        conclusion = "gateway_success";
      } else if (
        result.responseCode === "00" &&
        result.transactionStatus === "01"
      ) {
        conclusion = "gateway_incomplete";
      } else if (
        result.responseCode === "00" &&
        result.transactionStatus === "02"
      ) {
        conclusion = "gateway_failed";
      }

      return res.status(200).json({
        status: "success",
        message: "Đã truy vấn kết quả VNPay",
        data: {
          payment_id: payment._id,
          order_id: order._id,
          local_payment_status: payment.status,
          order_payment_status: order.payment_status,
          gateway_response_code: result.responseCode,
          gateway_transaction_status: result.transactionStatus,
          gateway_transaction_no: result.transactionNo,
          conclusion,
          database_updated: false,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async resolveVNPayFailure(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      if (!req.user || req.user.role !== "admin") {
        throw new AppError("Không có quyền Admin", 403);
      }

      const paymentId = getValidId(req.params.id, "ID thanh toán");

      const payment = await Payment.findById(paymentId);

      if (!payment || payment.payment_method !== "VNPay") {
        throw new AppError("Không tìm thấy thanh toán VNPay", 404);
      }

      const order = await Order.findById(payment.order_id);

      if (!order || order.payment_method !== "VNPay") {
        throw new AppError("Không tìm thấy đơn hàng VNPay", 404);
      }

      // Đọc ngày giao dịch từ URL đã lưu
      let transactionDate: string;

      try {
        const url = new URL(payment.payment_url);
        const date = url.searchParams.get("vnp_CreateDate");

        if (!date || !/^\d{14}$/.test(date)) {
          throw new Error("Invalid transaction date");
        }

        transactionDate = date;
      } catch {
        throw new AppError("Thông tin giao dịch VNPay không hợp lệ", 409);
      }

      // Truy vấn lại VNPay ngay trước khi xử lý
      // Hàm này phải xác minh chữ ký phản hồi.
      const result = await queryVNPayTransaction({
        txnRef: payment.transaction_id,
        transactionDate,
      });

      if (
        !Number.isSafeInteger(order.final_amount) ||
        order.final_amount <= 0 ||
        !Number.isSafeInteger(order.final_amount * 100) ||
        result.amount !== String(order.final_amount * 100)
      ) {
        throw new AppError("Số tiền đối soát không khớp", 409);
      }

      // QueryDR thành công và giao dịch được báo lỗi.
      // Những trạng thái chưa rõ không được tự hủy.
      if (result.responseCode !== "00" || result.transactionStatus !== "02") {
        throw new AppError("Chưa xác nhận được giao dịch thất bại", 409);
      }

      const outcome = await applyVerifiedVNPayFailure({
        paymentId,
        adminId: req.user._id,
      });

      if (outcome === "conflict") {
        throw new AppError(
          "Trạng thái đơn hàng hoặc thanh toán đã thay đổi",
          409,
        );
      }

      return res.status(200).json({
        status: "success",
        message:
          outcome === "already_processed"
            ? "Giao dịch đã được xử lý trước đó"
            : "Đã hủy đơn và hoàn tồn kho",
        data: {
          payment_id: paymentId,
          order_id: order._id,
          outcome,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}
