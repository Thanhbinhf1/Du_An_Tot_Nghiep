import type { Request, Response, NextFunction } from "express";
import { AppError } from "../middlewares/AppError.js";
import { calculateCouponDiscount } from "../services/checkoutPricing.js";

export class CouponController {
  static async validate(req: Request, res: Response, next: NextFunction) {
    try {
      if (typeof req.body?.code !== "string" || !req.body.code.trim() || req.body.code.length > 100) {
        throw new AppError("Vui lòng nhập mã giảm giá.", 400);
      }
      const orderAmount: unknown = req.body.order_amount;
      if (typeof orderAmount !== "number" || !Number.isSafeInteger(orderAmount) || orderAmount < 0) {
        throw new AppError("Giá trị đơn hàng không hợp lệ.", 400);
      }

      const code = req.body.code.trim().toUpperCase();
      const { discount } = await calculateCouponDiscount(code, orderAmount);

      res.json({
        status: "success",
        data: {
          code,
          discount_amount: discount,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}
