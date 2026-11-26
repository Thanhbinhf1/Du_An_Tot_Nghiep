import { lockCategoryTree } from "../services/catalogMutation.js";
import { assertCategoryReference } from "../services/categoryPolicy.js";
import type { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import Category from "../models/categoryModel.js";
import Product from "../models/productModel.js";
import StorefrontProduct from "../models/storefrontProductModel.js";
import ProductVariant from "../models/productVariantModel.js";
import ProductImage from "../models/productImageModel.js";
import InventoryMovement from "../models/inventoryMovementModel.js";
import Order from "../models/orderModel.js";
import OrderDetail from "../models/orderDetailModel.js";
import OrderStatusHistory from "../models/orderStatusHistoryModel.js";
import Coupon from "../models/couponModel.js";
import User from "../models/userModel.js";
import Payment from "../models/paymentModel.js";
import ProductComment from "../models/productCommentModel.js";
import Outfit from "../models/outfitModel.js";
import OutfitDetail from "../models/outfitDetailModel.js";
import SizeRecommendation, { ProductSizeChart, bodyFields } from "../models/sizeRecommendationModel.js";
import { readChartRow } from "../services/sizeGuide.js";
import { isImageUrl } from "../services/catalogValidation.js";
import Setting from "../models/settingModel.js";
import { AppError } from "../middlewares/AppError.js";
import type { AuthRequest } from "../middlewares/authMiddleware.js";
import { restoreCouponUse, SHIPPING_DEFAULTS } from "../services/checkoutPricing.js";
import { getProvince } from "../services/addressLocations.js";
import { isPaymentMethodConfigured, isStoredPaymentMethod } from "../config/paymentMethods.js";
import { getBankConfig } from "../config/bankConfig.js";
import { STORE_INFO_DEFAULTS } from "../config/storeInfo.js";
import { restoreOrderStock } from "../services/orderStock.js";
import { literalSearch, paginationMetadata, readPagination } from "../services/listQuery.js";
import { deliveredSales, stockAdvice } from "../services/adminAnalytics.js";
import { reviewWords, moderatedReview } from "../services/reviewModeration.js";
import { orderQueueFilter } from "../services/adminOrderQueues.js";

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

async function productInput(body: Record<string, unknown>, session: mongoose.ClientSession) {
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
  await assertCategoryReference(categoryId,session);
  if (!Number.isSafeInteger(price) || price < 0) {
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
  express_shipping_province_code: null,
  express_shipping_ward_codes: [] as number[],
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

  // 2. QUẢN LÝ TỒN KHO (INVENTORY)
  static async getInventory(req: Request, res: Response, next: NextFunction) {
    try {
      const search = literalSearch(req.query.search);
      const lowStockOnly = req.query.low_stock === "true";
      const { page, limit, skip } = readPagination(req.query, 20);
      const categoryId = req.query.category_id;
      if (categoryId !== undefined && (typeof categoryId !== "string" || !mongoose.isObjectIdOrHexString(categoryId))) {
        throw new AppError("Danh mục không hợp lệ.", 400);
      }
      const categoryProductIds = categoryId === undefined ? undefined
        : await Product.find({ category_id: categoryId }).distinct("_id");
      const scoped: Record<string, unknown> = categoryProductIds ? { product_id: { $in: categoryProductIds } } : {};
      if (search) {
        const match = { $regex: search, $options: "i" };
        const products = await Product.find({ ...categoryProductIds && { _id: { $in: categoryProductIds } }, name: match }).distinct("_id");
        scoped.$or = [{ sku: match }, { size: match }, { color: match }, { product_id: { $in: products } }];
      }
      const buckets = {
        all: {},
        in_stock: { stock_quantity: { $gt: 10 } },
        low: { stock_quantity: { $gt: 0, $lte: 10 } },
        out: { stock_quantity: 0 },
        quarantine: { quarantine_quantity: { $gt: 0 } },
      };
      const bucket = req.query.bucket ?? "all";
      if (typeof bucket !== "string" || !Object.hasOwn(buckets, bucket)) {
        throw new AppError("Bộ lọc tồn kho không hợp lệ.", 400);
      }
      const selectedBucket = buckets[bucket as keyof typeof buckets];
      const filter = lowStockOnly ? { $and: [scoped, selectedBucket, { stock_quantity: { $lte: 10 } }] } : { ...scoped, ...selectedBucket };
      const [variants, total, statusCounts] = await Promise.all([
        ProductVariant.find(filter)
          .populate("product_id", "name slug category_id brand_id status")
          .sort({ stock_quantity: 1, sku: 1, _id: 1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        ProductVariant.countDocuments(filter),
        Promise.all(Object.entries(buckets).map(async ([key, criteria]) =>
          [key, await ProductVariant.countDocuments({ ...scoped, ...criteria })] as const)),
      ]);

      const ids = variants.map((variant) => variant._id);
      const productIds = variants.flatMap((variant) => variant.product_id ? [variant.product_id._id] : []);
      const [sales, heldRows, images] = await Promise.all([
        deliveredSales(new Date(), ids),
        OrderDetail.aggregate<{ _id: mongoose.Types.ObjectId; amount: number }>([
          { $match: { product_variant_id: { $in: ids } } },
          { $lookup: { from: Order.collection.name, localField: "order_id", foreignField: "_id", as: "order" } },
          { $match: { "order.order_status": { $in: ["pending", "processing"] } } },
          { $group: { _id: "$product_variant_id", amount: { $sum: "$quantity" } } },
        ]),
        ProductImage.find({ product_id: { $in: productIds } }).sort({ is_primary: -1, display_order: 1, _id: 1 }).select("product_id image_url").lean(),
      ]);
      const sold = new Map(sales.map((sale) => [String(sale._id.variant), sale.quantity]));
      const held = new Map(heldRows.map((row) => [String(row._id), row.amount]));
      res.json({
        status: "success",
        data: variants.map((variant) => ({
          ...variant,
          held_quantity: held.get(String(variant._id)) ?? 0,
          image: images.find((image) => String(image.product_id) === String(variant.product_id?._id))?.image_url,
          ...stockAdvice(variant.stock_quantity, sold.get(String(variant._id)) ?? 0),
        })),
        pagination: { ...paginationMetadata(page, limit, total), statusCounts: Object.fromEntries(statusCounts) },
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateInventoryStock(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const stockQuantity: unknown = req.body?.stock_quantity;

      if (typeof id !== "string" || !mongoose.isValidObjectId(id)) {
        throw new AppError("ID biến thể không hợp lệ.", 400);
      }
      if (typeof stockQuantity !== "number" || !Number.isSafeInteger(stockQuantity) || stockQuantity < 0) {
        throw new AppError("Số lượng tồn kho phải là số nguyên không âm.", 400);
      }
      const version: unknown = req.body?.expected_version;
      if (typeof version !== "number" || !Number.isSafeInteger(version) || version < 0) {
        throw new AppError("Vui lòng tải lại tồn kho trước khi cập nhật.", 400);
      }

      const note: unknown = req.body?.note;
      if (note !== undefined && (typeof note !== "string" || !note.trim() || note.trim().length > 1000)) {
        throw new AppError("Lý do điều chỉnh tồn phải từ 1 đến 1000 ký tự.", 400);
      }

      const updated = await mongoose.connection.transaction(async (session) => {
        const previous = await ProductVariant.findOneAndUpdate(
          { _id: id, ...(version === 0 ? { $or: [{ __v: 0 }, { __v: { $exists: false } }] } : { __v: version }) },
          { $set: { stock_quantity: stockQuantity }, $inc: { __v: 1 } },
          { session, returnDocument: "before", runValidators: true },
        ).populate("product_id", "name").lean();
        if (!previous) {
          if (!await ProductVariant.exists({ _id: id }).session(session)) throw new AppError("Không tìm thấy biến thể.", 404);
          throw new AppError("Tồn kho vừa thay đổi. Vui lòng tải lại trước khi lưu.", 409);
        }
        await InventoryMovement.create([{
          variant_id: previous._id,
          actor_id: req.user!._id,
          kind: "adjustment",
          stock_delta: stockQuantity - previous.stock_quantity,
          quarantine_delta: 0,
          note: typeof note === "string" ? `Kiểm kê: ${note.trim()}` : "Điều chỉnh tồn qua API tương thích cũ.",
        }], { session });
        return { ...previous, stock_quantity: stockQuantity, __v: version + 1 };
      });

      res.json({
        status: "success",
        message: "Đã cập nhật số lượng tồn kho.",
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  // 4. QUẢN LÝ GIAO DỊCH THANH TOÁN (PAYMENTS)
  static async getPayments(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit, skip } = readPagination(req.query);
      const statusFilter = typeof req.query.status === "string" ? req.query.status.trim() : "";
      const methodFilter = typeof req.query.method === "string" ? req.query.method.trim() : "";

      const filter: Record<string, unknown> = {};
      if (statusFilter && ["pending", "success", "failed"].includes(statusFilter)) {
        filter.status = statusFilter;
      }
      if (methodFilter && ["PayOS", "VNPay", "SePay", "MoMo", "BankTransfer"].includes(methodFilter)) {
        filter.payment_method = methodFilter;
      }

      const [payments, total, totals] = await Promise.all([Payment.find(filter)
        .populate("order_id", "receiver_name receiver_phone final_amount order_status payment_status refund payment_method created_at")
        .sort({ created_at: -1, _id: -1 })
        .skip(skip).limit(limit)
        .lean(), Payment.countDocuments(filter),
        req.query.summary === "1" ? Payment.aggregate([
          { $match: filter },
          { $lookup: { from: Order.collection.name, localField: "order_id", foreignField: "_id", as: "orders" } },
          { $set: { order: { $first: "$orders" } } },
          { $group: {
            _id: null,
            collected: { $sum: { $cond: [{ $eq: ["$status", "success"] }, "$order.final_amount", 0] } },
            refunded: { $sum: { $cond: [{ $and: [{ $eq: ["$status", "success"] }, { $eq: ["$order.payment_status", "refunded"] }] }, "$order.refund.amount", 0] } },
            pending: { $sum: { $cond: [{ $and: [{ $eq: ["$status", "pending"] }, { $eq: ["$order.order_status", "pending"] }] }, 1, 0] } },
          } },
          { $project: { _id: 0 } },
        ]) : [],
      ]);

      res.json({ status: "success", data: payments, pagination: { ...paginationMetadata(page, limit, total), ...(req.query.summary === "1" ? { paymentTotals: totals[0] ?? { collected: 0, refunded: 0, pending: 0 } } : {}) } });
    } catch (error) {
      next(error);
    }
  }

  // 5. QUẢN LÝ ĐÁNH GIÁ SẢN PHẨM (REVIEWS)
  static async getReviews(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit, skip } = readPagination(req.query);
      const filter: Record<string, unknown> = {};
      const search = literalSearch(req.query.search);
      if (search) filter.$or = ["product_key", "user_name", "user_email", "comment"].map((field) => ({ [field]: { $regex: search, $options: "i" } }));
      if (req.query.rating !== undefined && req.query.rating !== "") {
        const rating = Number(req.query.rating);
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new AppError("Số sao không hợp lệ.", 400);
        filter.rating = rating;
      }
      const [comments, total] = await Promise.all([ProductComment.find(filter)
        .sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(), ProductComment.countDocuments(filter)]);
      const words = await reviewWords();
      res.json({ status: "success", data: comments.map((review) => ({ ...review, public_comment: moderatedReview(review, words).comment })), pagination: paginationMetadata(page, limit, total) });
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
      const style = typeof req.body.style === "string" ? req.body.style.trim() : undefined;
      const occasion = typeof req.body.occasion === "string" ? req.body.occasion.trim() : undefined;
      const gallery: unknown = req.body.gallery;
      if (gallery !== undefined && (!Array.isArray(gallery) || gallery.length > 6 || !gallery.every(isImageUrl))) {
        throw new AppError("Thêm tối đa 6 ảnh phụ bằng URL HTTP(S) hoặc đường dẫn tải lên hợp lệ.", 400);
      }
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
      if (id && !mongoose.isValidObjectId(id)) throw new AppError("ID Outfit không hợp lệ.", 400);
      const outfit = await mongoose.connection.transaction(async (session) => {
        let outfit;
        const values = { title, image, description, style, occasion, ...(gallery === undefined ? {} : { gallery }),
          discount_type: discountType as "fixed" | "percent", discount_value: discountValue, is_active: isActive };
        if (id) {
          outfit = await Outfit.findByIdAndUpdate(id, values, { session, new: true, runValidators: true });
          if (!outfit) throw new AppError("Không tìm thấy Outfit.", 404);
        } else {
          const created = await Outfit.create([values], { session });
          outfit = created[0];
          if (!outfit) throw new AppError("Không thể tạo Outfit.", 500);
        }

        if (Array.isArray(rawProductIds)) {
          await OutfitDetail.deleteMany({ outfit_id: outfit._id }, { session });
          if (productIds.length) {
            await OutfitDetail.insertMany(productIds.map((productId, index) => ({
              outfit_id: outfit._id,
              product_id: new mongoose.Types.ObjectId(productId),
              display_order: index + 1,
              is_required: true,
            })), { session });
          }
        }
        return outfit;
      });

      res.status(id ? 200 : 201).json({ status: "success", data: outfit });
    } catch (error) {
      next(error);
    }
  }

  static async deleteOutfit(req: Request, res: Response, next: NextFunction) {
    try {
      const id = typeof req.params.id === "string" ? req.params.id : "";
      if (!mongoose.isValidObjectId(id)) throw new AppError("ID Outfit không hợp lệ.", 400);
      await mongoose.connection.transaction(async (session) => {
        const outfit = await Outfit.findByIdAndDelete(id, { session });
        if (!outfit) throw new AppError("Không tìm thấy Outfit.", 404);
        await OutfitDetail.deleteMany({ outfit_id: outfit._id }, { session });
      });
      res.json({ status: "success", message: "Đã xóa bộ phối đồ." });
    } catch (error) {
      next(error);
    }
  }

  // 7. QUẢN LÝ TƯ VẤN SIZE (SIZE RECOMMENDATIONS)
  static async getSizeRecommendations(_req: Request, res: Response, next: NextFunction) {
    try {
      const [categories, products] = await Promise.all([
        SizeRecommendation.find().populate("category_id", "name slug").sort({ size: 1 }).lean(),
        ProductSizeChart.find().populate("product_id", "name slug").sort({ size: 1 }).lean(),
      ]);
      res.json({ status: "success", data: [...categories, ...products.map((row) => ({ ...row, scope: "product" }))] });
    } catch (error) {
      next(error);
    }
  }

  static async saveSizeRecommendation(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      if (id && (typeof id !== "string" || !mongoose.isObjectIdOrHexString(id))) throw new AppError("ID quy tắc không hợp lệ.", 400);
      const isProduct = req.body.product_id != null && req.body.product_id !== "";
      const label = isProduct ? "Sản phẩm" : "Danh mục";
      const targetId = requiredText(isProduct ? req.body.product_id : req.body.category_id, label);
      if (!mongoose.isObjectIdOrHexString(targetId)) throw new AppError(`ID ${label.toLowerCase()} không hợp lệ.`, 400);
      if (!(isProduct ? await Product.exists({ _id: targetId }) : await Category.exists({ _id: targetId }))) {
        throw new AppError(`${label} không tồn tại.`, 404);
      }
      const row = readChartRow(req.body);
      const optional = [...bodyFields.flatMap((field) => [`min_${field}`, `max_${field}`] as const), "garment"] as const;
      const unset = Object.fromEntries(optional.filter((key) => row[key] === undefined).map((key) => [key, 1]));
      const record = isProduct
        ? id
          ? await ProductSizeChart.findByIdAndUpdate(id, { $set: { ...row, product_id: targetId }, $unset: unset }, { new: true, runValidators: true })
          : await ProductSizeChart.create({ ...row, product_id: targetId })
        : id
          ? await SizeRecommendation.findByIdAndUpdate(id, { $set: { ...row, category_id: targetId }, $unset: unset }, { new: true, runValidators: true })
          : await SizeRecommendation.create({ ...row, category_id: targetId });

      if (!record) throw new AppError("Không tìm thấy cấu hình size.", 404);

      res.status(id ? 200 : 201).json({ status: "success", data: record });
    } catch (error) {
      next(error);
    }
  }

  static async deleteSizeRecommendation(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      if (typeof id !== "string" || !mongoose.isObjectIdOrHexString(id)) throw new AppError("ID quy tắc không hợp lệ.", 400);
      const deleted = await SizeRecommendation.findByIdAndDelete(id) ?? await ProductSizeChart.findByIdAndDelete(id);
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
          if (req.body.acknowledge_refund !== true) throw new AppError("Đơn đã thu tiền. Cần xác nhận đưa đơn vào danh sách chờ hoàn tiền.", 409);
          if (req.user?.role !== "admin") throw new AppError("Chỉ quản trị viên được hủy đơn đã thu tiền.", 403);
          if (typeof req.body.note !== "string" || !note || note.length > 1000) throw new AppError("Vui lòng ghi lý do hủy đơn, tối đa 1000 ký tự.", 400);
        }

        if (order.payment_method === "PayOS" && order.payment_status === "pending") {
          if (req.user?.role !== "admin") throw new AppError("Cần quản trị viên đối soát đơn từ cổng cũ.", 403);
          if (req.body.legacy_link_closed !== true || typeof req.body.note !== "string" || !note || note.length > 1000) throw new AppError("Cần xác nhận đã đối soát, đóng liên kết cũ và ghi lý do trước khi hủy.", 409);
          await Payment.updateOne({ order_id: order._id, payment_method: order.payment_method, status: "pending" }, { $set: { status: "failed" } }, { session });
          order.payment_status = "failed";
        }

        if (order.payment_method === "SePay" && order.payment_status === "pending") {
          await Payment.updateOne({ order_id: order._id, payment_method: "SePay", status: "pending" }, { $set: { status: "failed" } }, { session });
          order.payment_status = "failed";
        }
        const items = await OrderDetail.find({ order_id: order._id }).session(session);

        await restoreOrderStock(items, session);

        order.order_status = "cancelled";
        await order.save({ session });
        await restoreCouponUse(order.coupon_id, session);

        const historyRecord = new OrderStatusHistory({
          order_id: order._id,
          status: "cancelled",
          note: order.payment_status === "success" ? note + " · Chờ hoàn tiền cho khách." : order.payment_method === "PayOS" && req.body.legacy_link_closed === true ? note + " · Quản trị viên đã kiểm tra liên kết cũ và xác nhận chưa thu tiền." : note,
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
      const expressProvince = values?.express_shipping_province_code;
      const expressWards = values?.express_shipping_ward_codes;
      if (expressWards !== undefined && (!Array.isArray(expressWards) || expressProvince === undefined)) {
        throw new AppError("Cần gửi tỉnh/thành cùng danh sách phường, xã giao hỏa tốc.", 400);
      }
      if (expressProvince !== undefined && expressProvince !== null) {
        if (typeof expressProvince !== "number") throw new AppError("Mã tỉnh/thành giao hỏa tốc không hợp lệ.", 400);
        const wards = new Set(getProvince(expressProvince).wards.map(({ code }) => code));
        if (Array.isArray(expressWards) && expressWards.some((code) => !wards.has(code))) {
          throw new AppError("Phường, xã giao hỏa tốc phải thuộc tỉnh/thành đã chọn.", 400);
        }
      } else if (Array.isArray(expressWards) && expressWards.length) {
        throw new AppError("Cần chọn tỉnh/thành khi cấu hình phường, xã giao hỏa tốc.", 400);
      }
      const updates = Object.fromEntries(Object.keys(DEFAULT_STORE_SETTINGS)
        .filter((key) => values?.[key] !== undefined)
        .map((key) => [`value.${key}`, values?.[key]]));
      if (expressProvince !== undefined) updates["value.express_shipping_ward_codes"] = Array.isArray(expressWards) ? [...new Set(expressWards)] : [];
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
  static async getOrders(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit, skip } = readPagination(req.query);
      const search = literalSearch(req.query.search);
      const baseFilter: Record<string, unknown> = {};
      if (req.query.method !== undefined && req.query.method !== "") {
        if (!isStoredPaymentMethod(req.query.method)) throw new AppError("Phương thức thanh toán không hợp lệ.", 400);
        baseFilter.payment_method = req.query.method;
      }
      if (req.query.payment_status !== undefined) {
        const status = req.query.payment_status;
        if (status !== "pending" && status !== "success" && status !== "failed" && status !== "refunded") throw new AppError("Trạng thái thanh toán không hợp lệ.", 400);
        baseFilter.payment_status = status;
      }
      if (req.query.shipping !== undefined) {
        if (req.query.shipping !== "Standard" && req.query.shipping !== "Express") throw new AppError("Phương thức giao hàng không hợp lệ.", 400);
        baseFilter.shipping_method = req.query.shipping;
      }
      if (req.query.period !== undefined) {
        if (req.query.period !== "1" && req.query.period !== "7" && req.query.period !== "30") throw new AppError("Khoảng thời gian không hợp lệ.", 400);
        const now = new Date();
        const offset = 7 * 3600_000;
        const local = new Date(now.getTime() + offset);
        const start = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - Number(req.query.period) + 1) - offset;
        baseFilter.created_at = { $gte: new Date(start), $lte: now };
      }
      if (search) {
        const users = await User.find({ email: { $regex: search, $options: "i" } }).select("_id").lean();
        baseFilter.$or = [
          { receiver_name: { $regex: search, $options: "i" } },
          { receiver_phone: { $regex: search, $options: "i" } },
          { user_id: { $in: users.map((user) => user._id) } },
          { $expr: { $regexMatch: { input: { $toString: "$_id" }, regex: search, options: "i" } } },
        ];
      }
      const queue = orderQueueFilter(req.query.queue);
      if (Object.keys(queue).length) baseFilter.$and = [queue];
      const filter = { ...baseFilter };
      if (req.query.status !== undefined && req.query.status !== "") {
        if (typeof req.query.status !== "string" || !["pending", "processing", "shipping", "delivery_failed", "returning", "returned", "completed", "cancelled"].includes(req.query.status)) {
          throw new AppError("Trạng thái đơn hàng không hợp lệ.", 400);
        }
        filter.order_status = req.query.status;
      }
      const [orders, total, grouped] = await Promise.all([Order.find(filter)
        .populate("user_id", "name email phone")
        .sort(Object.keys(queue).length ? { created_at: 1, _id: 1 } : { created_at: -1, _id: -1 }).skip(skip).limit(limit).lean(),
        Order.countDocuments(filter),
        Order.aggregate<{ _id: string; count: number }>([
          { $match: baseFilter }, { $group: { _id: "$order_status", count: { $sum: 1 } } },
        ]),
      ]);
      const statusCounts: Record<string, number> = { all: grouped.reduce((sum, group) => sum + group.count, 0) };
      for (const group of grouped) statusCounts[group._id] = group.count;
      const orderIds = orders.map((order) => order._id);
      const details = await OrderDetail.find({ order_id: { $in: orderIds } })
        .select("order_id product_id product_variant_id product_name sku size color quantity price_at_buy")
        .lean();
      const detailsByOrder = new Map<string, typeof details>();
      for (const detail of details) {
        const orderId = detail.order_id.toString();
        detailsByOrder.set(orderId, [...(detailsByOrder.get(orderId) ?? []), detail]);
      }
      res.json({
        status: "success",
        pagination: { ...paginationMetadata(page, limit, total), statusCounts },
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
        ? await Coupon.findOneAndUpdate({ _id: couponId, used_count: { $not: { $gt: usageLimit } } }, values, { returnDocument: "after", runValidators: true })
        : await Coupon.create(values);
      if (!coupon && couponId && await Coupon.exists({ _id: couponId })) throw new AppError("Giới hạn sử dụng không được thấp hơn số lượt đã dùng.", 409);
      if (!coupon) throw new AppError("Không tìm thấy mã giảm giá.", 404);
      res.status(couponId ? 200 : 201).json({ status: "success", data: coupon });
    } catch (error) {
      next(error);
    }
  }

  static async deleteCoupon(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id;
      if (typeof id !== "string" || !mongoose.isObjectIdOrHexString(id)) throw new AppError("ID mã giảm giá không hợp lệ.", 400);
      if (await Order.exists({ coupon_id: id })) throw new AppError("Mã đã gắn với đơn hàng. Hãy tắt mã để giữ lịch sử sử dụng.", 409);
      const coupon = await Coupon.findOneAndDelete({ _id: id, used_count: { $not: { $gt: 0 } } });
      if (!coupon && await Coupon.exists({ _id: id })) throw new AppError("Mã đã có lượt sử dụng. Hãy tắt mã để giữ lịch sử.", 409);
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
      const product = await mongoose.connection.transaction(async session=>{
        await lockCategoryTree(session);
        const rows=await StorefrontProduct.create([await productInput(req.body,session)],{session});return rows[0]!;
      });
      await product.populate("category_id", "name slug");
      res.status(201).json({ status: "success", data: product });
    } catch (error) {
      next(error);
    }
  }

  static async updateProduct(req: Request, res: Response, next: NextFunction) {
    try {
      const product = await mongoose.connection.transaction(async session=>{
        await lockCategoryTree(session);
        return StorefrontProduct.findByIdAndUpdate(req.params.id,await productInput(req.body,session),{session,new:true,runValidators:true});
      });
      if(product)await product.populate("category_id","name slug");
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
