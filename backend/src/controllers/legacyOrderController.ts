import type { Response, NextFunction } from "express";
import mongoose from "mongoose";
import Order from "../models/orderModel.js";
import OrderDetail from "../models/orderDetailModel.js";
import StorefrontProduct from "../models/storefrontProductModel.js";
import type { AuthRequest } from "../middlewares/authMiddleware.js";
import { AppError } from "../middlewares/AppError.js";
import { calculateCheckoutPrice, readCheckoutOptions, reserveCouponUse } from "../services/checkoutPricing.js";

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

export class LegacyOrderController {
  static async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const user = req.user;
      if (!user) throw new AppError("Vui lòng đăng nhập để đặt hàng.", 401);

      const items = parseItems(req.body?.items);
      const receiverName = requiredText(req.body?.receiver?.name, "Tên người nhận");
      const receiverPhone = requiredText(req.body?.receiver?.phone, "Số điện thoại");
      const shippingAddress = requiredText(req.body?.receiver?.address, "Địa chỉ nhận hàng");
      const requestedMethod = req.body?.shipping_method;
      if (requestedMethod !== undefined && !["address", "pickup", "Standard", "Express", "Pickup"].includes(requestedMethod)) {
        throw new AppError("Phương thức giao hàng không hợp lệ.", 400);
      }
      const shippingMethod = requestedMethod === "pickup" || requestedMethod === "Pickup"
        ? "Pickup" : requestedMethod === "Express" ? "Express" : "Standard";
      const options = readCheckoutOptions({ ...req.body, shipping_method: shippingMethod === "Pickup" ? "Standard" : shippingMethod });
      const expectedTotal: unknown = req.body?.expected_total;
      if (expectedTotal !== undefined && (typeof expectedTotal !== "number" || !Number.isSafeInteger(expectedTotal) || expectedTotal < 0)) {
        throw new AppError("Tổng tiền xác nhận không hợp lệ.", 400);
      }
      const productIds = [...new Set(items.map((item) => item.productId))];
      const result = await mongoose.connection.transaction(async (session) => {
        const products = await StorefrontProduct.find({
          _id: { $in: productIds },
        }).session(session).lean();
        const productsById = new Map(products.map((product) => [product._id.toString(), product]));

        const orderLines = items.map((item) => {
          const product = productsById.get(item.productId);
          if (!product) throw new AppError("Một sản phẩm trong giỏ hàng không còn tồn tại.", 404);
          if (!Number.isSafeInteger(product.price) || product.price < 0) throw new AppError("Giá sản phẩm không hợp lệ.", 400);
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
        if (!Number.isSafeInteger(subtotal)) throw new AppError("Tổng tiền không hợp lệ.", 400);
        const price = await calculateCheckoutPrice(subtotal, { ...options, method: shippingMethod }, session);
        if (expectedTotal !== undefined && expectedTotal !== price.final_amount) {
          throw new AppError("Tổng tiền đã thay đổi. Vui lòng kiểm tra lại trước khi đặt đơn.", 409);
        }
        await reserveCouponUse(price.couponId, session);

        const created = await Order.create([{
          user_id: user._id,
          coupon_id: price.couponId,
          total_product_amount: price.total_product_amount,
          discount_amount: price.discount_amount,
          shipping_fee: price.shipping_fee,
          final_amount: price.final_amount,
          receiver_name: receiverName,
          receiver_phone: receiverPhone,
          shipping_address: shippingAddress,
          shipping_method: shippingMethod,
          payment_method: "COD",
          payment_status: "pending",
          order_status: "pending",
        }], { session });
        const order = created[0];
        if (!order) throw new AppError("Không thể tạo đơn hàng.", 500);

        await OrderDetail.create(orderLines.map((item) => ({
          order_id: order._id,
          storefront_product_id: item.product_id,
          product_name: item.name,
          sku: item.sku,
          size: item.size,
          color: item.color,
          quantity: item.quantity,
          price_at_buy: item.price,
        })), { session });

        return {
            _id: order._id,
            created_at: order.created_at,
            order_status: order.order_status,
            final_amount: order.final_amount,
            discount_amount: order.discount_amount,
            coupon_code: options.code || null,
            shipping_fee: order.shipping_fee,
            total_product_amount: order.total_product_amount,
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
        };
      });
      res.status(201).json({ status: "success", data: result });
    } catch (error) {
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
        .select("order_id product_id storefront_product_id product_name sku size color quantity price_at_buy")
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
              product_id: (item.storefront_product_id ?? item.product_id)?.toString() ?? "",
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
