import type { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import Product from "../models/productModel.js";
import ProductVariant from "../models/productVariantModel.js";

const fields = ["sku", "size", "color", "price", "sale_price", "stock_quantity", "status"] as const;

function readInput(body: unknown, creating: boolean): Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Dữ liệu biến thể phải là một object");
  }
  const input = body as Record<string, unknown>;
  if (Object.keys(input).some((key) => !fields.includes(key as typeof fields[number]))) {
    throw new Error("Dữ liệu chứa trường không được phép cập nhật");
  }
  const updates: Record<string, unknown> = {};
  for (const field of fields) {
    const value = input[field];
    if (value === undefined) continue;
    if (field === "sku" || field === "size" || field === "color") {
      if (typeof value !== "string" || !value.trim()) throw new Error(`${field} phải là chuỗi không rỗng`);
      updates[field] = field === "sku" ? value.trim().toUpperCase() : value.trim();
    } else if (field === "status") {
      if (typeof value !== "boolean") throw new Error("status phải là boolean");
      updates[field] = value;
    } else if (field === "sale_price" && value === null) {
      updates[field] = null;
    } else {
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0 ||
          (field === "stock_quantity" && !Number.isSafeInteger(value))) {
        throw new Error(`${field} phải là số không âm${field === "stock_quantity" ? " và là số nguyên an toàn" : ""}`);
      }
      updates[field] = value;
    }
  }
  if (creating && ["sku", "size", "color", "price"].some((field) => updates[field] === undefined)) {
    throw new Error("Vui lòng nhập sku, size, color và price");
  }
  if (!Object.keys(updates).length) throw new Error("Vui lòng nhập dữ liệu cần cập nhật");
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
  let input: Record<string, unknown>;
  try { input = readInput(req.body, true); }
  catch (error) { return res.status(400).json({ message: (error as Error).message }); }
  try {
    const product = await Product.findById((req.params.productId as string));
    if (!product) return res.status(404).json({ message: "Không tìm thấy sản phẩm" });
    const variant = await ProductVariant.create({ ...input, product_id: product._id });
    return res.status(201).json({ message: "Thêm biến thể thành công", data: variant });
  } catch (error) { handleError(error, res, next); }
};

export const updateProductVariant = async (req: Request, res: Response, next: NextFunction) => {
  let input: Record<string, unknown>;
  try { input = readInput(req.body, false); }
  catch (error) { return res.status(400).json({ message: (error as Error).message }); }
  try {
    if (!await Product.exists({ _id: (req.params.productId as string) })) {
      return res.status(404).json({ message: "Không tìm thấy sản phẩm" });
    }
    const variant = await ProductVariant.findOne({ _id: (req.params.variantId as string), product_id: (req.params.productId as string) });
    if (!variant) return res.status(404).json({ message: "Không tìm thấy biến thể của sản phẩm" });
    variant.set(input);
    await variant.save();
    return res.status(200).json({ message: "Cập nhật biến thể thành công", data: variant });
  } catch (error) { handleError(error, res, next); }
};

// Ngừng bán để giữ nguyên tham chiếu trong giỏ hàng và lịch sử đơn hàng.
export const deleteProductVariant = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!await Product.exists({ _id: (req.params.productId as string) })) {
      return res.status(404).json({ message: "Không tìm thấy sản phẩm" });
    }
    const variant = await ProductVariant.findOne({ _id: (req.params.variantId as string), product_id: (req.params.productId as string) });
    if (!variant) return res.status(404).json({ message: "Không tìm thấy biến thể của sản phẩm" });
    variant.status = false;
    await variant.save();
    return res.status(200).json({ message: "Ngừng bán biến thể thành công", data: variant });
  } catch (error) { handleError(error, res, next); }
};
