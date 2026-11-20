import type { Request, Response } from "express";
import mongoose from "mongoose";
import { AppError } from "../middlewares/AppError.js";
import type { AuthRequest } from "../middlewares/authMiddleware.js";
import Order from "../models/orderModel.js";
import { createSePayCheckout, receiveSePayWebhook, reconcileSePayOrder } from "../services/sepayService.js";

async function findOrder(req: AuthRequest, id: unknown, allowAdmin = false) {
  if (!req.user) throw new AppError("Bạn chưa đăng nhập.", 401);
  if (typeof id !== "string" || !mongoose.isValidObjectId(id)) {
    throw new AppError("Mã đơn hàng không hợp lệ.", 400);
  }
  const order = await Order.findById(id);
  if (!order || (String(order.user_id) !== String(req.user._id) && !(allowAdmin && req.user.role === "admin"))) {
    throw new AppError("Không tìm thấy đơn hàng.", 404);
  }
  if (order.payment_method !== "SePay") throw new AppError("Đơn hàng này không dùng SePay.", 400);
  return order;
}

export class SePayController {
  static async create(req: AuthRequest, res: Response) {
    const order = await findOrder(req, req.body?.order_id);
    if (order.order_status !== "pending" || order.payment_status !== "pending") {
      throw new AppError("Đơn hàng không còn chờ thanh toán.", 409);
    }
    res.json({ status: "success", data: await createSePayCheckout(order) });
  }

  static async reconcile(req: AuthRequest, res: Response) {
    const order = await findOrder(req, req.params.orderId, true);
    await reconcileSePayOrder(order);
    res.json({ status: "success" });
  }

  static async webhook(req: Request, res: Response) {
    await receiveSePayWebhook(req.get("Authorization"), req.body);
    res.json({ success: true });
  }
}
