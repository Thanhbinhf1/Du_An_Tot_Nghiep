import type { ClientSession, Types } from "mongoose";
import { AppError } from "../middlewares/AppError.js";
import Coupon from "../models/couponModel.js";
import Setting from "../models/settingModel.js";

export const SHIPPING_DEFAULTS = {
  free_shipping_threshold: 500_000,
  standard_shipping_fee: 30_000,
  express_shipping_fee: 45_000,
};

export function readCheckoutOptions(body: Record<string, unknown>) {
  const method = body.shipping_method ?? "Standard";
  if (method !== "Standard" && method !== "Express") {
    throw new AppError("Phương thức giao hàng không hợp lệ.", 400);
  }
  const code = body.coupon_code ?? "";
  if (typeof code !== "string" || code.length > 100) {
    throw new AppError("Mã giảm giá không hợp lệ.", 400);
  }
  return { method, code: code.trim().toUpperCase() };
}

export async function calculateCheckoutPrice(
  subtotal: number,
  options: ReturnType<typeof readCheckoutOptions>,
  session?: ClientSession,
) {
  const setting = await Setting.findOne({ key: "store_config" }).session(session ?? null).lean();
  const saved = setting?.value as Partial<typeof SHIPPING_DEFAULTS> | undefined;
  const amount = (key: keyof typeof SHIPPING_DEFAULTS) => {
    const value = saved?.[key];
    return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
      ? value
      : SHIPPING_DEFAULTS[key];
  };
  const freeShippingThreshold = amount("free_shipping_threshold");
  const standardFee = subtotal >= freeShippingThreshold ? 0 : amount("standard_shipping_fee");
  const expressFee = amount("express_shipping_fee");
  const shippingFee = options.method === "Express" ? expressFee : standardFee;
  let discount = 0;
  let couponId: Types.ObjectId | null = null;

  if (options.code) {
    const now = new Date();
    const coupon = await Coupon.findOne({
      code: options.code,
      status: true,
      start_date: { $lte: now },
      end_date: { $gte: now },
      min_order_value: { $lte: subtotal },
      $expr: { $lt: ["$used_count", "$usage_limit"] },
    }).session(session ?? null).lean();
    if (!coupon) throw new AppError("Mã giảm giá không còn hiệu lực hoặc đơn hàng chưa đủ điều kiện.", 400);
    couponId = coupon._id;
    const value = coupon.discount_type === "percent" ? subtotal * coupon.discount_value / 100 : coupon.discount_value;
    discount = Math.round(Math.min(subtotal, value, coupon.max_discount ?? value));
  }

  const finalAmount = subtotal - discount + shippingFee;
  if (!Number.isSafeInteger(finalAmount) || finalAmount < 0) {
    throw new AppError("Tổng tiền không hợp lệ.", 400);
  }
  return {
    couponId,
    total_product_amount: subtotal,
    discount_amount: discount,
    shipping_fee: shippingFee,
    final_amount: finalAmount,
    standard_shipping_fee: standardFee,
    express_shipping_fee: expressFee,
    free_shipping_threshold: freeShippingThreshold,
  };
}

export async function restoreCouponUse(couponId: Types.ObjectId | null | undefined, session: ClientSession) {
  if (couponId) {
    await Coupon.updateOne({ _id: couponId, used_count: { $gt: 0 } }, { $inc: { used_count: -1 } }, { session });
  }
}
