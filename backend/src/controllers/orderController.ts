import type { Response, NextFunction } from "express";
import { createHash } from "node:crypto";
import mongoose from "mongoose";
import type { IOrder } from "../models/orderModel.js";
import Order from "../models/orderModel.js";
import OrderDetail, { type IOrderDetail } from "../models/orderDetailModel.js";
import Address from "../models/addressModel.js";
import Cart from "../models/cartModel.js";
import CartDetail from "../models/cartDetailModel.js";
import ProductVariant from "../models/productVariantModel.js";
import Product from "../models/productModel.js";
import OrderStatusHistory from "../models/orderStatusHistoryModel.js";
import { AppError } from "../middlewares/AppError.js";
import type { AuthRequest } from "../middlewares/authMiddleware.js";
import { checkoutPaymentMethodIssue, configuredPaymentMethods, isPaymentMethodConfigured, isSupportedPaymentMethod } from "../config/paymentMethods.js";
import { calculateCheckoutPrice, checkoutDestination, checkoutSnapshot, readCheckoutOptions, reserveCouponUse, restoreCouponUse, type CheckoutSnapshotLine } from "../services/checkoutPricing.js";
import { getCheckoutCart } from "../services/checkoutCart.js";
import { restoreOrderStock } from "../services/orderStock.js";

const customerCancelState = { order_status: "pending", payment_method: "COD", payment_status: "pending" } as const;
const customerCancelNote = "Khách hàng hủy đơn COD: ";

function canCustomerCancel(order: Pick<IOrder, "order_status" | "payment_status" | "payment_method">) {
  return order.order_status === customerCancelState.order_status &&
    order.payment_method === customerCancelState.payment_method && order.payment_status === customerCancelState.payment_status;
}

export function customerOrderActions(order: Pick<IOrder, "order_status" | "payment_status" | "payment_method" | "final_amount">) {
  return {
    cancel: canCustomerCancel(order),
    pay: order.order_status === "pending" && order.payment_status === "pending" && order.payment_method !== "COD" &&
      isSupportedPaymentMethod(order.payment_method) && isPaymentMethodConfigured(order.payment_method) &&
      !checkoutPaymentMethodIssue(order.payment_method, order.final_amount),
  };
}

export class OrderController {
  static async quoteCheckout(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new AppError("Bạn chưa đăng nhập.", 401);
      const options = readCheckoutOptions(req.body ?? {});
      const addressId: unknown = req.body?.address_id;
      let destination: ReturnType<typeof checkoutDestination> | null = null;
      if (addressId !== undefined) {
        if (typeof addressId !== "string" || !mongoose.isValidObjectId(addressId)) {
          throw new AppError("ID địa chỉ không hợp lệ", 400);
        }
        const address = await Address.findOne({ _id: addressId, user_id: req.user._id }).session(null);
        if (!address) throw new AppError("Không tìm thấy địa chỉ giao hàng", 404);
        destination = checkoutDestination(address);
      }
      const { rows, subtotal } = await getCheckoutCart(req.user._id);
      const pricing = await calculateCheckoutPrice(subtotal, { ...options, location: destination });
      const { couponId: _couponId, ...price } = pricing;
      const configured = configuredPaymentMethods();
      res.json({
        status: "success",
        data: {
          ...price, address: destination, cart_lines: rows,
          configured_payment_methods: configured,
          payment_methods: configured.filter((method) => !checkoutPaymentMethodIssue(method, price.final_amount)),
          cart_snapshot: checkoutSnapshot(rows, options.method, pricing, destination),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // GET /api/orders/my
  static async getMyOrders(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      if (!req.user) {
        throw new AppError("Bạn chưa đăng nhập", 401);
      }

      const orders = await Order.find({
        user_id: req.user._id,
      })
        .sort({ created_at: -1 })
        .lean();

      return res.status(200).json({
        status: "success",
        results: orders.length,
        data: orders.map((order) => ({ ...order, actions: customerOrderActions(order) })),
      });
    } catch (error) {
      next(error);
    }
  }

  // GET /api/orders/:id
  static async getOrderById(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      if (!req.user) {
        throw new AppError("Bạn chưa đăng nhập", 401);
      }

      const orderId = req.params.id;

      if (typeof orderId !== "string" || !mongoose.isValidObjectId(orderId)) {
        throw new AppError("ID đơn hàng không hợp lệ", 400);
      }

      // Chỉ truy vấn đơn hàng của người đang đăng nhập
      const order = await Order.findOne({
        _id: orderId,
        user_id: req.user._id,
      }).lean();

      if (!order) {
        throw new AppError("Không tìm thấy đơn hàng", 404);
      }

      const items = await OrderDetail.find({
        order_id: order._id,
      }).lean();

      const orderItems = order.order_status === "completed"
        ? await OrderController.addReviewProducts(items)
        : items;

      const cancellation = order.order_status === "cancelled" ? await OrderStatusHistory.findOne({
        order_id: order._id, status: "cancelled", changed_by: req.user._id, note: { $regex: `^${customerCancelNote}` },
      }).select("note").lean() : null;

      return res.status(200).json({
        status: "success",
        data: {
          ...order,
          actions: customerOrderActions(order),
          cancellation_reason: cancellation?.note.slice(customerCancelNote.length) ?? null,
          items: orderItems,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  private static async addReviewProducts<Item extends Pick<IOrderDetail, "product_id" | "product_variant_id">>(items: Item[]) {
    if (!items.length) return [];
    const legacyVariantIds = items
      .filter((item) => !item.product_id)
      .map((item) => item.product_variant_id)
      .filter((id) => id != null);
    const variants = legacyVariantIds.length
      ? await ProductVariant.find({ _id: { $in: legacyVariantIds } }).select("product_id").lean()
      : [];
    const legacyProducts = new Map(variants.map((variant) => [String(variant._id), variant.product_id]));
    const productIds = items.map((item) => item.product_id ?? legacyProducts.get(String(item.product_variant_id)));
    const products = await Product.find({ _id: { $in: productIds.filter((id) => id !== undefined) }, status: true })
      .select("_id").lean();
    const visibleProducts = new Set(products.map((product) => String(product._id)));
    return items.map((item, index) => ({
      ...item,
      review_product_id: visibleProducts.has(String(productIds[index])) ? productIds[index] : null,
    }));
  }

  // POST /api/orders - Tạo đơn COD từ giỏ hàng
  static async createOrder(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      if (!req.user) {
        throw new AppError("Bạn chưa đăng nhập", 401);
      }

      const userId = req.user._id;
      const { address_id, payment_method, note, expected_total, expected_cart_snapshot } = req.body ?? {};
      const options = readCheckoutOptions(req.body ?? {});
      if (expected_total !== undefined && (!Number.isSafeInteger(expected_total) || expected_total < 0)) {
        throw new AppError("Tổng tiền xác nhận không hợp lệ.", 400);
      }
      if (expected_cart_snapshot !== undefined &&
          (typeof expected_cart_snapshot !== "string" || !/^[a-f0-9]{64}$/.test(expected_cart_snapshot))) {
        throw new AppError("Mã đối chiếu giỏ hàng không hợp lệ.", 400);
      }

      if (
        typeof address_id !== "string" ||
        !mongoose.isValidObjectId(address_id)
      ) {
        throw new AppError("ID địa chỉ không hợp lệ", 400);
      }

      if (!isSupportedPaymentMethod(payment_method)) {
        throw new AppError("Phương thức thanh toán không hợp lệ", 400);
      }

      if (
        note !== undefined &&
        (typeof note !== "string" || note.length > 500)
      ) {
        throw new AppError("Ghi chú không hợp lệ", 400);
      }

      const requestHash = expected_cart_snapshot === undefined ? undefined :
        createHash("sha256").update(JSON.stringify([
          address_id.toLowerCase(), payment_method, note?.trim() ?? "",
          options.method, options.code, expected_total ?? null,
        ])).digest("hex");

      const { data, replayed } = await mongoose.connection.transaction(async (session) => {
        if (requestHash) {
          const existing = await Order.findOne({
            user_id: userId,
            checkout_snapshot: expected_cart_snapshot,
          }).session(session);
          if (existing) {
            if (existing.checkout_request_hash !== requestHash) {
              throw new AppError("Báo giá đã được dùng để đặt đơn với thông tin khác.", 409);
            }
            return { replayed: true, data: {
              order_id: existing._id,
              total_amount: existing.final_amount,
              total_items: existing.checkout_item_count,
              payment_method: existing.payment_method,
              payment_status: existing.payment_status,
              order_status: existing.order_status,
            } };
          }
        }

        if (!isPaymentMethodConfigured(payment_method)) {
          throw new AppError("Phương thức thanh toán chưa sẵn sàng.", 409);
        }

        // 1. Kiểm tra địa chỉ của chính người mua
        const address = await Address.findOne({
          _id: address_id,
          user_id: userId,
        }).session(session);

        if (!address) {
          throw new AppError("Không tìm thấy địa chỉ giao hàng", 404);
        }

        // 2. Lấy giỏ hàng
        const cart = await Cart.findOne({
          user_id: userId,
        }).session(session);

        if (!cart) {
          throw new AppError("Giỏ hàng trống", 400);
        }

        const items = await CartDetail.find({
          cart_id: cart._id,
        }).session(session);

        if (items.length === 0) {
          throw new AppError("Giỏ hàng trống", 400);
        }

        const orderItems: Array<{
          product_variant_id: mongoose.Types.ObjectId;
          product_id: mongoose.Types.ObjectId;
          outfit_id: null;
          product_name: string;
          sku: string;
          size: string;
          color: string;
          quantity: number;
          price_at_buy: number;
        }> = [];

        const stockNeeded = new Map<string, number>();
        const quoteRows: CheckoutSnapshotLine[] = [];
        let totalAmount = 0;

        // 3. Kiểm tra từng sản phẩm trong giỏ
        for (const item of items) {
          if (item.outfit_id != null) {
            throw new AppError(
              "Đơn hàng có Outfit chưa được hỗ trợ ở giai đoạn này",
              400,
            );
          }

          if (!Number.isSafeInteger(item.quantity) || item.quantity < 1) {
            throw new AppError("Số lượng sản phẩm không hợp lệ", 400);
          }

          const variant = await ProductVariant.findById(
            item.product_variant_id,
          ).session(session);

          if (!variant || !variant.status) {
            throw new AppError("Có biến thể sản phẩm không còn được bán", 400);
          }

          const product = await Product.findById(variant.product_id).session(
            session,
          );

          if (!product || !product.status) {
            throw new AppError("Có sản phẩm không còn được bán", 400);
          }

          const price = variant.sale_price ?? variant.price;

          if (!Number.isSafeInteger(price) || price < 0) {
            throw new AppError("Giá sản phẩm không hợp lệ", 400);
          }

          const variantId = String(variant._id);

          const requiredStock = (stockNeeded.get(variantId) ?? 0) + item.quantity;
          if (!Number.isSafeInteger(requiredStock)) throw new AppError("Số lượng sản phẩm không hợp lệ", 400);
          if (!Number.isSafeInteger(variant.stock_quantity) || variant.stock_quantity < requiredStock) {
            throw new AppError("Sản phẩm không đủ tồn kho", 409);
          }
          stockNeeded.set(variantId, requiredStock);

          totalAmount += price * item.quantity;

          if (!Number.isSafeInteger(totalAmount)) {
            throw new AppError("Tổng tiền không hợp lệ", 400);
          }

          orderItems.push({
            product_variant_id: variant._id,
            product_id: product._id,
            outfit_id: null,
            product_name: product.name,
            sku: variant.sku,
            size: variant.size,
            color: variant.color,
            quantity: item.quantity,
            price_at_buy: price,
          });
          if (expected_cart_snapshot !== undefined) {
            quoteRows.push({
              id: String(item._id),
              variant_id: variantId,
              sku: variant.sku,
              size: variant.size,
              color: variant.color,
              quantity: item.quantity,
              unit_price: price,
            });
          }
        }

        const destination = checkoutDestination(address);
        const price = await calculateCheckoutPrice(totalAmount, { ...options, location: destination }, session);
        if (expected_total !== undefined && price.final_amount !== expected_total) {
          throw new AppError("Tổng tiền đã thay đổi. Vui lòng kiểm tra lại trước khi đặt đơn.", 409);
        }
        if (expected_cart_snapshot !== undefined &&
            checkoutSnapshot(quoteRows, options.method, price, destination) !== expected_cart_snapshot) {
          throw new AppError("Giỏ hàng đã thay đổi hoặc địa chỉ giao hàng cần được xác nhận lại. Vui lòng kiểm tra trước khi đặt đơn.", 409);
        }
        const paymentIssue = checkoutPaymentMethodIssue(payment_method, price.final_amount);
        if (paymentIssue) throw new AppError(paymentIssue, 400);
        await reserveCouponUse(price.couponId, session);

        // 4. Trừ tồn kho có điều kiện
        // Cộng số lượng các dòng cùng biến thể trước khi trừ.
        for (const [variantId, quantity] of stockNeeded) {
          const updatedVariant = await ProductVariant.findOneAndUpdate(
            {
              _id: variantId,
              status: true,
              stock_quantity: { $gte: quantity },
            },
            { $inc: { stock_quantity: -quantity, __v: 1 } },
            {
              session,
              returnDocument: "after",
            },
          );

          if (!updatedVariant) {
            throw new AppError("Sản phẩm không đủ tồn kho", 409);
          }
        }

        // 5. Lưu bản sao địa chỉ giao hàng
        const shippingAddress = [
          address.address_detail,
          address.ward,
          address.district,
          address.province,
        ].filter(Boolean).join(", ");

        const totalItems = orderItems.reduce((sum, item) => sum + item.quantity, 0);
        if (!Number.isSafeInteger(totalItems)) throw new AppError("Tổng số lượng sản phẩm không hợp lệ", 400);
        const order = new Order({
          user_id: userId,
          ...(requestHash && {
            checkout_snapshot: expected_cart_snapshot,
            checkout_request_hash: requestHash,
            checkout_item_count: totalItems,
          }),
          coupon_id: price.couponId,
          total_product_amount: price.total_product_amount,
          discount_amount: price.discount_amount,
          shipping_fee: price.shipping_fee,
          final_amount: price.final_amount,
          receiver_name: address.receiver_name,
          receiver_phone: address.receiver_phone,
          shipping_address: shippingAddress,
          shipping_method: options.method,
          payment_method,
          payment_status: "pending",
          order_status: "pending",
          note: note?.trim() ?? "",
        });

        await order.save({ session });

        // 6. Tạo chi tiết đơn hàng
        await OrderDetail.insertMany(
          orderItems.map((item) => ({
            ...item,
            order_id: order._id,
          })),
          { session },
        );

        // 7. Xóa các dòng đã đặt khỏi giỏ
        const deleted = await CartDetail.deleteMany(
          {
            _id: { $in: items.map((item) => item._id) },
            cart_id: cart._id,
          },
          { session },
        );

        if (deleted.deletedCount !== items.length) {
          throw new AppError("Giỏ hàng đã thay đổi, vui lòng thử lại", 409);
        }

        await OrderStatusHistory.create([{
          order_id: order._id, status: "pending", note: "Khách hàng đặt đơn", changed_by: userId,
        }], { session });

        return { replayed: false, data: {
          order_id: order._id,
          total_amount: price.final_amount,
          total_items: totalItems,
          payment_method,
          payment_status: "pending",
          order_status: "pending",
        } };
      });

      return res.status(replayed ? 200 : 201).json({
        status: "success",
        message:
          replayed ? "Đơn hàng đã được ghi nhận" : payment_method === "COD"
            ? "Đặt hàng COD thành công"
            : "Tạo đơn hàng thành công, đang chờ thanh toán",
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  // PATCH /api/orders/:id/cancel
  // Khách hàng hủy đơn COD đang chờ xử lý
  static async cancelOrder(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      if (!req.user) {
        throw new AppError("Bạn chưa đăng nhập", 401);
      }

      const orderId = req.params.id;
      const userId = req.user._id;

      if (typeof orderId !== "string" || !mongoose.isValidObjectId(orderId)) {
        throw new AppError("ID đơn hàng không hợp lệ", 400);
      }

      const reason = req.body?.reason;
      if (typeof reason !== "string" || !reason.trim() || reason.length > 500) {
        throw new AppError("Vui lòng nhập lý do hủy đơn hàng (tối đa 500 ký tự).", 400);
      }

      const result = await mongoose.connection.transaction(async (session) => {
        // 1. Kiểm tra đơn hàng thuộc người đăng nhập
        const existingOrder = await Order.findOne({
          _id: orderId,
          user_id: userId,
        }).session(session);

        if (!existingOrder) {
          throw new AppError("Không tìm thấy đơn hàng", 404);
        }

        if (!canCustomerCancel(existingOrder)) {
          throw new AppError("Khách hàng chỉ có thể hủy đơn COD chưa thu tiền đang chờ xác nhận.", 409);
        }

        // 2. Lấy các sản phẩm thuộc đơn hàng
        const items = await OrderDetail.find({
          order_id: existingOrder._id,
        }).session(session);

        if (items.length === 0) {
          throw new AppError(
            "Không tìm thấy chi tiết đơn hàng để hoàn kho",
            409,
          );
        }

        // 3. Chuyển trạng thái với điều kiện pending
        const updatedOrder = await Order.findOneAndUpdate(
          {
            _id: existingOrder._id,
            user_id: userId,
            ...customerCancelState,
          },
          {
            $set: { order_status: "cancelled" },
          },
          {
            session,
            returnDocument: "after",
            runValidators: true,
          },
        );

        if (!updatedOrder) {
          throw new AppError("Trạng thái đơn hàng đã thay đổi", 409);
        }

        await restoreOrderStock(items, session);

        await restoreCouponUse(updatedOrder.coupon_id, session);

        // 6. Ghi lịch sử hủy đơn
        await OrderStatusHistory.create(
          [
            {
              order_id: updatedOrder._id,
              status: "cancelled",
              note: customerCancelNote + reason.trim(),
              changed_by: userId,
            },
          ],
          { session },
        );

        return updatedOrder;
      });

      return res.status(200).json({
        status: "success",
        message: "Hủy đơn hàng thành công",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  // GET /api/orders/admin
  // Admin xem danh sách tất cả đơn hàng
  static async getAdminOrders(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      if (!req.user || req.user.role !== "admin") {
        throw new AppError("Bạn không có quyền Admin", 403);
      }

      const pageValue = Number(req.query.page ?? 1);
      const limitValue = Number(req.query.limit ?? 10);

      if (
        !Number.isSafeInteger(pageValue) ||
        pageValue < 1 ||
        !Number.isSafeInteger(limitValue) ||
        limitValue < 1 ||
        limitValue > 100
      ) {
        throw new AppError("Tham số phân trang không hợp lệ", 400);
      }

      const filter: {
        order_status?: IOrder["order_status"];
      } = {};

      const allowedStatuses = [
        "pending",
        "processing",
        "shipping",
        "delivery_failed",
        "returning",
        "returned",
        "completed",
        "cancelled",
      ] as const;

      if (req.query.status !== undefined) {
        const status = req.query.status;

        if (
          typeof status !== "string" ||
          !allowedStatuses.some((value) => value === status)
        ) {
          throw new AppError("Trạng thái lọc không hợp lệ", 400);
        }

        filter.order_status = status as IOrder["order_status"];
      }

      const skip = (pageValue - 1) * limitValue;

      const [orders, total] = await Promise.all([
        Order.find(filter)
          .sort({ created_at: -1, _id: -1 })
          .skip(skip)
          .limit(limitValue)
          .lean(),
        Order.countDocuments(filter),
      ]);

      return res.status(200).json({
        status: "success",
        results: orders.length,
        pagination: {
          page: pageValue,
          limit: limitValue,
          total,
          total_pages: Math.ceil(total / limitValue),
        },
        data: orders,
      });
    } catch (error) {
      next(error);
    }
  }

  // PATCH /api/orders/:id/status
  // Admin / Staff chuyển trạng thái đơn hàng
  static async updateOrderStatus(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      if (!req.user || !["admin", "staff"].includes(req.user.role)) {
        throw new AppError("Bạn không có quyền cập nhật trạng thái đơn", 403);
      }

      const orderId = req.params.id;
      const { status, note } = (req.body ?? {}) as {
        status?: unknown;
        note?: unknown;
      };

      if (typeof orderId !== "string" || !mongoose.isValidObjectId(orderId)) {
        throw new AppError("ID đơn hàng không hợp lệ", 400);
      }
      if (
        status !== "processing" &&
        status !== "shipping" &&
        status !== "completed"
      ) {
        throw new AppError("Trạng thái mới không hợp lệ", 400);
      }

      const nextStatus = status;

      if (
        typeof status !== "string" ||
        !["processing", "shipping", "completed"].includes(status)
      ) {
        throw new AppError("Trạng thái mới không hợp lệ", 400);
      }

      if (
        note !== undefined &&
        (typeof note !== "string" || note.length > 500)
      ) {
        throw new AppError("Ghi chú không hợp lệ", 400);
      }

      // Chỉ được chuyển sang trạng thái kế tiếp.
      const transitions: Record<string, string> = {
        pending: "processing",
        processing: "shipping",
        shipping: "completed",
      };

      const updatedOrder = await mongoose.connection.transaction(
        async (session) => {
          const order = await Order.findById(orderId).session(session);

          if (!order) {
            throw new AppError("Không tìm thấy đơn hàng", 404);
          }

          if (transitions[order.order_status] !== status) {
            throw new AppError(
              `Không thể chuyển từ ${order.order_status} sang ${status}`,
              409,
            );
          }

          if (order.payment_method !== "COD" && order.payment_status !== "success") {
            throw new AppError("Cần xác nhận thanh toán trước khi xử lý đơn hàng.", 409);
          }
          if (order.payment_method === "COD" && !["pending", "success"].includes(order.payment_status)) {
            throw new AppError("Trạng thái thanh toán COD không cho phép hoàn tất đơn hàng.", 409);
          }

          // Cập nhật có điều kiện để tránh ghi đè trạng thái.
          const updated = await Order.findOneAndUpdate(
            {
              _id: orderId,
              order_status: order.order_status,
            },
            {
              $set: {
                order_status: status,
                ...(status === "completed" ? { completed_at: new Date() } : {}),
                ...(order.payment_method === "COD" && status === "completed" ? { payment_status: "success" } : {}),
              },
            },
            {
              session,
              returnDocument: "after",
              runValidators: true,
            },
          );

          if (!updated) {
            throw new AppError(
              "Trạng thái đơn đã thay đổi, vui lòng thử lại",
              409,
            );
          }

          // Ghi lịch sử cùng transaction.
          await OrderStatusHistory.create(
            [
              {
                order_id: updated._id,
                status,
                note: typeof note === "string" ? note.trim() : "",
                changed_by: req.user!._id,
              },
            ],
            { session },
          );

          return updated;
        },
      );

      return res.status(200).json({
        status: "success",
        message: "Cập nhật trạng thái đơn hàng thành công",
        data: updatedOrder,
      });
    } catch (error) {
      next(error);
    }
  }
}
