import type { Response, NextFunction } from "express";
import mongoose from "mongoose";
import type { IOrder } from "../models/orderModel.js";
import Order from "../models/orderModel.js";
import OrderDetail from "../models/orderDetailModel.js";
import Address from "../models/addressModel.js";
import Cart from "../models/cartModel.js";
import CartDetail from "../models/cartDetailModel.js";
import ProductVariant from "../models/productVariantModel.js";
import Product from "../models/productModel.js";
import OrderStatusHistory from "../models/orderStatusHistoryModel.js";
import { AppError } from "../middlewares/AppError.js";
import type { AuthRequest } from "../middlewares/authMiddleware.js";

export class OrderController {
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
        data: orders,
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

      return res.status(200).json({
        status: "success",
        data: {
          ...order,
          items,
        },
      });
    } catch (error) {
      next(error);
    }
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
      const { address_id, payment_method, note } = req.body ?? {};

      if (
        typeof address_id !== "string" ||
        !mongoose.isValidObjectId(address_id)
      ) {
        throw new AppError("ID địa chỉ không hợp lệ", 400);
      }

      if (payment_method !== "COD" && payment_method !== "BankTransfer") {
        throw new AppError("Hiện tại chỉ hỗ trợ COD và BankTransfer", 400);
      }

      if (
        note !== undefined &&
        (typeof note !== "string" || note.length > 500)
      ) {
        throw new AppError("Ghi chú không hợp lệ", 400);
      }

      const result = await mongoose.connection.transaction(async (session) => {
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
          outfit_id: null;
          product_name: string;
          sku: string;
          size: string;
          color: string;
          quantity: number;
          price_at_buy: number;
        }> = [];

        const stockNeeded = new Map<string, number>();
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

          stockNeeded.set(
            variantId,
            (stockNeeded.get(variantId) ?? 0) + item.quantity,
          );

          totalAmount += price * item.quantity;

          if (!Number.isSafeInteger(totalAmount)) {
            throw new AppError("Tổng tiền không hợp lệ", 400);
          }

          orderItems.push({
            product_variant_id: variant._id,
            outfit_id: null,
            product_name: product.name,
            sku: variant.sku,
            size: variant.size,
            color: variant.color,
            quantity: item.quantity,
            price_at_buy: price,
          });
        }

        // 4. Trừ tồn kho có điều kiện
        // Cộng số lượng các dòng cùng biến thể trước khi trừ.
        for (const [variantId, quantity] of stockNeeded) {
          const updatedVariant = await ProductVariant.findOneAndUpdate(
            {
              _id: variantId,
              status: true,
              stock_quantity: { $gte: quantity },
            },
            { $inc: { stock_quantity: -quantity } },
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
        ].join(", ");

        const order = new Order({
          user_id: userId,
          total_product_amount: totalAmount,
          discount_amount: 0,
          shipping_fee: 0,
          final_amount: totalAmount,
          receiver_name: address.receiver_name,
          receiver_phone: address.receiver_phone,
          shipping_address: shippingAddress,
          shipping_method: "Standard",
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

        return {
          order_id: order._id,
          total_amount: totalAmount,
          total_items: orderItems.length,
          payment_method,
          payment_status: "pending",
          order_status: "pending",
        };
      });

      return res.status(201).json({
        status: "success",
        message: "Đặt hàng COD thành công",
        data: result,
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

      const result = await mongoose.connection.transaction(async (session) => {
        // 1. Kiểm tra đơn hàng thuộc người đăng nhập
        const existingOrder = await Order.findOne({
          _id: orderId,
          user_id: userId,
        }).session(session);

        if (!existingOrder) {
          throw new AppError("Không tìm thấy đơn hàng", 404);
        }

        // Chỉ hỗ trợ hủy đơn COD chưa thanh toán
        if (
          existingOrder.payment_method !== "COD" ||
          existingOrder.payment_status !== "pending"
        ) {
          throw new AppError(
            "Đơn hàng này cần xử lý hủy hoặc hoàn tiền riêng",
            409,
          );
        }

        if (existingOrder.order_status !== "pending") {
          throw new AppError("Chỉ có thể hủy đơn hàng đang chờ xử lý", 409);
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
            order_status: "pending",
            payment_method: "COD",
            payment_status: "pending",
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

        // 4. Gộp số lượng theo từng biến thể
        const quantities = new Map<string, number>();

        for (const item of items) {
          if (!Number.isSafeInteger(item.quantity) || item.quantity < 1) {
            throw new AppError("Số lượng trong đơn hàng không hợp lệ", 409);
          }

          const variantId = String(item.product_variant_id);
          const total = (quantities.get(variantId) ?? 0) + item.quantity;

          if (!Number.isSafeInteger(total)) {
            throw new AppError("Tổng số lượng hoàn kho không hợp lệ", 409);
          }

          quantities.set(variantId, total);
        }

        // 5. Hoàn lại tồn kho
        for (const [variantId, quantity] of quantities) {
          const result = await ProductVariant.updateOne(
            { _id: variantId },
            { $inc: { stock_quantity: quantity } },
            { session, runValidators: true },
          );

          if (result.matchedCount !== 1) {
            throw new AppError("Không tìm thấy biến thể để hoàn kho", 409);
          }
        }

        // 6. Ghi lịch sử hủy đơn
        await OrderStatusHistory.create(
          [
            {
              order_id: updatedOrder._id,
              status: "cancelled",
              note: "Khách hàng yêu cầu hủy đơn COD",
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

          // Cập nhật có điều kiện để tránh ghi đè trạng thái.
          const updated = await Order.findOneAndUpdate(
            {
              _id: orderId,
              order_status: order.order_status,
            },
            {
              $set: { order_status: status },
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
