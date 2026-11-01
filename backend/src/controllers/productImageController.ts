import type { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import ProductImage from "../models/productImageModel.js";
import Product from "../models/productModel.js";
import { AppError } from "../middlewares/AppError.js";

const getValidId = (value: string | string[] | undefined, name: string) => {
  if (typeof value !== "string" || !mongoose.isValidObjectId(value)) {
    throw new AppError(`${name} không hợp lệ`, 400);
  }
  return new mongoose.Types.ObjectId(value);
};

export class ProductImageController {
  // 1. Lấy danh sách ảnh của sản phẩm
  static async getImages(req: Request, res: Response, next: NextFunction) {
    try {
      const productId = getValidId(req.params.productId, "ID sản phẩm");

      const product = await Product.findById(productId);
      if (!product) throw new AppError("Không tìm thấy sản phẩm", 404);

      const images = await ProductImage.find({
        product_id: productId,
      })
        .sort({ display_order: 1 })
        .lean();

      res.status(200).json({
        status: "success",
        results: images.length,
        data: images,
      });
    } catch (error) {
      next(error);
    }
  }

  // 2. Lấy chi tiết một ảnh
  static async getImage(req: Request, res: Response, next: NextFunction) {
    try {
      const productId = getValidId(req.params.productId, "ID sản phẩm");
      const imageId = getValidId(req.params.imageId, "ID ảnh");

      const image = await ProductImage.findOne({
        _id: imageId,
        product_id: productId,
      }).lean();

      if (!image) throw new AppError("Không tìm thấy ảnh", 404);

      res.status(200).json({
        status: "success",
        data: image,
      });
    } catch (error) {
      next(error);
    }
  }

  // 3. Thêm ảnh
  static async createImage(req: Request, res: Response, next: NextFunction) {
    try {
      const productId = getValidId(req.params.productId, "ID sản phẩm");
      const { image_url, display_order, is_primary = false } = req.body;

      const product = await Product.findById(productId);
      if (!product) throw new AppError("Không tìm thấy sản phẩm", 404);

      if (typeof image_url !== "string" || !image_url.trim()) {
        throw new AppError("Đường dẫn ảnh không hợp lệ", 400);
      }

      if (!Number.isInteger(display_order) || display_order < 1) {
        throw new AppError("Thứ tự hiển thị phải là số nguyên >= 1", 400);
      }

      if (typeof is_primary !== "boolean") {
        throw new AppError("is_primary phải là boolean", 400);
      }

      if (is_primary) {
        await ProductImage.updateMany(
          { product_id: productId },
          { $set: { is_primary: false } },
        );
      }

      const image = await ProductImage.create({
        product_id: productId,
        image_url,
        display_order,
        is_primary,
      });

      res.status(201).json({
        status: "success",
        data: image,
      });
    } catch (error) {
      next(error);
    }
  }

  // 4. Cập nhật ảnh
  static async updateImage(req: Request, res: Response, next: NextFunction) {
    try {
      const productId = getValidId(req.params.productId, "ID sản phẩm");
      const imageId = getValidId(req.params.imageId, "ID ảnh");

      const image = await ProductImage.findOne({
        _id: imageId,
        product_id: productId,
      });

      if (!image) throw new AppError("Không tìm thấy ảnh", 404);

      const { image_url, display_order, is_primary } = req.body;

      if (image_url !== undefined) {
        if (typeof image_url !== "string" || !image_url.trim()) {
          throw new AppError("Đường dẫn ảnh không hợp lệ", 400);
        }
        image.image_url = image_url.trim();
      }

      if (display_order !== undefined) {
        if (!Number.isInteger(display_order) || display_order < 1) {
          throw new AppError("Thứ tự hiển thị phải là số nguyên >= 1", 400);
        }
        image.display_order = display_order;
      }

      if (is_primary !== undefined) {
        if (typeof is_primary !== "boolean") {
          throw new AppError("is_primary phải là boolean", 400);
        }

        if (is_primary) {
          await ProductImage.updateMany(
            { product_id: productId, _id: { $ne: imageId } },
            { $set: { is_primary: false } },
          );
        }

        image.is_primary = is_primary;
      }

      await image.save();

      res.status(200).json({
        status: "success",
        data: image,
      });
    } catch (error) {
      next(error);
    }
  }

  // 5. Xóa ảnh
  static async deleteImage(req: Request, res: Response, next: NextFunction) {
    try {
      const productId = getValidId(req.params.productId, "ID sản phẩm");
      const imageId = getValidId(req.params.imageId, "ID ảnh");

      const image = await ProductImage.findOneAndDelete({
        _id: imageId,
        product_id: productId,
      });

      if (!image) throw new AppError("Không tìm thấy ảnh", 404);

      res.status(200).json({
        status: "success",
        message: "Xóa ảnh thành công",
      });
    } catch (error) {
      next(error);
    }
  }
}
