import type { Request, Response, NextFunction } from "express";
import mongoose, { type ClientSession } from "mongoose";
import Category from "../models/categoryModel.js";
import Product from "../models/productModel.js";
import LegacyProduct from "../models/storefrontProductModel.js";
import { AppError } from "../middlewares/AppError.js";
import type { AuthRequest } from "../middlewares/authMiddleware.js";
import { categoryImpact, categoryInput, checkCategoryParent, reservedCategorySlugs, visibleCategoryIds } from "../services/categoryPolicy.js";
import { catalogMutation, lockCategoryTree } from "../services/catalogMutation.js";

function validId(value: unknown) { if (typeof value !== "string" || !mongoose.isObjectIdOrHexString(value)) throw new AppError("ID danh mục không hợp lệ.", 400); return new mongoose.Types.ObjectId(value); }
async function uniqueSlug(slug: string, own: mongoose.Types.ObjectId | null, session: ClientSession) {
  if (await Category.exists({ ...(own ? { _id: { $ne: own } } : {}), $or: [{ slug }, { previous_slugs: slug }] }).session(session)) throw new AppError("Slug hoặc đường dẫn cũ đã thuộc danh mục khác.", 409);
}
export class CategoryController {
  static async getCategories(req: Request, res: Response, next: NextFunction) {
    try {
      const all = await Category.find({}).sort({ name: 1 }).lean(); const visible = visibleCategoryIds(all);
      const rows = req.query.all === "true" ? all : all.filter((row) => visible.has(String(row._id)));
      const byId = new Map(all.map((row) => [String(row._id), row]));
      res.json({ status: "success", results: rows.length, data: rows.map((row) => ({ ...row, parent_id: row.parent_id ? byId.get(String(row.parent_id)) ?? null : null })) });
    } catch (error) { next(error); }
  }
  static async adminList(_req: Request, res: Response, next: NextFunction) {
    try {
      const [rows, grouped, legacy] = await Promise.all([
        Category.find({}).sort({ name: 1, _id: 1 }).lean(),
        Product.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([{ $group: { _id: "$category_id", count: { $sum: 1 } } }]),
        LegacyProduct.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([{ $group: { _id: "$category_id", count: { $sum: 1 } } }]),
      ]);
      const counts = new Map(grouped.map((row) => [String(row._id), row.count]));
      for (const row of legacy) counts.set(String(row._id), (counts.get(String(row._id)) ?? 0) + row.count);
      const byId = new Map(rows.map((row) => [String(row._id), row])), totals = new Map<string, number>();
      for (const row of rows) {
        let current: typeof row | undefined = row; const seen = new Set<string>();
        while (current && !seen.has(String(current._id))) {
          const id = String(current._id); seen.add(id); totals.set(id, (totals.get(id) ?? 0) + (counts.get(String(row._id)) ?? 0));
          current = current.parent_id ? byId.get(String(current.parent_id)) : undefined;
        }
      }
      const visible = visibleCategoryIds(rows);
      res.json({ status: "success", data: rows.map((row) => ({ ...row, direct_products: counts.get(String(row._id)) ?? 0, branch_products: totals.get(String(row._id)) ?? 0, children: rows.filter((child) => String(child.parent_id) === String(row._id)).length, effective_visible: visible.has(String(row._id)), reserved_navigation: reservedCategorySlugs.includes(row.slug) })) });
    } catch (error) { next(error); }
  }
  static async impact(req: Request, res: Response, next: NextFunction) {
    try { res.json({ status: "success", data: await categoryImpact(validId(req.params.id)) }); } catch (error) { next(error); }
  }
  static async resolve(req: Request, res: Response, next: NextFunction) {
    try {
      const slug = typeof req.params.slug === "string" ? req.params.slug : "";
      const rows = await Category.find({}).select("slug previous_slugs parent_id status").lean();
      const row = rows.find((row) => row.slug === slug || row.previous_slugs?.includes(slug));
      const virtual = !row && reservedCategorySlugs.includes(slug);
      const visible = row ? visibleCategoryIds(rows).has(String(row._id)) : virtual;
      res.json({ status: "success", data: { exists: !!row, virtual, visible, canonical_slug: row?.slug ?? slug } });
    } catch (error) { next(error); }
  }
  static async getCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const id = validId(req.params.id), rows = await Category.find({}).lean();
      const category = rows.find((row) => String(row._id) === String(id));
      if (!category || !visibleCategoryIds(rows).has(String(id))) throw new AppError("Danh mục không còn hiển thị.", 404);
      res.json({ status: "success", data: category });
    } catch (error) { next(error); }
  }
  static async createCategory(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const values = categoryInput(req.body);
      const work = async (session: ClientSession) => {
        await lockCategoryTree(session); await checkCategoryParent(values.parent_id, null, session); await uniqueSlug(values.slug, null, session);
        const rows = await Category.create([values], { session }); return rows[0]!._id;
      };
      const key = req.headers["idempotency-key"];
      const result = key ? await catalogMutation({ actor: req.user!._id, kind: "category", key, body: req.body }, work) : { id: await mongoose.connection.transaction(work), replayed: false };
      const category = await Category.findById(result.id).lean();
      res.status(result.replayed ? 200 : 201).json({ status: "success", message: "Đã lưu danh mục.", data: category, replayed: result.replayed });
    } catch (error) { next(error); }
  }
  static async updateCategory(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = validId(req.params.id), expected = req.body.expected_version;
      if (!Number.isSafeInteger(expected) || expected < 0) throw new AppError("Cần phiên bản danh mục đã đọc trước khi lưu.", 400);
      const work = async (session: ClientSession) => {
        await lockCategoryTree(session);
        const category = await Category.findById(id).session(session);
        if (!category) throw new AppError("Không tìm thấy danh mục.", 404);
        if ((category.get("__v") ?? 0) !== expected) throw new AppError("Danh mục đã được cập nhật. Tải lại trước khi lưu.", 409);
        const values = categoryInput(req.body, category);
        if (reservedCategorySlugs.includes(category.slug) && values.slug !== category.slug) throw new AppError("Không đổi slug danh mục thuộc điều hướng cố định; có thể sửa tên/ảnh/trạng thái.", 409);
        await uniqueSlug(values.slug, category._id, session);
        const changedParent = String(values.parent_id) !== String(category.parent_id);
        await checkCategoryParent(values.parent_id, category._id, session, changedParent || (!category.status && values.status));
        if (values.slug !== category.slug) category.previous_slugs = [...new Set([...(category.previous_slugs ?? []), category.slug])].filter((slug) => slug !== values.slug);
        category.set(values); await category.save({ session }); return category._id;
      };
      const key = req.headers["idempotency-key"];
      const result = key ? await catalogMutation({ actor: req.user!._id, kind: "category", key, body: { id: String(id), ...req.body } }, work) : { id: await mongoose.connection.transaction(work), replayed: false };
      res.json({ status: "success", message: "Đã cập nhật danh mục; trạng thái bán sản phẩm được giữ nguyên.", data: await Category.findById(result.id).lean(), replayed: result.replayed });
    } catch (error) { next(error); }
  }
  static async deleteCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const id = validId(req.params.id);
      await mongoose.connection.transaction(async (session) => {
        await lockCategoryTree(session); const impact = await categoryImpact(id, session);
        if (!impact.can_delete) throw new AppError(`Chưa thể xóa: ${impact.reasons.join(" ")} Có thể ẩn danh mục hoặc chuyển phân loại trước.`, 409);
        await Category.deleteOne({ _id: id }, { session });
      });
      res.json({ status: "success", message: "Đã xóa danh mục rỗng. Không xóa sản phẩm hay lịch sử giao dịch." });
    } catch (error) { next(error); }
  }
}
