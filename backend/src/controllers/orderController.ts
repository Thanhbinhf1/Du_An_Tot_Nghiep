import type { Request, Response, NextFunction } from "express";
import mongoose, { Types } from "mongoose";
import Coupon from "../models/couponModel.js";
import Order from "../models/orderModel.js";
import OrderDetail from "../models/orderDetailModel.js";
import StorefrontProduct from "../models/storefrontProductModel.js";
import type { AuthRequest } from "../middlewares/authMiddleware.js";
import { AppError } from "../middlewares/AppError.js";

type CheckoutItem = {
  productId: string;
  size: string;
  color: string;
  quantity: number;
};

function requiredText(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new AppError(`${label} không được để trống.`, 400);
  }
  return value.trim();
}

function parseItems(value: unknown): CheckoutItem[] {
  if (!Array.isArray(value) || !value.length) {
    throw new AppError("Giỏ hàng đang trống.", 400);
  }
  if (value.length > 100) {
    throw new AppError("Đơn hàng có quá nhiều sản phẩm.", 400);
  }

  return value.map((item) => {
    if (!item || typeof item !== "object") {
      throw new AppError("Thông tin sản phẩm trong giỏ hàng không hợp lệ.", 400);
    }
    const candidate = item as Record<string, unknown>;
    if (typeof candidate.productId !== "string" || !mongoose.isValidObjectId(candidate.productId)) {
      throw new AppError("Không tìm thấy một sản phẩm trong giỏ hàng.", 400);
    }
    if (typeof candidate.quantity !== "number" || !Number.isInteger(candidate.quantity) || candidate.quantity < 1 || candidate.quantity > 99) {
      throw new AppError("Số lượng sản phẩm không hợp lệ.", 400);
    }
    return {
      productId: candidate.productId,
      size: requiredText(candidate.size, "Kích cỡ"),
      color: requiredText(candidate.color, "Màu sắc"),
      quantity: candidate.quantity,
    };
  });
}

function calculateDiscount(
  coupon: {
    discount_type: "percent" | "fixed";
    discount_value: number;
    max_discount?: number | null;
  },
  subtotal: number,
) {
  let discount = coupon.discount_type === "percent"
    ? Math.round(subtotal * coupon.discount_value / 100)
    : coupon.discount_value;
  if (coupon.max_discount != null) discount = Math.min(discount, coupon.max_discount);
  return Math.min(discount, subtotal);
}

export class OrderController {
  static async create(req: AuthRequest, res: Response, next: NextFunction) {
    let orderId: Types.ObjectId | undefined;
    let usedCouponId: Types.ObjectId | undefined;
    try {
      const user = req.user;
      if (!user) throw new AppError("Vui lòng đăng nhập để đặt hàng.", 401);

      const items = parseItems(req.body?.items);
      const receiverName = requiredText(req.body?.receiver?.name, "Tên người nhận");
      const receiverPhone = requiredText(req.body?.receiver?.phone, "Số điện thoại");
      const shippingAddress = requiredText(req.body?.receiver?.address, "Địa chỉ nhận hàng");
      const shippingMethod = req.body?.shipping_method === "pickup" ? "Pickup" : "Standard";
      const productIds = [...new Set(items.map((item) => item.productId))];
      const products = await StorefrontProduct.find({
        _id: { $in: productIds },
      }).lean();
      const productsById = new Map(products.map((product) => [product._id.toString(), product]));

      const orderLines = items.map((item) => {
        const product = productsById.get(item.productId);
        if (!product) throw new AppError("Một sản phẩm trong giỏ hàng không còn tồn tại.", 404);
        if (!product.sizes.includes(item.size)) {
          throw new AppError(`Kích cỡ ${item.size} của ${product.name} hiện không khả dụng.`, 400);
        }
        if (product.color.toLowerCase() !== item.color.toLowerCase()) {
          throw new AppError(`Màu sắc của ${product.name} đã thay đổi. Vui lòng kiểm tra lại giỏ hàng.`, 400);
        }
        return {
          product_id: product._id,
          name: product.name,
          sku: product.code,
          size: item.size,
          color: product.color,
          quantity: item.quantity,
          price: product.price,
        };
      });
      const subtotal = orderLines.reduce((sum, item) => sum + item.price * item.quantity, 0);

      let coupon: Awaited<ReturnType<typeof Coupon.findOne>> | null = null;
      const couponCode = typeof req.body?.coupon_code === "string" ? req.body.coupon_code.trim().toUpperCase() : "";
      let discountAmount = 0;
      if (couponCode) {
        coupon = await Coupon.findOne({ code: couponCode });
        if (!coupon || !coupon.status) throw new AppError("Mã giảm giá không tồn tại hoặc đã bị tắt.", 400);
        const now = new Date();
        if (now < coupon.start_date || now > coupon.end_date) {
          throw new AppError("Mã giảm giá chưa có hiệu lực hoặc đã hết hạn.", 400);
        }
        if (coupon.used_count >= coupon.usage_limit) throw new AppError("Mã giảm giá đã hết lượt sử dụng.", 400);
        if (subtotal < coupon.min_order_value) {
          throw new AppError("Đơn hàng không còn đủ điều kiện áp dụng mã giảm giá.", 400);
        }
        discountAmount = calculateDiscount(coupon, subtotal);
      }

      const order = await Order.create({
        user_id: user._id,
        coupon_id: coupon?._id ?? null,
        total_product_amount: subtotal,
        discount_amount: discountAmount,
        shipping_fee: 0,
        final_amount: subtotal - discountAmount,
        receiver_name: receiverName,
        receiver_phone: receiverPhone,
        shipping_address: shippingAddress,
        shipping_method: shippingMethod,
        payment_method: "COD",
        payment_status: "pending",
        order_status: "pending",
      });
      orderId = order._id;

      await OrderDetail.create(orderLines.map((item) => ({
        order_id: order._id,
        storefront_product_id: item.product_id,
        product_name: item.name,
        sku: item.sku,
        size: item.size,
        color: item.color,
        quantity: item.quantity,
        price_at_buy: item.price,
      })));

      if (coupon) {
        const usageUpdate = await Coupon.updateOne(
          {
            _id: coupon._id,
            status: true,
            used_count: { $lt: coupon.usage_limit },
            start_date: { $lte: new Date() },
            end_date: { $gte: new Date() },
          },
          { $inc: { used_count: 1 } },
        );
        if (usageUpdate.modifiedCount !== 1) {
          throw new AppError("Mã giảm giá vừa hết lượt sử dụng hoặc đã hết hạn. Vui lòng thử lại.", 409);
        }
        usedCouponId = coupon._id;
      }

      res.status(201).json({
        status: "success",
        data: {
          _id: order._id,
          created_at: order.created_at,
          order_status: order.order_status,
          final_amount: order.final_amount,
          discount_amount: order.discount_amount,
          coupon_code: coupon?.code ?? null,
          receiver_name: order.receiver_name,
          receiver_phone: order.receiver_phone,
          shipping_address: order.shipping_address,
          shipping_method: order.shipping_method,
          items: orderLines.map((item) => ({
            product_id: item.product_id,
            product_name: item.name,
            sku: item.sku,
            size: item.size,
            color: item.color,
            quantity: item.quantity,
            price_at_buy: item.price,
          })),
        },
      });
    } catch (error) {
      if (orderId) {
        await OrderDetail.deleteMany({ order_id: orderId });
        await Order.deleteOne({ _id: orderId });
      }
      if (usedCouponId) await Coupon.updateOne({ _id: usedCouponId, used_count: { $gt: 0 } }, { $inc: { used_count: -1 } });
      next(error);
    }
  }

  static async getMine(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new AppError("Vui lòng đăng nhập để xem đơn hàng.", 401);
      const orders = await Order.find({ user_id: req.user._id })
        .populate("coupon_id", "code")
        .sort({ created_at: -1 })
        .limit(200)
        .lean();
      const orderIds = orders.map((order) => order._id);
      const details = await OrderDetail.find({ order_id: { $in: orderIds } })
        .select("order_id storefront_product_id product_name sku size color quantity price_at_buy")
        .lean();
      const detailsByOrder = new Map<string, typeof details>();
      for (const detail of details) {
        const key = detail.order_id.toString();
        detailsByOrder.set(key, [...(detailsByOrder.get(key) ?? []), detail]);
      }
      res.json({
        status: "success",
        data: orders.map((order) => {
          const coupon = order.coupon_id as unknown as { code?: string } | null;
          return {
            ...order,
            coupon_code: coupon?.code ?? null,
            items: (detailsByOrder.get(order._id.toString()) ?? []).map((item) => ({
              product_id: item.storefront_product_id?.toString() ?? "",
              product_name: item.product_name,
              sku: item.sku,
              size: item.size,
              color: item.color,
              quantity: item.quantity,
              price_at_buy: item.price_at_buy,
            })),
          };
        }),
      });
    } catch (error) {
      next(error);
    }
  }
}
