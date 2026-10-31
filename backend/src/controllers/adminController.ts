import type { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import Category from "../models/categoryModel.js";
import StorefrontProduct from "../models/storefrontProductModel.js";
import Order from "../models/orderModel.js";
import OrderDetail from "../models/orderDetailModel.js";
import Coupon from "../models/couponModel.js";
import { AppError } from "../middlewares/AppError.js";

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

export class AdminController {
  static async getOrders(_req: Request, res: Response, next: NextFunction) {
    try {
      const orders = await Order.find()
        .populate("user_id", "name email")
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

  static async updateOrderStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const validStatuses = ["pending", "processing", "shipping", "completed", "cancelled"];
      const status = req.body?.status;
      if (typeof status !== "string" || !validStatuses.includes(status)) {
        throw new AppError("Trạng thái đơn hàng không hợp lệ.", 400);
      }
      const order = await Order.findByIdAndUpdate(
        req.params.id,
        { order_status: status },
        { new: true, runValidators: true },
      );
      if (!order) throw new AppError("Không tìm thấy đơn hàng.", 404);
      res.json({ status: "success", data: order });
    } catch (error) {
      next(error);
    }
  }

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
      const productCount = await StorefrontProduct.countDocuments({ category_id: category._id });
      if (productCount) {
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
