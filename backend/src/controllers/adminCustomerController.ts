import type { Response, NextFunction } from "express";
import mongoose from "mongoose";
import User from "../models/userModel.js";
import Order from "../models/orderModel.js";
import OrderDetail from "../models/orderDetailModel.js";
import { AppError } from "../middlewares/AppError.js";
import type { AuthRequest } from "../middlewares/authMiddleware.js";
import { literalSearch, readPagination, paginationMetadata } from "../services/listQuery.js";

function validId(req: AuthRequest) {
  if (typeof req.params.id !== "string" || !mongoose.isObjectIdOrHexString(req.params.id)) throw new AppError("Mã khách hàng không hợp lệ.", 400);
  return req.params.id;
}

export class AdminCustomerController {
  static async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { page, limit, skip } = readPagination(req.query, 25);
      const search = literalSearch(req.query.search);
      const filter: Record<string, unknown> = {};
      if (req.user?.role !== "admin") filter.role = "customer";
      else if (req.query.role && req.query.role !== "all") {
        if (typeof req.query.role !== "string" || !["customer", "staff", "admin"].includes(req.query.role)) throw new AppError("Vai trò lọc không hợp lệ.", 400);
        filter.role = req.query.role;
      }
      if (search) filter.$or = ["name", "email", "phone"].map((field) => ({ [field]: { $regex: search, $options: "i" } }));
      const [users, total] = await Promise.all([
        User.aggregate([
          { $match: filter }, { $sort: { createdAt: -1, _id: -1 } }, { $skip: skip }, { $limit: limit },
          { $project: { name: 1, email: 1, phone: 1, role: 1, is_blocked: 1, auth_provider: 1, createdAt: 1,
            hasGoogle: { $gt: [{ $strLenCP: { $ifNull: ["$google_sub", ""] } }, 0] },
            hasPassword: { $gt: [{ $strLenCP: { $ifNull: ["$password", ""] } }, 0] },
          } },
        ]), User.countDocuments(filter),
      ]);
      const stats = await Order.aggregate([
        { $match: { user_id: { $in: users.map((user) => user._id) } } },
        { $group: { _id: "$user_id", orderCount: { $sum: 1 },
          completedCount: { $sum: { $cond: [{ $eq: ["$order_status", "completed"] }, 1, 0] } },
          cancelledCount: { $sum: { $cond: [{ $eq: ["$order_status", "cancelled"] }, 1, 0] } },
          returnedCount: { $sum: { $cond: [{ $eq: ["$order_status", "returned"] }, 1, 0] } },
          refusalCount: { $sum: { $cond: [{ $in: ["refused", { $ifNull: ["$delivery_incidents.reason", []] }] }, 1, 0] } },
          totalSpent: { $sum: { $cond: [{ $and: [{ $eq: ["$order_status", "completed"] }, { $eq: ["$payment_status", "success"] }] }, "$final_amount", 0] } },
        } },
      ]);
      const byId = new Map(stats.map((stat) => [String(stat._id), stat]));
      res.json({ status: "success", data: users.map((user) => {
        const { _id: _statsId, ...stat } = byId.get(String(user._id)) ?? {};
        return { ...user, orderCount: 0, completedCount: 0, cancelledCount: 0, returnedCount: 0, refusalCount: 0, totalSpent: 0, ...stat,
          canManage: req.user?.role === "admin" && user.role !== "admin" && String(user._id) !== String(req.user._id) };
      }), pagination: paginationMetadata(page, limit, total) });
    } catch (error) { next(error); }
  }

  static async orders(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = validId(req);
      const user = await User.findById(id).select("name email role").lean();
      if (!user || (req.user?.role !== "admin" && user.role !== "customer")) throw new AppError("Không tìm thấy khách hàng.", 404);
      const { page, limit, skip } = readPagination(req.query, 10);
      const [orders, total] = await Promise.all([
        Order.find({ user_id: id }).sort({ created_at: -1, _id: -1 }).skip(skip).limit(limit).lean(), Order.countDocuments({ user_id: id }),
      ]);
      const details = await OrderDetail.find({ order_id: { $in: orders.map((order) => order._id) } }).select("order_id product_id sku product_name size color quantity price_at_buy").lean();
      res.json({ status: "success", data: orders.map((order) => ({ ...order, items: details.filter((item) => String(item.order_id) === String(order._id)) })), pagination: paginationMetadata(page, limit, total) });
    } catch (error) { next(error); }
  }

  static async role(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = validId(req);
      if (!["customer", "staff"].includes(req.body.role)) throw new AppError("Chỉ phân quyền khách hàng hoặc nhân viên tại đây. Tài khoản quản trị được bảo vệ.", 400);
      if (String(req.user!._id) === id) throw new AppError("Không thể tự thay đổi quyền của mình.", 403);
      const updated = await User.findOneAndUpdate({ _id: id, role: { $ne: "admin" } }, { $set: { role: req.body.role }, $inc: { session_version: 1 } }, { returnDocument: "after", runValidators: true }).select("name email role is_blocked");
      if (!updated) throw new AppError("Không thể sửa quyền tài khoản quản trị hoặc tài khoản không tồn tại.", 403);
      res.json({ status: "success", data: updated });
    } catch (error) { next(error); }
  }

  static async block(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = validId(req);
      if (String(req.user!._id) === id) throw new AppError("Không thể tự khóa tài khoản.", 403);
      if (typeof req.body.is_blocked !== "boolean") throw new AppError("Vui lòng chọn trạng thái khóa cụ thể.", 400);
      const updated = await User.findOneAndUpdate({ _id: id, role: { $ne: "admin" } }, { $set: { is_blocked: req.body.is_blocked }, $inc: { session_version: 1 } }, { returnDocument: "after" }).select("name email role is_blocked");
      if (!updated) throw new AppError("Không thể khóa tài khoản quản trị hoặc tài khoản không tồn tại.", 403);
      res.json({ status: "success", data: updated });
    } catch (error) { next(error); }
  }
}
