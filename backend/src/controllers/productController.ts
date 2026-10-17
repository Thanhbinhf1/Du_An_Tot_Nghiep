import type { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";

import Product from "../models/productModel.js";
import ProductImage from "../models/productImageModel.js";
import ProductVariant from "../models/productVariantModel.js";

// GET /api/products - Lấy danh sách sản phẩm
export const getProducts = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));

    const filter: Record<string, unknown> = { status: true };

    if (req.query.category_id) {
      if (!mongoose.isValidObjectId(req.query.category_id)) {
        return res.status(400).json({
          message: "category_id không hợp lệ",
        });
      }
      filter.category_id = req.query.category_id;
    }

    if (req.query.brand_id) {
      if (!mongoose.isValidObjectId(req.query.brand_id)) {
        return res.status(400).json({
          message: "brand_id không hợp lệ",
        });
      }
      filter.brand_id = req.query.brand_id;
    }

    if (req.query.is_featured === "true") {
      filter.is_featured = true;
    }

    if (typeof req.query.keyword === "string" && req.query.keyword.trim()) {
      filter.name = {
        $regex: req.query.keyword.trim(),
        $options: "i",
      };
    }

    const [products, total] = await Promise.all([
      Product.find(filter)
        .populate("category_id", "name slug")
        .populate("brand_id", "name slug")
        .sort({ created_at: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Product.countDocuments(filter),
    ]);

    return res.status(200).json({
      message: "Lấy danh sách sản phẩm thành công",
      data: products,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/products/:id - Chi tiết sản phẩm
export const getProductById = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = req.params.id;

    if (typeof id !== "string" || !mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        message: "ID sản phẩm không hợp lệ",
      });
    }

    const product = await Product.findOne({
      _id: new mongoose.Types.ObjectId(id),
      status: true,
    })
      .populate("category_id", "name slug")
      .populate("brand_id", "name slug")
      .lean();

    if (!product) {
      return res.status(404).json({ message: "Không tìm thấy sản phẩm" });
    }

    const [images, variants] = await Promise.all([
      ProductImage.find({ product_id: product._id })
        .sort({ display_order: 1 })
        .lean(),
      ProductVariant.find({
        product_id: product._id,
        status: true,
      }).lean(),
    ]);

    return res.status(200).json({
      message: "Lấy chi tiết sản phẩm thành công",
      data: {
        ...product,
        images,
        variants,
      },
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/products - Thêm sản phẩm
export const createProduct = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const {
      category_id,
      brand_id,
      name,
      slug,
      description,
      is_featured,
      status,
    } = req.body;

    if (!category_id || !brand_id || !name?.trim() || !slug?.trim()) {
      return res.status(400).json({
        message: "Vui lòng nhập category_id, brand_id, name và slug",
      });
    }

    if (
      !mongoose.isValidObjectId(category_id) ||
      !mongoose.isValidObjectId(brand_id)
    ) {
      return res.status(400).json({
        message: "category_id hoặc brand_id không hợp lệ",
      });
    }

    const normalizedSlug = slug.trim().toLowerCase();

    const existingProduct = await Product.findOne({
      slug: normalizedSlug,
    });

    if (existingProduct) {
      return res.status(409).json({ message: "Slug sản phẩm đã tồn tại" });
    }

    const product = await Product.create({
      category_id,
      brand_id,
      name: name.trim(),
      slug: normalizedSlug,
      description,
      is_featured,
      status,
    });

    return res.status(201).json({
      message: "Thêm sản phẩm thành công",
      data: product,
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/products/:id - Cập nhật sản phẩm
export const updateProduct = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = req.params.id;

    if (typeof id !== "string" || !mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        message: "ID sản phẩm không hợp lệ",
      });
    }
    const allowedFields = [
      "category_id",
      "brand_id",
      "name",
      "slug",
      "description",
      "is_featured",
      "status",
    ];

    const updates: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (typeof updates.name === "string") {
      updates.name = updates.name.trim();
      if (!updates.name) {
        return res
          .status(400)
          .json({ message: "Tên sản phẩm không được trống" });
      }
    }

    if (typeof updates.slug === "string") {
      updates.slug = updates.slug.trim().toLowerCase();
      if (!updates.slug) {
        return res.status(400).json({ message: "Slug không được trống" });
      }
    }

    for (const field of ["category_id", "brand_id"] as const) {
      if (
        updates[field] !== undefined &&
        (typeof updates[field] !== "string" ||
          !mongoose.isValidObjectId(updates[field] as string))
      ) {
        return res.status(400).json({
          message: `${field} không hợp lệ`,
        });
      }
    }

    const product = await Product.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });

    if (!product) {
      return res.status(404).json({ message: "Không tìm thấy sản phẩm" });
    }

    return res.status(200).json({
      message: "Cập nhật sản phẩm thành công",
      data: product,
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/products/:id - Xóa sản phẩm
export const deleteProduct = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = req.params.id;

    if (typeof id !== "string" || !mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        message: "ID sản phẩm không hợp lệ",
      });
    }

    const product = await Product.findByIdAndDelete(id);

    if (!product) {
      return res.status(404).json({ message: "Không tìm thấy sản phẩm" });
    }

    await Promise.all([
      ProductImage.deleteMany({ product_id: product._id }),
      ProductVariant.deleteMany({ product_id: product._id }),
    ]);

    return res.status(200).json({
      message: "Xóa sản phẩm và dữ liệu ảnh, biến thể thành công",
    });
  } catch (error) {
    next(error);
  }
};
