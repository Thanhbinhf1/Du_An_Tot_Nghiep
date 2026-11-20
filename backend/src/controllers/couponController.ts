import type { Request, Response, NextFunction } from "express";
import Coupon from "../models/couponModel.js";
import { AppError } from "../middlewares/AppError.js";

export class CouponController {
  static async validate(req: Request, res: Response, next: NextFunction) {
    try {
      if (typeof req.body?.code !== "string" || !req.body.code.trim()) {
        throw new AppError("Vui lòng nhập mã giảm giá.", 400);
      }
      const orderAmount = Number(req.body.order_amount);
      if (!Number.isFinite(orderAmount) || orderAmount < 0) {
        throw new AppError("Giá trị đơn hàng không hợp lệ.", 400);
      }

      const coupon = await Coupon.findOne({ code: req.body.code.trim().toUpperCase() }).lean();
      if (!coupon || !coupon.status) {
        throw new AppError("Mã giảm giá không tồn tại hoặc đã bị tắt.", 404);
      }

      const now = new Date();
      if (now < coupon.start_date || now > coupon.end_date) {
        throw new AppError("Mã giảm giá chưa có hiệu lực hoặc đã hết hạn.", 400);
      }
      if (coupon.used_count >= coupon.usage_limit) {
        throw new AppError("Mã giảm giá đã hết lượt sử dụng.", 400);
      }
      if (orderAmount < coupon.min_order_value) {
        throw new AppError(
          `Đơn hàng cần đạt tối thiểu ${new Intl.NumberFormat("vi-VN").format(coupon.min_order_value)} đ để dùng mã này.`,
          400,
        );
      }

      let discountAmount = coupon.discount_type === "percent"
        ? Math.round(orderAmount * coupon.discount_value / 100)
        : coupon.discount_value;
      if (coupon.max_discount != null) {
        discountAmount = Math.min(discountAmount, coupon.max_discount);
      }
      discountAmount = Math.min(discountAmount, orderAmount);

      res.json({
        status: "success",
        data: {
          code: coupon.code,
          discount_amount: discountAmount,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}
