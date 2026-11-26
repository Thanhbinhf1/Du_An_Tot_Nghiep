import { legacyBundle, saveLegacyBundle } from "../services/catalogLegacyAdapter.js";
import { AppError } from "../middlewares/AppError.js";
import type { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";

import Product from "../models/productModel.js";


import ProductImage from "../models/productImageModel.js";
import ProductVariant from "../models/productVariantModel.js";
import ProductComment from "../models/productCommentModel.js";
import { productAudiences } from "../services/catalogAudience.js";
import { literalSearch, readPagination } from "../services/listQuery.js";

// GET /api/products/admin - Dữ liệu quản trị, gồm cả sản phẩm đã tắt.
export const getAdminProducts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit } = readPagination(req.query);
    const search = literalSearch(req.query.search);
    const scope: Record<string, unknown> = search ? { $or: [{ name: { $regex: search, $options: "i" } }, { product_code: { $regex: search, $options: "i" } }] } : {};
    if (typeof req.query.category_id === "string" && mongoose.isObjectIdOrHexString(req.query.category_id)) scope.category_id = req.query.category_id;
    if (typeof req.query.brand_id === "string" && mongoose.isObjectIdOrHexString(req.query.brand_id)) scope.brand_id = req.query.brand_id;
    const states = { all: {}, published: { status: true }, draft: { publication_state: "draft" }, hidden: { status: false, publication_state: { $ne: "draft" } } } as const;
    const state = typeof req.query.state === "string" && Object.hasOwn(states, req.query.state) ? req.query.state as keyof typeof states : "all";
    const filter = { ...scope, ...states[state] };
    const sort = req.query.sort === "name" ? { name: 1 as const, _id: 1 as const } : { created_at: -1 as const, _id: -1 as const };
    const [products, statusCounts] = await Promise.all([
      Product.find(filter).sort(sort).skip((page - 1) * limit).limit(limit).lean(),
      Promise.all(Object.entries(states).map(async ([key, criteria]) =>
        [key, await Product.countDocuments({ ...scope, ...criteria })] as const)).then(Object.fromEntries),
    ]);
    const total = statusCounts[state];
    const ids = products.map((product) => product._id);
    const [images, variants] = await Promise.all([
      ProductImage.find({ product_id: { $in: ids } }).sort({ is_primary: -1, display_order: 1 }).select("product_id image_url color").lean(),
      ProductVariant.find({ product_id: { $in: ids } }).select("product_id price sale_price stock_quantity color size status").lean(),
    ]);
    return res.status(200).json({ data: products.map((product) => {
      const rows = variants.filter((variant) => String(variant.product_id) === String(product._id));
      const prices = rows.filter((row) => row.status).map((row) => row.sale_price ?? row.price);
      return { ...product, image: images.find((image) => String(image.product_id) === String(product._id))?.image_url,
        variant_count: rows.length, stock: rows.reduce((sum, row) => sum + row.stock_quantity, 0),
        available_stock: rows.reduce((sum, row) => sum + (row.status ? row.stock_quantity : 0), 0),
        colors: [...new Set(rows.map((row) => row.color))], sizes: [...new Set(rows.map((row) => row.size))],
        min_price: prices.length ? Math.min(...prices) : null,
        max_price: prices.length ? Math.max(...prices) : null };
    }), pagination: { page, limit, total, totalPages: Math.ceil(total / limit), statusCounts } });
  } catch (error) { next(error); }
};

// GET /api/products - Lấy danh sách sản phẩm
export const getProducts = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { page, limit } = readPagination(req.query, 10);

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

    const keyword = literalSearch(req.query.keyword);
    if (keyword) {
      filter.name = {
        $regex: keyword,
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
      const imagesByColor = new Map<string, Map<string, (typeof images)[number]>>();
      for (const image of images) {
        const id = String(image.product_id);
        const group = imagesByColor.get(id) ?? new Map<string, (typeof images)[number]>();
        const color = image.color?.trim().toLocaleLowerCase("vi") ?? "";
        if (!group.has(color)) group.set(color, image);
        imagesByColor.set(id, group);
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
          return {
            ...product,
            audiences: productAudiences(product.gender),
            images: [...(imagesByColor.get(id)?.values() ?? [])],
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
        audiences: productAudiences(product.gender),
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
export const createProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.body?.status === true) throw new AppError("Sản phẩm mới lưu nháp trước. Xuất bản tại workspace sau khi đủ dữ liệu.", 400);
    const state = await saveLegacyBundle(req, undefined, { product: req.body, variants: [], images: [], action: "draft" });
    res.status(201).json({ data: state.product });
  } catch (error) { next(error); }
};
export const updateProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
    if (typeof id !== "string" || !mongoose.isObjectIdOrHexString(id)) throw new AppError("ID sản phẩm không hợp lệ", 400);
    const bundle = await legacyBundle(id);
    if (!Number.isSafeInteger(req.body?.expected_version)) throw new AppError("Cần expected_version từ sản phẩm đã đọc.", 400);
    bundle.expected_version = req.body.expected_version;
    bundle.product = { ...bundle.product, ...req.body };
    bundle.action = req.body.status === true ? "publish" : req.body.status === false ? "hide" : "save";
    const state = await saveLegacyBundle(req, id, bundle);
    res.json({ data: state.product });
  } catch (error) { next(error); }
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

    const product = await mongoose.connection.transaction(async (session) => {
      const product = await Product.findByIdAndUpdate(id, { $set: { status: false, publication_state: "hidden" }, $inc: { __v: 1 } }, {
        session, returnDocument: "after", runValidators: true,
      });
      if (!product) return null;
      await ProductVariant.updateMany(
        { product_id: product._id },
        { $set: { status: false }, $inc: { __v: 1 } },
        { session, runValidators: true },
      );
      return product;
    });
    if (!product) {
      return res.status(404).json({ message: "Không tìm thấy sản phẩm" });
    }

    return res.status(200).json({
      message: "Đã ẩn sản phẩm và ngừng bán biến thể. Dữ liệu đơn hàng và ảnh được giữ lại.",
    });
  } catch (error) {
    next(error);
  }
};
