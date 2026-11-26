import { legacyBundle, saveLegacyBundle } from "../services/catalogLegacyAdapter.js";
import type { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import Product from "../models/productModel.js";
import ProductVariant from "../models/productVariantModel.js";

import { AppError } from "../middlewares/AppError.js";

const invalid = (message: string) => new AppError(message, 400);
const fields = ["sku", "size", "color", "price", "sale_price", "stock_quantity", "status", "expected_version"] as const;

function readInput(body: unknown, creating: boolean): Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw invalid("Dữ liệu biến thể phải là một object");
  }
  const input = body as Record<string, unknown>;
  if (creating && input.expected_version !== undefined) throw invalid("expected_version chỉ dùng khi cập nhật");
  if (!creating && input.stock_quantity !== undefined && input.expected_version === undefined) {
    throw invalid("Vui lòng tải lại biến thể trước khi cập nhật tồn kho");
  }
  if (Object.keys(input).some((key) => !fields.includes(key as typeof fields[number]))) {
    throw invalid("Dữ liệu chứa trường không được phép cập nhật");
  }
  const updates: Record<string, unknown> = {};
  for (const field of fields) {
    const value = input[field];
    if (value === undefined) continue;
    if (field === "sku" || field === "size" || field === "color") {
      if (typeof value !== "string" || !value.trim()) throw invalid(`${field} phải là chuỗi không rỗng`);
      updates[field] = field === "sku" ? value.trim().toUpperCase() : value.trim();
    } else if (field === "status") {
      if (typeof value !== "boolean") throw invalid("status phải là boolean");
      updates[field] = value;
    } else if (field === "sale_price" && value === null) {
      updates[field] = null;
    } else {
      if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
        throw invalid(`${field} phải là số nguyên an toàn không âm`);
      }
      updates[field] = value;
    }
  }
  if (creating && ["sku", "size", "color", "price"].some((field) => updates[field] === undefined)) {
    throw invalid("Vui lòng nhập sku, size, color và price");
  }
  if (!Object.keys(updates).some((key) => key !== "expected_version")) throw invalid("Vui lòng nhập dữ liệu cần cập nhật");
  return updates;
}

function handleError(error: unknown, res: Response, next: NextFunction) {
  if (error && typeof error === "object" && "code" in error && error.code === 11000) {
    return res.status(409).json({ message: "SKU hoặc tổ hợp size và color của sản phẩm đã tồn tại" });
  }
  if (error instanceof mongoose.Error.ValidationError) {
    return res.status(400).json({ message: error.message });
  }
  if (error instanceof mongoose.Error.VersionError) {
    return res.status(409).json({ message: "Biến thể vừa được cập nhật, vui lòng tải lại và thử lại" });
  }
  next(error);
}

// Router được lồng dưới /api/products/:productId/variants.
export const validateVariantIds = (req: Request, res: Response, next: NextFunction) => {
  for (const key of ["productId", "variantId"]) {
    const value = req.params[key];
    if ((key === "productId" || value !== undefined) &&
        (typeof value !== "string" || !mongoose.isObjectIdOrHexString(value))) {
      return res.status(400).json({ message: `${key} không hợp lệ` });
    }
  }
  next();
};

export const getProductVariants = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const product = await Product.findOne({ _id: (req.params.productId as string), status: true });
    if (!product) return res.status(404).json({ message: "Không tìm thấy sản phẩm" });
    const variants = await ProductVariant.find({ product_id: product._id, status: true }).sort({ _id: 1 }).lean();
    return res.status(200).json({ message: "Lấy danh sách biến thể thành công", data: variants });
  } catch (error) { handleError(error, res, next); }
};

// Danh sách quản trị bao gồm cả biến thể và sản phẩm đã ngừng bán.
export const getAdminProductVariants = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!await Product.exists({ _id: req.params.productId as string })) {
      return res.status(404).json({ message: "Không tìm thấy sản phẩm" });
    }
    const variants = await ProductVariant.find({ product_id: req.params.productId as string })
      .sort({ _id: 1 }).lean();
    return res.status(200).json({ message: "Lấy danh sách biến thể quản trị thành công", data: variants });
  } catch (error) { handleError(error, res, next); }
};

export const createProductVariant = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = readInput(req.body, true), id = String(req.params.productId);
    const bundle = await legacyBundle(id);
    bundle.variants.push({ ...input, sale_price: input.sale_price ?? null, status: input.status ?? true } as typeof bundle.variants[number]);
    const state = await saveLegacyBundle(req, id, bundle);
    res.status(201).json({ data: state.variants.find(row => row.sku === input.sku) });
  } catch (error) { handleError(error, res, next); }
};
export const createProductVariantsBatch = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!Array.isArray(req.body?.variants) || !req.body.variants.length || req.body.variants.length > 200) throw new AppError("Cần từ 1 đến 200 SKU.", 400);
    const id = String(req.params.productId), bundle = await legacyBundle(id);
    const inputs = req.body.variants.map((row: unknown) => readInput(row, true));
    bundle.variants.push(...inputs.map((row: Record<string, unknown>) => ({ ...row, sale_price: row.sale_price ?? null, status: row.status ?? true })));
    if (req.body.color_images !== undefined && !Array.isArray(req.body.color_images)) throw new AppError("Ảnh không hợp lệ.", 400);
    for (const image of req.body.color_images ?? []) bundle.images.push({ image_url: image.image_url, color: image.color, is_primary: bundle.images.length === 0 });
    const state = await saveLegacyBundle(req, id, bundle);
    res.status(201).json({ data: state.variants.filter(row => inputs.some((input: Record<string, unknown>) => input.sku === row.sku)) });
  } catch (error) { handleError(error, res, next); }
};
export const updateProductVariant = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = readInput(req.body, false), id = String(req.params.productId), bundle = await legacyBundle(id);
    const row = bundle.variants.find(row => row._id === req.params.variantId);
    if (!row) throw new AppError("Không tìm thấy biến thể của sản phẩm.", 404);
    if (input.expected_version === undefined) throw new AppError("Cần expected_version từ SKU đã đọc.", 400);
    Object.assign(row, input);
    const state = await saveLegacyBundle(req, id, bundle);
    res.json({ data: state.variants.find(row => String(row._id) === req.params.variantId) });
  } catch (error) { handleError(error, res, next); }
};
export const deleteProductVariant = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.productId), bundle = await legacyBundle(id);
    const row = bundle.variants.find(row => row._id === req.params.variantId);
    if (!row) throw new AppError("Không tìm thấy biến thể.", 404);
    row.status = false;
    const state = await saveLegacyBundle(req, id, bundle);
    res.json({ data: state.variants.find(row => String(row._id) === req.params.variantId), message: "Đã ngừng bán, giữ lịch sử." });
  } catch (error) { handleError(error, res, next); }
};
