import type { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import Category from "../models/categoryModel.js";
import Product from "../models/productModel.js";
import StorefrontProduct from "../models/storefrontProductModel.js";
import ProductVariant from "../models/productVariantModel.js";
import Order from "../models/orderModel.js";
import OrderDetail from "../models/orderDetailModel.js";
import OrderStatusHistory from "../models/orderStatusHistoryModel.js";
import Coupon from "../models/couponModel.js";
import User from "../models/userModel.js";
import Payment from "../models/paymentModel.js";
import ProductComment from "../models/productCommentModel.js";
import Outfit from "../models/outfitModel.js";
import OutfitDetail from "../models/outfitDetailModel.js";
import SizeRecommendation from "../models/sizeRecommendationModel.js";
import Setting from "../models/settingModel.js";
import { AppError } from "../middlewares/AppError.js";
import type { AuthRequest } from "../middlewares/authMiddleware.js";
import { restoreCouponUse, SHIPPING_DEFAULTS } from "../services/checkoutPricing.js";
import { isPaymentMethodConfigured } from "../config/paymentMethods.js";
import { getBankConfig } from "../config/bankConfig.js";
import { STORE_INFO_DEFAULTS } from "../config/storeInfo.js";

function requiredText(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new AppError(`${label} không được để trống.`, 400);
  }
  return value.trim();
}

function categorySlug(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function productInput(body: Record<string, unknown>) {
  const name = requiredText(body.name, "Tên sản phẩm");
  const code = requiredText(body.code, "Mã sản phẩm");
  const color = requiredText(body.color, "Màu sắc");
  const image = requiredText(body.image, "Ảnh sản phẩm");
  const categoryId = requiredText(body.categoryId, "Danh mục");
  const price = Number(body.price);
  const sizes = Array.isArray(body.sizes)
    ? body.sizes
        .filter((size): size is string => typeof size === "string" && Boolean(size.trim()))
        .map((size) => size.trim())
    : [];

  if (!mongoose.isValidObjectId(categoryId)) {
    throw new AppError("Danh mục không hợp lệ.", 400);
  }
  if (!await Category.exists({ _id: categoryId })) {
    throw new AppError("Danh mục không tồn tại.", 404);
  }
  if (!Number.isFinite(price) || price < 0) {
    throw new AppError("Giá sản phẩm phải là số không âm.", 400);
  }
  if (!sizes.length) {
    throw new AppError("Vui lòng nhập ít nhất một kích cỡ.", 400);
  }

  return { name, code, color, image, category_id: categoryId, price, sizes };
}

const DEFAULT_STORE_SETTINGS = {
  ...STORE_INFO_DEFAULTS,
  ...SHIPPING_DEFAULTS,
};

export class AdminController {
  static async getUsers(_req: Request, res: Response, next: NextFunction) {
    try {
      const users = await User.find()
        .select("name email phone role is_blocked auth_provider createdAt")
        .sort({ createdAt: -1 })
        .limit(500)
        .lean();
      res.json({ status: "success", data: users });
    } catch (error) {
      next(error);
    }
  }

  static async updateUserStatus(req: Request, res: Response, next: NextFunction) {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) {
        throw new AppError("Tài khoản không hợp lệ.", 400);
      }
      if (typeof req.body?.is_blocked !== "boolean") {
        throw new AppError("Trạng thái tài khoản không hợp lệ.", 400);
      }

      const user = await User.findById(req.params.id);
      if (!user) throw new AppError("Không tìm thấy tài khoản.", 404);
      if (user.role === "admin") {
        throw new AppError("Không thể khóa hoặc mở khóa tài khoản quản trị.", 403);
      }

      user.is_blocked = req.body.is_blocked;
      await user.save();
      res.json({
        status: "success",
        data: {
          _id: user._id,
          is_blocked: user.is_blocked,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // 1. DASHBOARD & THỐNG KÊ TỔNG QUAN
  static async getDashboardStats(_req: Request, res: Response, next: NextFunction) {
    try {
      const now = new Date();
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

      const [
        totalOrders,
        pendingOrders,
        totalProducts,
        totalCustomers,
        ordersByStatusAgg,
        revenueAgg,
        monthlyRevenueAgg,
        topProductsAgg,
        lowStockCount,
        lowStockVariants,
        recentOrders,
      ] = await Promise.all([
        Order.countDocuments(),
        Order.countDocuments({ order_status: "pending" }),
        Product.countDocuments(),
        User.countDocuments({ role: "customer" }),
        Order.aggregate([
          { $group: { _id: "$order_status", count: { $sum: 1 } } },
        ]),
        Order.aggregate([
          {
            $match: {
              $or: [
                { order_status: "completed" },
                { payment_status: "success" },
              ],
            },
          },
          { $group: { _id: null, total: { $sum: "$final_amount" } } },
        ]),
        Order.aggregate([
          {
            $match: {
              created_at: { $gte: sixMonthsAgo },
              $or: [
                { order_status: "completed" },
                { payment_status: "success" },
              ],
            },
          },
          {
            $group: {
              _id: {
                year: { $year: "$created_at" },
                month: { $month: "$created_at" },
              },
              revenue: { $sum: "$final_amount" },
              orders: { $sum: 1 },
            },
          },
          { $sort: { "_id.year": 1, "_id.month": 1 } },
        ]),
        OrderDetail.aggregate([
          {
            $group: {
              _id: "$product_name",
              total_quantity: { $sum: "$quantity" },
              total_revenue: { $sum: { $multiply: ["$quantity", "$price_at_buy"] } },
            },
          },
          { $sort: { total_quantity: -1 } },
          { $limit: 5 },
        ]),
        ProductVariant.countDocuments({ stock_quantity: { $lte: 10 } }),
        ProductVariant.find({ stock_quantity: { $lte: 10 } })
          .populate("product_id", "name slug")
          .limit(8)
          .lean(),
        Order.find()
          .populate("user_id", "name email phone")
          .sort({ created_at: -1 })
          .limit(6)
          .lean(),
      ]);

      const statusMap: Record<string, number> = {
        pending: 0,
        processing: 0,
        shipping: 0,
        completed: 0,
        cancelled: 0,
      };
      for (const item of ordersByStatusAgg) {
        if (item._id && item._id in statusMap) {
          statusMap[item._id] = item.count;
        }
      }

      // Generate last 6 months list with fallback 0
      const monthlyData = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const y = d.getFullYear();
        const m = d.getMonth() + 1;
        const key = `T${m}/${y}`;
        const match = monthlyRevenueAgg.find(
          (item) => item._id.year === y && item._id.month === m,
        );
        monthlyData.push({
          label: key,
          revenue: match ? match.revenue : 0,
          orders: match ? match.orders : 0,
        });
      }

      const totalRevenue = revenueAgg[0]?.total ?? 0;

      res.json({
        status: "success",
        data: {
          metrics: {
            totalRevenue,
            totalOrders,
            pendingOrders,
            totalProducts,
            totalCustomers,
            lowStockCount,
          },
          ordersByStatus: statusMap,
          monthlyRevenue: monthlyData,
          topProducts: topProductsAgg.map((item) => ({
            name: item._id,
            quantity: item.total_quantity,
            revenue: item.total_revenue,
          })),
          lowStockAlerts: lowStockVariants.map((item) => ({
            _id: item._id,
            sku: item.sku,
            size: item.size,
            color: item.color,
            stock: item.stock_quantity,
            productName: (item.product_id as unknown as { name?: string })?.name ?? "Sản phẩm",
          })),
          recentOrders,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // 2. QUẢN LÝ TỒN KHO (INVENTORY)
  static async getInventory(req: Request, res: Response, next: NextFunction) {
    try {
      const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
      const lowStockOnly = req.query.low_stock === "true";
      const page = Math.max(1, Math.floor(Number(req.query.page) || 1));
      const limit = Math.min(100, Math.max(1, Math.floor(Number(req.query.limit) || 20)));
      if (!Number.isSafeInteger((page - 1) * limit)) throw new AppError("Trang tồn kho không hợp lệ.", 400);

      const filter: Record<string, unknown> = {};
      if (lowStockOnly) {
        filter.stock_quantity = { $lte: 10 };
      }
      if (search) {
        filter.sku = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
      }

      const [variants, total] = await Promise.all([
        ProductVariant.find(filter)
          .populate("product_id", "name slug category_id brand_id status")
          .sort({ stock_quantity: 1, sku: 1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        ProductVariant.countDocuments(filter),
      ]);

      res.json({
        status: "success",
        data: variants,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateInventoryStock(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const stockQuantity = Number(req.body.stock_quantity);

      if (!mongoose.isValidObjectId(id)) {
        throw new AppError("ID biến thể không hợp lệ.", 400);
      }
      if (!Number.isSafeInteger(stockQuantity) || stockQuantity < 0) {
        throw new AppError("Số lượng tồn kho phải là số nguyên không âm.", 400);
      }

      const updated = await ProductVariant.findByIdAndUpdate(
        id,
        { stock_quantity: stockQuantity },
        { new: true, runValidators: true },
      ).populate("product_id", "name");

      if (!updated) {
        throw new AppError("Không tìm thấy biến thể.", 404);
      }

      res.json({
        status: "success",
        message: "Đã cập nhật số lượng tồn kho.",
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  // 3. QUẢN LÝ KHÁCH HÀNG & PHÂN QUYỀN
  static async getCustomers(req: Request, res: Response, next: NextFunction) {
    try {
      const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
      const roleFilter = typeof req.query.role === "string" ? req.query.role.trim() : "";

      const filter: Record<string, unknown> = {};
      if (roleFilter && ["customer", "staff", "admin"].includes(roleFilter)) {
        filter.role = roleFilter;
      }
      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
          { phone: { $regex: search, $options: "i" } },
        ];
      }

      // Security: Strictly exclude password and sensitive tokens
      const users = await User.find(filter)
        .select("-password -wishlist -session_version")
        .sort({ createdAt: -1 })
        .lean();

      // Aggregate spend and order count for each user
      const userIds = users.map((u) => u._id);
      const userOrderStats = await Order.aggregate([
        { $match: { user_id: { $in: userIds } } },
        {
          $group: {
            _id: "$user_id",
            orderCount: { $sum: 1 },
            totalSpent: {
              $sum: {
                $cond: [
                  {
                    $or: [
                      { $eq: ["$order_status", "completed"] },
                      { $eq: ["$payment_status", "success"] },
                    ],
                  },
                  "$final_amount",
                  0,
                ],
              },
            },
          },
        },
      ]);

      const statsMap = new Map<string, { orderCount: number; totalSpent: number }>();
      for (const stat of userOrderStats) {
        statsMap.set(stat._id.toString(), {
          orderCount: stat.orderCount,
          totalSpent: stat.totalSpent,
        });
      }

      const enrichedUsers = users.map((u) => {
        const stats = statsMap.get(u._id.toString()) ?? { orderCount: 0, totalSpent: 0 };
        return {
          ...u,
          orderCount: stats.orderCount,
          totalSpent: stats.totalSpent,
        };
      });

      res.json({ status: "success", data: enrichedUsers });
    } catch (error) {
      next(error);
    }
  }

  static async updateCustomerRole(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { role } = req.body;

      if (!["customer", "staff", "admin"].includes(role)) {
        throw new AppError("Vai trò không hợp lệ.", 400);
      }
      if (req.user?._id?.toString() === id && role !== "admin") {
        throw new AppError("Bạn không thể tự hạ quyền Admin của chính mình.", 400);
      }

      const updated = await User.findByIdAndUpdate(
        id,
        { role },
        { new: true, runValidators: true },
      ).select("-password -wishlist");

      if (!updated) throw new AppError("Không tìm thấy người dùng.", 404);

      res.json({
        status: "success",
        message: `Đã cập nhật vai trò thành ${role}.`,
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  static async toggleCustomerBlock(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      if (req.user?._id?.toString() === id) {
        throw new AppError("Bạn không thể tự khóa tài khoản của chính mình.", 400);
      }

      const target = await User.findById(id);
      if (!target) throw new AppError("Không tìm thấy người dùng.", 404);

      target.is_blocked = !target.is_blocked;
      await target.save();

      res.json({
        status: "success",
        message: target.is_blocked ? "Đã khóa tài khoản." : "Đã kích hoạt lại tài khoản.",
        data: { _id: target._id, is_blocked: target.is_blocked },
      });
    } catch (error) {
      next(error);
    }
  }

  // 4. QUẢN LÝ GIAO DỊCH THANH TOÁN (PAYMENTS)
  static async getPayments(req: Request, res: Response, next: NextFunction) {
    try {
      const statusFilter = typeof req.query.status === "string" ? req.query.status.trim() : "";
      const methodFilter = typeof req.query.method === "string" ? req.query.method.trim() : "";

      const filter: Record<string, unknown> = {};
      if (statusFilter && ["pending", "success", "failed"].includes(statusFilter)) {
        filter.status = statusFilter;
      }
      if (methodFilter && ["VNPay", "MoMo", "BankTransfer"].includes(methodFilter)) {
        filter.payment_method = methodFilter;
      }

      const payments = await Payment.find(filter)
        .populate("order_id", "receiver_name receiver_phone final_amount order_status payment_method created_at")
        .sort({ created_at: -1 })
        .limit(100)
        .lean();

      res.json({ status: "success", data: payments });
    } catch (error) {
      next(error);
    }
  }

  // 5. QUẢN LÝ ĐÁNH GIÁ SẢN PHẨM (REVIEWS)
  static async getReviews(_req: Request, res: Response, next: NextFunction) {
    try {
      const comments = await ProductComment.find()
        .sort({ createdAt: -1 })
        .limit(100)
        .lean();
      res.json({ status: "success", data: comments });
    } catch (error) {
      next(error);
    }
  }

  static async deleteReview(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const deleted = await ProductComment.findByIdAndDelete(id);
      if (!deleted) throw new AppError("Không tìm thấy đánh giá cần xóa.", 404);
      res.json({ status: "success", message: "Đã xóa đánh giá sản phẩm." });
    } catch (error) {
      next(error);
    }
  }

  // 6. QUẢN LÝ OUTFIT LOOKBOOK
  static async getOutfits(_req: Request, res: Response, next: NextFunction) {
    try {
      const outfits = await Outfit.find().sort({ created_at: -1 }).lean();
      const outfitIds = outfits.map((o) => o._id);
      const details = await OutfitDetail.find({ outfit_id: { $in: outfitIds } })
        .populate("product_id", "name slug")
        .sort({ display_order: 1 })
        .lean();

      const detailsByOutfit = new Map<string, typeof details>();
      for (const d of details) {
        const id = d.outfit_id.toString();
        detailsByOutfit.set(id, [...(detailsByOutfit.get(id) ?? []), d]);
      }

      const result = outfits.map((o) => ({
        ...o,
        items: detailsByOutfit.get(o._id.toString()) ?? [],
      }));

      res.json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  }

  static async saveOutfit(req: Request, res: Response, next: NextFunction) {
    try {
      const title = requiredText(req.body.title, "Tên bộ phối");
      const image = requiredText(req.body.image, "Ảnh Lookbook");
      const description = typeof req.body.description === "string" ? req.body.description.trim() : "";
      const discountType = req.body.discount_type === "fixed" ? "fixed" : "percent";
      const discountValue = Number(req.body.discount_value ?? 10);
      const isActive = req.body.is_active !== false;
      const rawProductIds: unknown = req.body.product_ids;
      if (!Number.isFinite(discountValue) || discountValue < 0 || (discountType === "percent" && discountValue > 100)) {
        throw new AppError("Mức giảm giá bộ phối không hợp lệ.", 400);
      }
      if (rawProductIds !== undefined && (!Array.isArray(rawProductIds)
        || rawProductIds.some((productId) => typeof productId !== "string" || !mongoose.isObjectIdOrHexString(productId)))) {
        throw new AppError("Danh sách sản phẩm của bộ phối không hợp lệ.", 400);
      }
      const productIds = Array.isArray(rawProductIds) ? [...new Set<string>(rawProductIds)] : [];
      if (productIds.length && await Product.countDocuments({ _id: { $in: productIds } }) !== productIds.length) {
        throw new AppError("Một số sản phẩm của bộ phối không còn tồn tại.", 404);
      }

      const { id } = req.params;
      let outfit;
      if (id) {
        outfit = await Outfit.findByIdAndUpdate(
          id,
          { title, image, description, discount_type: discountType, discount_value: discountValue, is_active: isActive },
          { new: true, runValidators: true },
        );
        if (!outfit) throw new AppError("Không tìm thấy Outfit.", 404);
      } else {
        outfit = await Outfit.create({
          title,
          image,
          description,
          discount_type: discountType,
          discount_value: discountValue,
          is_active: isActive,
        });
      }

      // Update details if provided
      if (Array.isArray(rawProductIds)) {
        await OutfitDetail.deleteMany({ outfit_id: outfit._id });
        if (productIds.length) {
          const detailDocs = productIds.map((pId, index) => ({
              outfit_id: outfit._id,
              product_id: new mongoose.Types.ObjectId(pId),
              display_order: index + 1,
              is_required: true,
            }));
          if (detailDocs.length) {
            await OutfitDetail.insertMany(detailDocs);
          }
        }
      }

      res.status(id ? 200 : 201).json({ status: "success", data: outfit });
    } catch (error) {
      next(error);
    }
  }

  static async deleteOutfit(req: Request, res: Response, next: NextFunction) {
    try {
      const id = typeof req.params.id === "string" ? req.params.id : "";
      const outfit = await Outfit.findByIdAndDelete(id);
      if (!outfit) throw new AppError("Không tìm thấy Outfit.", 404);
      if (mongoose.isValidObjectId(id)) {
        await OutfitDetail.deleteMany({ outfit_id: new mongoose.Types.ObjectId(id) });
      }
      res.json({ status: "success", message: "Đã xóa bộ phối đồ." });
    } catch (error) {
      next(error);
    }
  }

  // 7. QUẢN LÝ TƯ VẤN SIZE (SIZE RECOMMENDATIONS)
  static async getSizeRecommendations(_req: Request, res: Response, next: NextFunction) {
    try {
      const recs = await SizeRecommendation.find()
        .populate("category_id", "name slug")
        .sort({ size: 1 })
        .lean();
      res.json({ status: "success", data: recs });
    } catch (error) {
      next(error);
    }
  }

  static async saveSizeRecommendation(req: Request, res: Response, next: NextFunction) {
    try {
      const categoryId = requiredText(req.body.category_id, "Danh mục");
      const size = requiredText(req.body.size, "Kích cỡ").toUpperCase();
      const minHeight = Number(req.body.min_height);
      const maxHeight = Number(req.body.max_height);
      const minWeight = Number(req.body.min_weight);
      const maxWeight = Number(req.body.max_weight);
      const fitType = req.body.fit_type ?? "Regular";

      if (!mongoose.isValidObjectId(categoryId)) {
        throw new AppError("ID danh mục không hợp lệ.", 400);
      }
      if (!await Category.exists({ _id: categoryId })) {
        throw new AppError("Danh mục không tồn tại.", 404);
      }
      if ([minHeight, maxHeight, minWeight, maxWeight].some((value) => !Number.isFinite(value) || value <= 0)) {
        throw new AppError("Chiều cao và cân nặng phải là số dương.", 400);
      }
      if (minHeight >= maxHeight || minWeight >= maxWeight) {
        throw new AppError("Khoảng chiều cao hoặc cân nặng tối thiểu phải nhỏ hơn tối đa.", 400);
      }

      const { id } = req.params;
      const payload = {
        category_id: categoryId,
        size,
        min_height: minHeight,
        max_height: maxHeight,
        min_weight: minWeight,
        max_weight: maxWeight,
        fit_type: fitType,
      };

      const record = id
        ? await SizeRecommendation.findByIdAndUpdate(id, payload, { new: true, runValidators: true })
        : await SizeRecommendation.create(payload);

      if (!record) throw new AppError("Không tìm thấy cấu hình size.", 404);

      res.status(id ? 200 : 201).json({ status: "success", data: record });
    } catch (error) {
      next(error);
    }
  }

  static async deleteSizeRecommendation(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const deleted = await SizeRecommendation.findByIdAndDelete(id);
      if (!deleted) throw new AppError("Không tìm thấy cấu hình size.", 404);
      res.json({ status: "success", message: "Đã xóa quy tắc gợi ý size." });
    } catch (error) {
      next(error);
    }
  }

  // 8. HỦY ĐƠN HÀNG DÀNH CHO ADMIN / STAFF
  static async cancelOrderAdmin(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const note = typeof req.body.note === "string" ? req.body.note.trim() : "Quản trị viên hủy đơn hàng";

      if (!mongoose.isValidObjectId(id)) {
        throw new AppError("ID đơn hàng không hợp lệ.", 400);
      }

      const result = await mongoose.connection.transaction(async (session) => {
        const order = await Order.findById(id).session(session);
        if (!order) throw new AppError("Không tìm thấy đơn hàng.", 404);
        if (!["pending", "processing"].includes(order.order_status)) {
          throw new AppError(`Không thể hủy đơn hàng đang ở trạng thái ${order.order_status}.`, 409);
        }
        if (order.payment_status === "success") {
          throw new AppError("Cần xử lý hoàn tiền trước khi hủy đơn đã thanh toán.", 409);
        }

        const items = await OrderDetail.find({ order_id: order._id }).session(session);

        // Hoàn lại kho cho từng biến thể
        for (const item of items) {
          if (item.product_variant_id) {
            await ProductVariant.updateOne(
              { _id: item.product_variant_id },
              { $inc: { stock_quantity: item.quantity } },
              { session },
            );
          }
        }

        order.order_status = "cancelled";
        await order.save({ session });
        await restoreCouponUse(order.coupon_id, session);

        const historyRecord = new OrderStatusHistory({
          order_id: order._id,
          status: "cancelled",
          note,
          changed_by: req.user?._id,
        });
        await historyRecord.save({ session });

        return order;
      });

      res.json({ status: "success", message: "Đã hủy đơn hàng và hoàn lại tồn kho.", data: result });
    } catch (error) {
      next(error);
    }
  }

  // 9. CẤU HÌNH CỬA HÀNG (SETTINGS)
  static async getSettings(_req: Request, res: Response, next: NextFunction) {
    try {
      const setting = await Setting.findOne({ key: "store_config" }).lean();
      const config = setting?.value as Record<string, unknown> | undefined;
      const bank = isPaymentMethodConfigured("BankTransfer") ? getBankConfig() : null;
      res.json({
        status: "success",
        data: {
          ...DEFAULT_STORE_SETTINGS, ...config,
          bank_name: bank?.bank_name ?? "",
          bank_account_no: bank?.account_number ?? "",
          bank_account_name: bank?.account_name ?? "",
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const values = req.body as Record<string, unknown> | undefined;
      for (const key of Object.keys(STORE_INFO_DEFAULTS)) {
        if (values?.[key] !== undefined) requiredText(values[key], "Thông tin cửa hàng");
      }
      for (const key of Object.keys(SHIPPING_DEFAULTS)) {
        const value = values?.[key];
        if (value !== undefined && (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)) {
          throw new AppError("Phí và ngưỡng miễn phí vận chuyển phải là số nguyên không âm.", 400);
        }
      }
      const updates = Object.fromEntries(Object.keys(DEFAULT_STORE_SETTINGS)
        .filter((key) => values?.[key] !== undefined)
        .map((key) => [`value.${key}`, values?.[key]]));
      if (!Object.keys(updates).length) throw new AppError("Vui lòng nhập giá trị cấu hình.", 400);
      const updated = await Setting.findOneAndUpdate(
        { key: "store_config" },
        { $set: updates },
        { upsert: true, new: true, runValidators: true },
      );
      res.json({ status: "success", message: "Đã lưu cài đặt cửa hàng.", data: updated.value });
    } catch (error) {
      next(error);
    }
  }

  // 10. ĐƠN HÀNG (ORDERS)
  static async getOrders(_req: Request, res: Response, next: NextFunction) {
    try {
      const orders = await Order.find()
        .populate("user_id", "name email phone")
        .sort({ created_at: -1 })
        .limit(200)
        .lean();
      const orderIds = orders.map((order) => order._id);
      const details = await OrderDetail.find({ order_id: { $in: orderIds } })
        .select("order_id product_name sku size color quantity price_at_buy")
        .lean();
      const detailsByOrder = new Map<string, typeof details>();
      for (const detail of details) {
        const orderId = detail.order_id.toString();
        detailsByOrder.set(orderId, [...(detailsByOrder.get(orderId) ?? []), detail]);
      }
      res.json({
        status: "success",
        data: orders.map((order) => ({
          ...order,
          items: detailsByOrder.get(order._id.toString()) ?? [],
        })),
      });
    } catch (error) {
      next(error);
    }
  }

  // 11. MÃ GIẢM GIÁ (COUPONS)
  static async getCoupons(_req: Request, res: Response, next: NextFunction) {
    try {
      const coupons = await Coupon.find().sort({ start_date: -1 }).lean();
      res.json({ status: "success", data: coupons });
    } catch (error) {
      next(error);
    }
  }

  static async saveCoupon(req: Request, res: Response, next: NextFunction) {
    try {
      const code = requiredText(req.body.code, "Mã giảm giá").toUpperCase();
      const discountType = req.body.discount_type;
      const discountValue = Number(req.body.discount_value);
      const minOrderValue = Number(req.body.min_order_value ?? 0);
      const maxDiscount = req.body.max_discount === "" || req.body.max_discount == null
        ? null
        : Number(req.body.max_discount);
      const usageLimit = Number(req.body.usage_limit);
      const startDate = new Date(req.body.start_date);
      const endDate = new Date(req.body.end_date);

      if (discountType !== "percent" && discountType !== "fixed") {
        throw new AppError("Loại giảm giá không hợp lệ.", 400);
      }
      if (!Number.isFinite(discountValue) || discountValue <= 0
        || (discountType === "percent" && discountValue > 100)) {
        throw new AppError("Giá trị giảm giá không hợp lệ.", 400);
      }
      if (!Number.isFinite(minOrderValue) || minOrderValue < 0
        || (maxDiscount !== null && (!Number.isFinite(maxDiscount) || maxDiscount < 0))) {
        throw new AppError("Điều kiện giá trị đơn hàng hoặc mức giảm tối đa không hợp lệ.", 400);
      }
      if (!Number.isInteger(usageLimit) || usageLimit < 1) {
        throw new AppError("Lượt sử dụng tối đa phải là số nguyên lớn hơn 0.", 400);
      }
      if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate <= startDate) {
        throw new AppError("Thời gian áp dụng mã giảm giá không hợp lệ.", 400);
      }

      const values = {
        code,
        discount_type: discountType,
        discount_value: discountValue,
        min_order_value: minOrderValue,
        max_discount: maxDiscount,
        usage_limit: usageLimit,
        start_date: startDate,
        end_date: endDate,
        status: req.body.status !== false,
      };
      const couponId = req.params.id;
      const coupon = couponId
        ? await Coupon.findByIdAndUpdate(couponId, values, { new: true, runValidators: true })
        : await Coupon.create(values);
      if (!coupon) throw new AppError("Không tìm thấy mã giảm giá.", 404);
      res.status(couponId ? 200 : 201).json({ status: "success", data: coupon });
    } catch (error) {
      next(error);
    }
  }

  static async deleteCoupon(req: Request, res: Response, next: NextFunction) {
    try {
      const coupon = await Coupon.findByIdAndDelete(req.params.id);
      if (!coupon) throw new AppError("Không tìm thấy mã giảm giá.", 404);
      res.json({ status: "success", message: "Đã xóa mã giảm giá." });
    } catch (error) {
      next(error);
    }
  }

  // 12. DANH MỤC & SẢN PHẨM CƠ BẢN
  static async createCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const name = requiredText(req.body.name, "Tên danh mục");
      const category = await Category.create({
        name,
        slug: categorySlug(name),
        description: typeof req.body.description === "string" ? req.body.description.trim() : "",
      });
      res.status(201).json({ status: "success", data: category });
    } catch (error) {
      next(error);
    }
  }

  static async updateCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const name = requiredText(req.body.name, "Tên danh mục");
      const category = await Category.findByIdAndUpdate(
        req.params.id,
        {
          name,
          slug: categorySlug(name),
          ...(typeof req.body.description === "string" ? { description: req.body.description.trim() } : {}),
        },
        { new: true, runValidators: true },
      );
      if (!category) throw new AppError("Không tìm thấy danh mục.", 404);
      res.json({ status: "success", data: category });
    } catch (error) {
      next(error);
    }
  }

  static async deleteCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const category = await Category.findById(req.params.id);
      if (!category) throw new AppError("Không tìm thấy danh mục.", 404);
      const [child, product, legacyProduct] = await Promise.all([
        Category.exists({ parent_id: category._id }),
        Product.exists({ category_id: category._id }),
        StorefrontProduct.exists({ category_id: category._id }),
      ]);
      if (child) throw new AppError("Danh mục đang có danh mục con.", 409);
      if (product || legacyProduct) {
        throw new AppError("Danh mục đang có sản phẩm. Hãy chuyển hoặc xóa sản phẩm trước.", 409);
      }
      await category.deleteOne();
      res.json({ status: "success", message: "Đã xóa danh mục." });
    } catch (error) {
      next(error);
    }
  }

  static async createProduct(req: Request, res: Response, next: NextFunction) {
    try {
      const product = await StorefrontProduct.create(await productInput(req.body));
      await product.populate("category_id", "name slug");
      res.status(201).json({ status: "success", data: product });
    } catch (error) {
      next(error);
    }
  }

  static async updateProduct(req: Request, res: Response, next: NextFunction) {
    try {
      const product = await StorefrontProduct.findByIdAndUpdate(
        req.params.id,
        await productInput(req.body),
        { new: true, runValidators: true },
      ).populate("category_id", "name slug");
      if (!product) throw new AppError("Không tìm thấy sản phẩm.", 404);
      res.json({ status: "success", data: product });
    } catch (error) {
      next(error);
    }
  }

  static async deleteProduct(req: Request, res: Response, next: NextFunction) {
    try {
      const product = await StorefrontProduct.findByIdAndDelete(req.params.id);
      if (!product) throw new AppError("Không tìm thấy sản phẩm.", 404);
      res.json({ status: "success", message: "Đã xóa sản phẩm." });
    } catch (error) {
      next(error);
    }
  }
}
