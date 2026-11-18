import type { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";

import Product from "../models/productModel.js";
import Category from "../models/categoryModel.js";
import Brand from "../models/brandModel.js";
import ProductImage from "../models/productImageModel.js";
import ProductVariant from "../models/productVariantModel.js";
import ProductComment from "../models/productCommentModel.js";
import { productGenders, productAudiences } from "../services/catalogAudience.js";

// GET /api/products/admin - Dữ liệu quản trị, gồm cả sản phẩm đã tắt.
export const getAdminProducts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, Math.floor(Number(req.query.page) || 1));
    const limit = Math.min(100, Math.max(1, Math.floor(Number(req.query.limit) || 25)));
    if (!Number.isSafeInteger(page) || !Number.isSafeInteger(limit)) {
      return res.status(400).json({ message: "Phân trang không hợp lệ" });
    }
    const [products, total] = await Promise.all([
      Product.find({}).sort({ created_at: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Product.countDocuments({}),
    ]);
    return res.status(200).json({ data: products, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) { next(error); }
};

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
        .sort(req.query.view === "storefront"
          ? { is_featured: -1, created_at: -1, _id: -1 }
          : { created_at: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Product.countDocuments(filter),
    ]);

    if (req.query.view === "storefront") {
      const ids = products.map((product) => product._id);
      const [images, variants, ratings] = await Promise.all([
        ProductImage.find({ product_id: { $in: ids } })
          .sort({ is_primary: -1, display_order: 1, _id: 1 })
          .lean(),
        ProductVariant.find({ product_id: { $in: ids }, status: true })
          .sort({ _id: 1 })
          .lean(),
        ProductComment.aggregate<{ _id: string; average: number }>([
          { $match: { product_key: { $in: ids.map(String) } } },
          { $group: { _id: "$product_key", average: { $avg: "$rating" } } },
        ]),
      ]);
      const averageByProduct = new Map(ratings.map((rating) => [rating._id, rating.average]));
      const primaryImages = new Map<string, (typeof images)[number]>();
      for (const image of images) {
        const id = String(image.product_id);
        if (!primaryImages.has(id)) primaryImages.set(id, image);
      }
      const variantsByProduct = new Map<string, typeof variants>();
      for (const variant of variants) {
        const id = String(variant.product_id);
        const group = variantsByProduct.get(id) ?? [];
        group.push(variant);
        variantsByProduct.set(id, group);
      }
      return res.json({
        data: products.map((product) => {
          const id = String(product._id);
          const image = primaryImages.get(id);
          return {
            ...product,
            audiences: productAudiences(product.gender),
            images: image ? [image] : [],
            variants: variantsByProduct.get(id) ?? [],
            average_rating: averageByProduct.get(id) ?? 0,
          };
        }),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    }

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

    const [images, variants, ratings] = await Promise.all([
      ProductImage.find({ product_id: product._id })
        .sort({ display_order: 1 })
        .lean(),
      ProductVariant.find({
        product_id: product._id,
        status: true,
      }).sort({ _id: 1 }).lean(),
      ProductComment.aggregate<{ average: number; total: number }>([
        { $match: { product_key: String(product._id) } },
        { $group: { _id: null, average: { $avg: "$rating" }, total: { $sum: 1 } } },
      ]),
    ]);

    return res.status(200).json({
      message: "Lấy chi tiết sản phẩm thành công",
      data: {
        ...product,
        images,
        variants,
        average_rating: ratings[0]?.average ?? 0,
        review_count: ratings[0]?.total ?? 0,
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
      gender,
      is_featured,
      status,
    } = req.body ?? {};
    if (gender !== undefined && !productGenders.some((value) => value === gender)) {
      return res.status(400).json({ message: "Nhóm khách hàng không hợp lệ." });
    }

    if (!category_id || !brand_id || typeof name !== "string" || !name.trim() || typeof slug !== "string" || !slug.trim()) {
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

    const [category, brand] = await Promise.all([Category.exists({ _id: category_id }), Brand.exists({ _id: brand_id })]);
    if (!category || !brand) {
      return res.status(404).json({ message: "Danh mục hoặc thương hiệu không tồn tại" });
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
      gender,
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
      "gender",
      "is_featured",
      "status",
    ];

    const updates: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }
    if (updates.gender !== undefined && !productGenders.some((value) => value === updates.gender)) {
      return res.status(400).json({ message: "Nhóm khách hàng không hợp lệ." });
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

    const [category, brand] = await Promise.all([
      updates.category_id === undefined || Category.exists({ _id: updates.category_id }),
      updates.brand_id === undefined || Brand.exists({ _id: updates.brand_id }),
    ]);
    if (!category || !brand) {
      return res.status(404).json({ message: "Danh mục hoặc thương hiệu không tồn tại" });
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
