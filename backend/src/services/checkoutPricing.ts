import { createHash } from "node:crypto";
import type { ClientSession, Types } from "mongoose";
import { AppError } from "../middlewares/AppError.js";
import Coupon from "../models/couponModel.js";
import Setting from "../models/settingModel.js";
import type { IAddress } from "../models/addressModel.js";

export const SHIPPING_DEFAULTS = {
  free_shipping_threshold: 500_000,
  standard_shipping_fee: 30_000,
  express_shipping_fee: 45_000,
};

export function readCheckoutOptions(body: Record<string, unknown>): { method: "Standard" | "Express"; code: string } {
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

export type CheckoutSnapshotLine = {
  id: string;
  variant_id: string;
  sku: string;
  size: string;
  color: string;
  quantity: number;
  unit_price: number;
};

type CheckoutAddress = Pick<IAddress, "_id" | "receiver_name" | "receiver_phone" | "province" | "province_code" | "ward" | "ward_code" | "district" | "address_detail">;

export function checkoutDestination(address: CheckoutAddress) {
  return {
    _id: String(address._id), receiver_name: address.receiver_name, receiver_phone: address.receiver_phone,
    province: address.province, province_code: address.province_code, ward: address.ward, ward_code: address.ward_code,
    district: address.district, address_detail: address.address_detail,
  };
}

export function checkoutSnapshot(
  lines: CheckoutSnapshotLine[],
  method: "Standard" | "Express",
  price: Awaited<ReturnType<typeof calculateCheckoutPrice>>,
  destination: ReturnType<typeof checkoutDestination> | null,
) {
  const rows = [...lines].sort((a, b) => a.id.localeCompare(b.id)).map((line) => [
    line.id, line.variant_id, line.sku, line.size, line.color, line.quantity, line.unit_price,
  ]);
  return createHash("sha256").update(JSON.stringify([
    rows, method, String(price.couponId ?? ""), price.total_product_amount,
    price.discount_amount, price.shipping_fee, price.final_amount, destination,
  ])).digest("hex");
}

export async function calculateCheckoutPrice(
  subtotal: number,
  options: { method: "Standard" | "Express" | "Pickup"; code: string; location?: { province_code?: number | undefined; ward_code?: number | undefined } | null },
  session?: ClientSession,
) {
  const setting = await Setting.findOne({ key: "store_config" }).session(session ?? null).lean();
  const saved = setting?.value as (Partial<typeof SHIPPING_DEFAULTS> & { express_shipping_province_code?: number | null; express_shipping_ward_codes?: number[] }) | undefined;
  const expressAvailable = options.location?.province_code !== undefined &&
    options.location.province_code === saved?.express_shipping_province_code &&
    options.location.ward_code !== undefined && Array.isArray(saved.express_shipping_ward_codes) &&
    saved.express_shipping_ward_codes.includes(options.location.ward_code);
  if (options.method === "Express" && !expressAvailable) {
    throw new AppError("Địa chỉ này chưa hỗ trợ giao hỏa tốc. Vui lòng chọn giao tiêu chuẩn.", 409);
  }
  const amount = (key: keyof typeof SHIPPING_DEFAULTS) => {
    const value = saved?.[key];
    return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
      ? value
      : SHIPPING_DEFAULTS[key];
  };
  const freeShippingThreshold = amount("free_shipping_threshold");
  const standardFee = subtotal >= freeShippingThreshold ? 0 : amount("standard_shipping_fee");
  const expressFee = amount("express_shipping_fee");
  const shippingFee = options.method === "Pickup" ? 0 : options.method === "Express" ? expressFee : standardFee;
  const { couponId, discount } = options.code
    ? await calculateCouponDiscount(options.code, subtotal, session)
    : { couponId: null, discount: 0 };

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
    express_available: expressAvailable,
    free_shipping_threshold: freeShippingThreshold,
  };
}

export async function calculateCouponDiscount(code: string, subtotal: number, session?: ClientSession) {
  const now = new Date();
  const coupon = await Coupon.findOne({
    code, status: true, start_date: { $lte: now }, end_date: { $gte: now },
    min_order_value: { $lte: subtotal }, $expr: { $lt: ["$used_count", "$usage_limit"] },
  }).session(session ?? null).lean();
  if (!coupon) throw new AppError("Mã giảm giá không còn hiệu lực hoặc đơn hàng chưa đủ điều kiện.", 400);
  const value = coupon.discount_type === "percent" ? subtotal * coupon.discount_value / 100 : coupon.discount_value;
  const discount = Math.round(Math.min(subtotal, value, coupon.max_discount ?? value));
  if (!Number.isSafeInteger(discount) || discount < 0) throw new AppError("Giá trị mã giảm giá không hợp lệ.", 400);
  return { couponId: coupon._id, discount };
}

export async function previewCouponDiscount(code: string, subtotal: number) {
  try {
    return await calculateCouponDiscount(code, subtotal);
  } catch (error) {
    if (!(error instanceof AppError) || error.statusCode !== 400) throw error;
  }
  const now = new Date();
  const coupon = await Coupon.findOne({ code }).select("status start_date end_date used_count usage_limit min_order_value").lean();
  if (!coupon || !coupon.status) throw new AppError("Mã giảm giá không còn hiệu lực.", 400);
  if (!(coupon.start_date <= now)) throw new AppError("Mã giảm giá chưa đến thời gian áp dụng.", 400);
  if (!(coupon.end_date >= now)) throw new AppError("Mã giảm giá đã hết hạn.", 400);
  if (!(coupon.used_count < coupon.usage_limit)) throw new AppError("Mã giảm giá đã hết lượt sử dụng.", 400);
  if (!Number.isFinite(coupon.min_order_value)) throw new AppError("Mức đơn tối thiểu của mã chưa được cấu hình.", 400);
  if (coupon.min_order_value > subtotal) {
    throw new AppError(`Đơn hàng chưa đạt mức tối thiểu ${coupon.min_order_value.toLocaleString("vi-VN")} ₫.`, 400);
  }
  throw new AppError("Mã giảm giá hiện chưa áp dụng được. Bạn có thể đối chiếu tại checkout.", 400);
}

export async function reserveCouponUse(couponId: Types.ObjectId | null, session: ClientSession) {
  if (!couponId) return;
  const { matchedCount } = await Coupon.updateOne(
    { _id: couponId, status: true, $expr: { $lt: ["$used_count", "$usage_limit"] } },
    { $inc: { used_count: 1 } }, { session },
  );
  if (matchedCount !== 1) throw new AppError("Mã giảm giá không còn lượt sử dụng.", 409);
}

export async function restoreCouponUse(couponId: Types.ObjectId | null | undefined, session: ClientSession) {
  if (couponId) {
    await Coupon.updateOne({ _id: couponId, used_count: { $gt: 0 } }, { $inc: { used_count: -1 } }, { session });
  }
}
