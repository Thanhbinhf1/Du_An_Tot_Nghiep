import type { Request, Response, NextFunction } from "express";
import Category from "../models/categoryModel.js";
import StorefrontProduct from "../models/storefrontProductModel.js";
import { AppError } from "../middlewares/AppError.js";
import Outfit from "../models/outfitModel.js";
import OutfitDetail from "../models/outfitDetailModel.js";
import SizeRecommendation, { ProductSizeChart, type SizeChartRow } from "../models/sizeRecommendationModel.js";
import mongoose from "mongoose";
import { getStoreInfo } from "../config/storeInfo.js";
import Product from "../models/productModel.js";
import ProductImage from "../models/productImageModel.js";
import Variant from "../models/productVariantModel.js";
import { productAudiences } from "../services/catalogAudience.js";
import { chartMeasurements, compareSizes, matchSizeChart, readFit, readMeasurements } from "../services/sizeGuide.js";
import { visibleCategoryIds } from "../services/categoryPolicy.js";
import { deliveredSales } from "../services/adminAnalytics.js";

function catalogId(value: unknown, label: string) {
  if (typeof value !== "string" || !mongoose.isObjectIdOrHexString(value)) {
    throw new AppError(`ID ${label} không hợp lệ.`, 400);
  }
  return new mongoose.Types.ObjectId(value);
}

async function sizeScope(input: Record<string, unknown>) {
  const productId = input.productId === undefined ? undefined : catalogId(input.productId, "sản phẩm");
  const requestedCategory = input.categoryId === undefined ? undefined : catalogId(input.categoryId, "danh mục");
  if (!productId && !requestedCategory) throw new AppError("Vui lòng chọn danh mục hoặc sản phẩm.", 400);
  const product = productId
    ? await Product.findOne({ _id: productId, status: true }).select("name category_id").lean()
    : null;
  if (productId && (!product || (requestedCategory && !requestedCategory.equals(product.category_id)))) {
    throw new AppError("Sản phẩm không thuộc danh mục hoặc đã ngừng bán.", 404);
  }
  const categoryId = requestedCategory ?? product?.category_id ?? undefined;
  const categories = categoryId ? await Category.find().select("name parent_id status").lean() : [];
  const category = categoryId && visibleCategoryIds(categories).has(String(categoryId))
    ? categories.find((entry) => categoryId.equals(entry._id))
    : undefined;
  if (!product && !category) throw new AppError("Danh mục không còn hiển thị.", 404);
  const [productRows, categoryRows] = await Promise.all([
    productId ? ProductSizeChart.find({ product_id: productId }).lean() : [],
    category?._id ? SizeRecommendation.find({ category_id: category._id }).lean() : [],
  ]);
  const rows: SizeChartRow[] = productRows.length ? productRows : categoryRows;
  const source = productRows.length ? "product" : categoryRows.length ? "category" : "unavailable";
  return { category, product, categoryRows, rows: rows.sort(compareSizes), source };
}

export class CatalogController {
  static async getBestSellers(_req: Request, res: Response, next: NextFunction) {
    try {
      const totals = new Map<string, number>();
      for (const sale of await deliveredSales()) {
        const id = String(sale._id.product);
        if (mongoose.isObjectIdOrHexString(id) && sale.quantity > 0) {
          totals.set(id, (totals.get(id) ?? 0) + sale.quantity);
        }
      }
      const ids = await Product.distinct("_id", { status: true, _id: { $in: [...totals.keys()] } });
      const ranking = ids.map(String).sort((a, b) => totals.get(b)! - totals.get(a)! || a.localeCompare(b));
      res.set("Cache-Control", "public, max-age=60").json({ status: "success", data: ranking.slice(0, 12) });
    } catch (error) {
      next(error);
    }
  }

  static async storeInfo(_req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ status: "success", data: await getStoreInfo() });
    } catch (error) {
      next(error);
    }
  }

  static async getOutfits(_req: Request, res: Response, next: NextFunction) {
    try {
      const outfits = await Outfit.find({ is_active: true }).select("title description image style occasion gallery").sort({ created_at: -1 }).lean();
      const details = await OutfitDetail.find({ outfit_id: { $in: outfits.map((outfit) => outfit._id) } })
        .select("outfit_id product_id").sort({ display_order: 1 }).lean();
      const products = await Product.find({ _id: { $in: details.map((detail) => detail.product_id) }, status: true })
        .select("category_id").lean();
      const [productCharts, categoryCharts, categories] = await Promise.all([
        ProductSizeChart.distinct("product_id", { product_id: { $in: products.map((item) => item._id) } }),
        SizeRecommendation.distinct("category_id", { category_id: { $in: products.flatMap((item) => item.category_id ? [item.category_id] : []) } }),
        Category.find().select("status parent_id").lean(),
      ]);
      const configuredProducts = new Set(productCharts.map(String));
      const visible = visibleCategoryIds(categories);
      const configuredCategories = new Set(categoryCharts.map(String).filter((id) => visible.has(id)));
      const guidedProducts = new Set(products.filter((item) =>
        configuredProducts.has(String(item._id)) || configuredCategories.has(String(item.category_id))).map((item) => String(item._id)));
      const productIds = new Map<string, string[]>();
      for (const detail of details) {
        const id = String(detail.outfit_id);
        const products = productIds.get(id) ?? [];
        products.push(String(detail.product_id));
        productIds.set(id, products);
      }
      res.json({ status: "success", data: outfits.map((outfit) => {
        const ids = productIds.get(String(outfit._id)) ?? [];
        return { ...outfit, product_ids: ids, size_guide_product_ids: ids.filter((id) => guidedProducts.has(id)) };
      }) });
    } catch (error) {
      next(error);
    }
  }

  static async getSizeChart(req: Request, res: Response, next: NextFunction) {
    try {
      const { rows, source, product, category } = await sizeScope(req.query);
      res.set("Cache-Control", "no-store").json({ status: "success", data: {
        rows, source, name: product?.name ?? category?.name, categoryName: category?.name,
      } });
    } catch (error) {
      next(error);
    }
  }

  static async recommendSize(req: Request, res: Response, next: NextFunction) {
    try {
      const input: Record<string, unknown> = req.method === "GET" ? req.query : req.body ?? {};
      const fit = readFit(input.fit);
      const measurements = readMeasurements(input, req.method === "GET");
      const { rows, source, product, category, categoryRows } = await sizeScope(input);
      const fields = chartMeasurements(rows, fit);
      if (fields.some(({ key, required }) => required && measurements[key] === undefined)) {
        throw new AppError("Vui lòng nhập đầy đủ số đo bắt buộc của bảng kích cỡ.", 400);
      }
      const matches = matchSizeChart(rows, fit, measurements);
      const primary = matches[0]?.size;
      const candidates = primary && category
        ? await Product.find({ category_id: category._id, status: true }).select("_id").lean()
        : product ? [product] : [];
      const [variants, otherCharts] = primary ? await Promise.all([
        Variant.find({ product_id: { $in: candidates.map((item) => item._id) }, status: true, stock_quantity: { $gt: 0 } })
          .select("product_id size").lean(),
        ProductSizeChart.find({ product_id: { $in: candidates.map((item) => item._id) } }).lean(),
      ]) : [[], []] as const;
      const chartsByProduct = new Map<string, SizeChartRow[]>();
      for (const row of otherCharts) {
        const id = String(row.product_id);
        const list = chartsByProduct.get(id) ?? [];
        list.push(row);
        chartsByProduct.set(id, list);
      }
      const categoryMatches = matchSizeChart(categoryRows, fit, measurements).some((row) => row.size === primary);
      const eligible = new Set(candidates.filter((item) => {
        if (product?._id.equals(item._id)) return true;
        const ownChart = chartsByProduct.get(String(item._id));
        return ownChart
          ? matchSizeChart(ownChart, fit, measurements).some((row) => row.size === primary)
          : categoryMatches;
      }).map((item) => String(item._id)));
      const productIds = [...new Set(variants.filter((item) =>
        eligible.has(String(item.product_id)) && item.size.trim().toUpperCase() === primary,
      ).map((item) => String(item.product_id)))];
      res.set("Cache-Control", "no-store").json({
        status: "success", data: matches.map((row) => row.size),
        recommendation: { source, name: product?.name ?? category?.name, rows, match: matches[0], productIds },
      });
    } catch (error) {
      next(error);
    }
  }

  static async getCategories(_req: Request, res: Response, next: NextFunction) {
    try {
      const [categories, groups, thumbnails] = await Promise.all([
        Category.find({}).sort({ name: 1 }).lean(),
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
      const visible = visibleCategoryIds(categories);
      res.json({ status: "success", data: categories.filter((category) => visible.has(String(category._id))).map((category) => ({
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
