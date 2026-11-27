import mongoose from "mongoose";
import Category from "../models/categoryModel.js";
import Product from "../models/productModel.js";
import Variant from "../models/productVariantModel.js";
import SizeRecommendation, { ProductSizeChart, type SizeChartRow } from "../models/sizeRecommendationModel.js";
import { AppError } from "../middlewares/AppError.js";
import { chartMeasurements, compareSizes, matchSizeChart, readFit, readMeasurements } from "./sizeGuide.js";
import { visibleCategoryIds } from "./categoryPolicy.js";

function catalogId(value: unknown, label: string) {
  if (typeof value !== "string" || !mongoose.isObjectIdOrHexString(value)) {
    throw new AppError(`ID ${label} không hợp lệ.`, 400);
  }
  return new mongoose.Types.ObjectId(value);
}

export async function sizeScope(input: Record<string, unknown>) {
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

export async function recommendCatalogSize(input: Record<string, unknown>, fromQuery = false) {
  const fit = readFit(input.fit);
  const measurements = readMeasurements(input, fromQuery);
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
  return {
    sizes: matches.map((row) => row.size),
    recommendation: { source, name: product?.name ?? category?.name, rows, match: matches[0], productIds },
  };
}
