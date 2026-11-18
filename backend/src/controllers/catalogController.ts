import type { Request, Response, NextFunction } from "express";
import Category from "../models/categoryModel.js";
import StorefrontProduct from "../models/storefrontProductModel.js";
import { AppError } from "../middlewares/AppError.js";
import Outfit from "../models/outfitModel.js";
import OutfitDetail from "../models/outfitDetailModel.js";
import SizeRecommendation from "../models/sizeRecommendationModel.js";
import mongoose from "mongoose";
import { getStoreInfo } from "../config/storeInfo.js";
import Product from "../models/productModel.js";
import ProductImage from "../models/productImageModel.js";
import Variant from "../models/productVariantModel.js";
import { productAudiences } from "../services/catalogAudience.js";
import { estimateAdultSize } from "../services/sizeGuide.js";

export class CatalogController {
  static async storeInfo(_req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ status: "success", data: await getStoreInfo() });
    } catch (error) {
      next(error);
    }
  }

  static async getOutfits(_req: Request, res: Response, next: NextFunction) {
    try {
      const outfits = await Outfit.find({ is_active: true }).select("title description image").sort({ created_at: -1 }).lean();
      const details = await OutfitDetail.find({ outfit_id: { $in: outfits.map((outfit) => outfit._id) } })
        .select("outfit_id product_id").sort({ display_order: 1 }).lean();
      const productIds = new Map<string, string[]>();
      for (const detail of details) {
        const id = String(detail.outfit_id);
        const products = productIds.get(id) ?? [];
        products.push(String(detail.product_id));
        productIds.set(id, products);
      }
      res.json({ status: "success", data: outfits.map((outfit) => ({
        ...outfit, product_ids: productIds.get(String(outfit._id)) ?? [],
      })) });
    } catch (error) {
      next(error);
    }
  }

  static async recommendSize(req: Request, res: Response, next: NextFunction) {
    try {
      const { categoryId, productId, height, weight, fit } = req.query;
      const heightCm = typeof height === "string" ? Number(height) : NaN;
      const weightKg = typeof weight === "string" ? Number(weight) : NaN;
      if (typeof categoryId !== "string" || !mongoose.isObjectIdOrHexString(categoryId)
        || !Number.isFinite(heightCm) || heightCm < 45 || heightCm > 250
        || !Number.isFinite(weightKg) || weightKg < 3 || weightKg > 300
        || (fit !== "Slim" && fit !== "Regular" && fit !== "Oversize")) {
        throw new AppError("Vui lòng chọn danh mục, phom dáng và nhập số đo hợp lệ.", 400);
      }
      const category = await Category.findOne({ _id: categoryId, status: true }).select("slug parent_id").lean();
      if (!category) {
        throw new AppError("Danh mục không còn hiển thị.", 404);
      }
      if (productId !== undefined && (typeof productId !== "string" || !mongoose.isObjectIdOrHexString(productId))) {
        throw new AppError("ID sản phẩm không hợp lệ.", 400);
      }
      const products = await Product.find({
        category_id: categoryId, status: true, ...(productId ? { _id: productId } : {}),
      }).select("gender").lean();
      if (productId && !products.length) throw new AppError("Sản phẩm không thuộc danh mục hoặc đã ngừng bán.", 404);
      const [available, matches] = await Promise.all([
        Variant.distinct("size", { product_id: { $in: products.map((item) => item._id) }, status: true, stock_quantity: { $gt: 0 } }),
        SizeRecommendation.find({
        category_id: categoryId, fit_type: fit,
        min_height: { $lte: heightCm }, max_height: { $gte: heightCm },
        min_weight: { $lte: weightKg }, max_weight: { $gte: weightKg },
        }).select("size").lean(),
      ]);
      const availableSizes = [...new Set(available.map((size) => size.trim().toUpperCase()))];
      const matchesInStock = [...new Set(matches.map((item) => item.size.trim().toUpperCase()))]
        .filter((size) => availableSizes.includes(size));
      const adultOnly = products.length > 0 && products.every((item) =>
        productAudiences(item.gender).some((audience) => audience === "nam" || audience === "nu"),
      );
      const estimate = adultOnly && !matches.length ? estimateAdultSize(heightCm, weightKg, fit) : undefined;
      const sizes = matchesInStock.length ? matchesInStock : estimate && availableSizes.includes(estimate) ? [estimate] : [];
      res.json({
        status: "success", data: sizes,
        recommendation: { source: matchesInStock.length ? "rules" : sizes.length ? "estimate" : "unavailable", availableSizes },
      });
    } catch (error) {
      next(error);
    }
  }

  static async getCategories(_req: Request, res: Response, next: NextFunction) {
    try {
      const [categories, groups, thumbnails] = await Promise.all([
        Category.find({ status: true }).sort({ name: 1 }).lean(),
        Product.aggregate<{ _id: { category: mongoose.Types.ObjectId; gender: string } }>([
          { $match: { status: true, category_id: { $ne: null } } },
          { $group: { _id: { category: "$category_id", gender: "$gender" } } },
        ]),
        Product.aggregate<{ _id: mongoose.Types.ObjectId; image?: string }>([
          { $match: { status: true, category_id: { $ne: null } } },
          { $sort: { is_featured: -1, created_at: -1, _id: 1 } },
          { $group: { _id: "$category_id", product: { $first: "$_id" } } },
          { $lookup: {
            from: ProductImage.collection.name, localField: "product", foreignField: "product_id",
            pipeline: [
              { $sort: { is_primary: -1, display_order: 1, _id: 1 } },
              { $limit: 1 },
              { $project: { image_url: 1 } },
            ],
            as: "photos",
          } },
          { $project: { image: { $first: "$photos.image_url" } } },
        ]),
      ]);
      const audiencesByCategory = new Map<string, Set<string>>();
      for (const { _id } of groups) {
        const key = String(_id.category);
        const audiences = audiencesByCategory.get(key) ?? new Set<string>();
        productAudiences(_id.gender).forEach((audience) => audiences.add(audience));
        audiencesByCategory.set(key, audiences);
      }
      const images = new Map(thumbnails.map(({ _id, image }) => [String(_id), image]));
      res.json({ status: "success", data: categories.map((category) => ({
        ...category, audiences: [...(audiencesByCategory.get(String(category._id)) ?? [])],
        thumbnail: images.get(String(category._id)),
      })) });
    } catch (error) {
      next(error);
    }
  }

  static async getProducts(req: Request, res: Response, next: NextFunction) {
    try {
      const filter: Record<string, unknown> = {};
      const categoryId = req.query.categoryId;
      if (typeof categoryId === "string" && categoryId) {
        filter.category_id = categoryId;
      }

      const products = await StorefrontProduct.find(filter)
        .populate("category_id", "name slug")
        .sort({ createdAt: -1 });
      res.json({ status: "success", data: products });
    } catch (error) {
      next(error);
    }
  }

  static async getProduct(req: Request, res: Response, next: NextFunction) {
    try {
      const product = await StorefrontProduct.findById(req.params.id)
        .populate("category_id", "name slug");
      if (!product) throw new AppError("Không tìm thấy sản phẩm.", 404);
      res.json({ status: "success", data: product });
    } catch (error) {
      next(error);
    }
  }
}
