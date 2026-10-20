import type { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import Category from "../models/categoryModel.js";
import Product from "../models/productModel.js";
import StorefrontProduct from "../models/storefrontProductModel.js";
import { AppError } from "../middlewares/AppError.js";

export class CategoryController {
  // GET /api/categories
  static async getCategories(req: Request, res: Response, next: NextFunction) {
    try {
      const filter: Record<string, unknown> = {};

      // Mặc định chỉ lấy danh mục đang hoạt động.
      // Thêm ?all=true để lấy cả danh mục đã ẩn.
      if (req.query.all !== "true") {
        filter.status = true;
      }

      const categories = await Category.find(filter)
        .populate("parent_id", "name slug")
        .sort({ name: 1 });

      res.json({
        status: "success",
        results: categories.length,
        data: categories,
      });
    } catch (error) {
      next(error);
    }
  }

  // GET /api/categories/:id
  static async getCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      if (!mongoose.isValidObjectId(id)) {
        throw new AppError("ID danh mục không hợp lệ.", 400);
      }

      const category = await Category.findById(id).populate(
        "parent_id",
        "name slug",
      );

      if (!category) {
        throw new AppError("Không tìm thấy danh mục.", 404);
      }

      res.json({
        status: "success",
        data: category,
      });
    } catch (error) {
      next(error);
    }
  }

  // POST /api/categories
  static async createCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const { parent_id, name, slug, image, description, status } = req.body;

      if (
        typeof name !== "string" ||
        !name.trim() ||
        typeof slug !== "string" ||
        !slug.trim()
      ) {
        throw new AppError("Tên danh mục và slug là bắt buộc.", 400);
      }

      let parentId: mongoose.Types.ObjectId | null = null;

      if (parent_id !== undefined && parent_id !== null && parent_id !== "") {
        if (!mongoose.isValidObjectId(parent_id)) {
          throw new AppError("ID danh mục cha không hợp lệ.", 400);
        }

        const parent = await Category.findById(parent_id);

        if (!parent) {
          throw new AppError("Danh mục cha không tồn tại.", 404);
        }

        parentId = parent._id;
      }

      const normalizedSlug = slug.trim().toLowerCase();

      const existingCategory = await Category.findOne({
        slug: normalizedSlug,
      });

      if (existingCategory) {
        throw new AppError("Slug danh mục đã tồn tại.", 409);
      }

      const category = await Category.create({
        parent_id: parentId,
        name: name.trim(),
        slug: normalizedSlug,
        image: typeof image === "string" ? image.trim() : "",
        description: typeof description === "string" ? description.trim() : "",
        status: typeof status === "boolean" ? status : true,
      });

      res.status(201).json({
        status: "success",
        message: "Tạo danh mục thành công.",
        data: category,
      });
    } catch (error) {
      if (error instanceof mongoose.Error && error.name === "ValidationError") {
        return next(new AppError("Dữ liệu danh mục không hợp lệ.", 400));
      }

      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === 11000
      ) {
        return next(new AppError("Slug danh mục đã tồn tại.", 409));
      }

      next(error);
    }
  }

  // PATCH /api/categories/:id
  static async updateCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      if (!mongoose.isValidObjectId(id)) {
        throw new AppError("ID danh mục không hợp lệ.", 400);
      }

      const category = await Category.findById(id);

      if (!category) {
        throw new AppError("Không tìm thấy danh mục.", 404);
      }

      const { parent_id, name, slug, image, description, status } = req.body;

      if (name !== undefined) {
        if (typeof name !== "string" || !name.trim()) {
          throw new AppError("Tên danh mục không được để trống.", 400);
        }

        category.name = name.trim();
      }

      if (slug !== undefined) {
        if (typeof slug !== "string" || !slug.trim()) {
          throw new AppError("Slug không được để trống.", 400);
        }

        const normalizedSlug = slug.trim().toLowerCase();
        const existingCategory = await Category.findOne({
          slug: normalizedSlug,
          _id: { $ne: category._id },
        });

        if (existingCategory) {
          throw new AppError("Slug danh mục đã tồn tại.", 409);
        }

        category.slug = normalizedSlug;
      }

      if (parent_id !== undefined) {
        if (parent_id === null || parent_id === "") {
          category.parent_id = null;
        } else {
          if (!mongoose.isValidObjectId(parent_id)) {
            throw new AppError("ID danh mục cha không hợp lệ.", 400);
          }

          if (parent_id.toString() === category._id.toString()) {
            throw new AppError(
              "Danh mục không thể là danh mục cha của chính nó.",
              400,
            );
          }

          const parent = await Category.findById(parent_id);

          if (!parent) {
            throw new AppError("Danh mục cha không tồn tại.", 404);
          }

          // Ngăn tạo vòng lặp trong cây danh mục.
          let currentParent = parent;

          while (currentParent.parent_id) {
            if (
              currentParent.parent_id.toString() === category._id.toString()
            ) {
              throw new AppError(
                "Không thể chọn danh mục con làm danh mục cha.",
                400,
              );
            }

            const nextParent = await Category.findById(currentParent.parent_id);

            if (!nextParent) break;

            currentParent = nextParent;
          }

          category.parent_id = parent._id;
        }
      }

      if (image !== undefined) {
        if (typeof image !== "string") {
          throw new AppError("Image phải là chuỗi.", 400);
        }

        category.image = image.trim();
      }

      if (description !== undefined) {
        if (typeof description !== "string") {
          throw new AppError("Description phải là chuỗi.", 400);
        }

        category.description = description.trim();
      }

      if (status !== undefined) {
        if (typeof status !== "boolean") {
          throw new AppError("Status phải là true hoặc false.", 400);
        }

        category.status = status;
      }

      await category.save();

      res.json({
        status: "success",
        message: "Cập nhật danh mục thành công.",
        data: category,
      });
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === 11000
      ) {
        return next(new AppError("Slug danh mục đã tồn tại.", 409));
      }

      next(error);
    }
  }

  // DELETE /api/categories/:id
  static async deleteCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      if (!mongoose.isValidObjectId(id)) {
        throw new AppError("ID danh mục không hợp lệ.", 400);
      }

      const category = await Category.findById(id);

      if (!category) {
        throw new AppError("Không tìm thấy danh mục.", 404);
      }

      const [hasChild, hasProduct, hasStorefrontProduct] = await Promise.all([
        Category.exists({ parent_id: category._id }),
        Product.exists({ category_id: category._id }),
        StorefrontProduct.exists({ category_id: category._id }),
      ]);

      if (hasChild) {
        throw new AppError("Không thể xóa danh mục đang có danh mục con.", 409);
      }

      if (hasProduct || hasStorefrontProduct) {
        throw new AppError(
          "Không thể xóa danh mục đang được sử dụng bởi sản phẩm.",
          409,
        );
      }

      await Category.findByIdAndDelete(category._id);

      res.json({
        status: "success",
        message: "Xóa danh mục thành công.",
      });
    } catch (error) {
      next(error);
    }
  }
}
