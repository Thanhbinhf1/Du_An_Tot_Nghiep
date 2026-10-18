import type { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import Category from "../models/categoryModel.js";
import StorefrontProduct from "../models/storefrontProductModel.js";
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
