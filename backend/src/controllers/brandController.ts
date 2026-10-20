import type { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import Brand from "../models/brandModel.js";
import Product from "../models/productModel.js";
import { AppError } from "../middlewares/AppError.js";

export class BrandController {
  // GET /api/brands
  static async getBrands(req: Request, res: Response, next: NextFunction) {
    try {
      const filter: { status?: boolean } = {};

      if (req.query.all !== "true") {
        filter.status = true;
      }

      const brands = await Brand.find(filter).sort({ name: 1 }).lean();

      res.status(200).json({
        status: "success",
        results: brands.length,
        data: brands,
      });
    } catch (error) {
      next(error);
    }
  }

  // GET /api/brands/:id
  static async getBrand(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      if (!mongoose.isValidObjectId(id)) {
        throw new AppError("ID thương hiệu không hợp lệ.", 400);
      }

      const brand = await Brand.findById(id).lean();

      if (!brand) {
        throw new AppError("Không tìm thấy thương hiệu.", 404);
      }

      res.status(200).json({
        status: "success",
        data: brand,
      });
    } catch (error) {
      next(error);
    }
  }

  // POST /api/brands
  static async createBrand(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, slug, logo, status } = req.body;

      if (
        typeof name !== "string" ||
        !name.trim() ||
        typeof slug !== "string" ||
        !slug.trim()
      ) {
        throw new AppError("Vui lòng nhập tên và slug thương hiệu.", 400);
      }

      const normalizedSlug = slug.trim().toLowerCase();

      const existingBrand = await Brand.findOne({
        slug: normalizedSlug,
      });

      if (existingBrand) {
        throw new AppError("Slug thương hiệu đã tồn tại.", 409);
      }

      const brand = await Brand.create({
        name: name.trim(),
        slug: normalizedSlug,
        logo: typeof logo === "string" ? logo.trim() : "",
        status: typeof status === "boolean" ? status : true,
      });

      res.status(201).json({
        status: "success",
        message: "Tạo thương hiệu thành công.",
        data: brand,
      });
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code: number }).code === 11000
      ) {
        return next(new AppError("Slug thương hiệu đã tồn tại.", 409));
      }

      next(error);
    }
  }

  // PATCH /api/brands/:id
  static async updateBrand(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      if (!mongoose.isValidObjectId(id)) {
        throw new AppError("ID thương hiệu không hợp lệ.", 400);
      }

      const brand = await Brand.findById(id);

      if (!brand) {
        throw new AppError("Không tìm thấy thương hiệu.", 404);
      }

      const { name, slug, logo, status } = req.body;

      if (name !== undefined) {
        if (typeof name !== "string" || !name.trim()) {
          throw new AppError("Tên thương hiệu không hợp lệ.", 400);
        }
        brand.name = name.trim();
      }

      if (slug !== undefined) {
        if (typeof slug !== "string" || !slug.trim()) {
          throw new AppError("Slug thương hiệu không hợp lệ.", 400);
        }

        const normalizedSlug = slug.trim().toLowerCase();
        const existingBrand = await Brand.findOne({
          slug: normalizedSlug,
          _id: { $ne: brand._id },
        });

        if (existingBrand) {
          throw new AppError("Slug thương hiệu đã tồn tại.", 409);
        }

        brand.slug = normalizedSlug;
      }

      if (logo !== undefined) {
        if (typeof logo !== "string") {
          throw new AppError("Logo không hợp lệ.", 400);
        }
        brand.logo = logo.trim();
      }

      if (status !== undefined) {
        if (typeof status !== "boolean") {
          throw new AppError("Trạng thái không hợp lệ.", 400);
        }
        brand.status = status;
      }

      await brand.save();

      res.status(200).json({
        status: "success",
        message: "Cập nhật thương hiệu thành công.",
        data: brand,
      });
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code: number }).code === 11000
      ) {
        return next(new AppError("Slug thương hiệu đã tồn tại.", 409));
      }

      next(error);
    }
  }

  // DELETE /api/brands/:id
  static async deleteBrand(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      if (!mongoose.isValidObjectId(id)) {
        throw new AppError("ID thương hiệu không hợp lệ.", 400);
      }

      const brand = await Brand.findById(id);

      if (!brand) {
        throw new AppError("Không tìm thấy thương hiệu.", 404);
      }

      const productExists = await Product.exists({
        brand_id: brand._id,
      });

      if (productExists) {
        throw new AppError(
          "Không thể xóa thương hiệu đang được sản phẩm sử dụng.",
          409,
        );
      }

      await Brand.findByIdAndDelete(id);

      res.status(200).json({
        status: "success",
        message: "Xóa thương hiệu thành công.",
      });
    } catch (error) {
      next(error);
    }
  }
}
