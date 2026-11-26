import mongoose, { type ClientSession, type Types } from "mongoose";
import Category, { type ICategory } from "../models/categoryModel.js";
import Product from "../models/productModel.js";
import LegacyProduct from "../models/storefrontProductModel.js";
import SizeRule from "../models/sizeRecommendationModel.js";
import { AppError } from "../middlewares/AppError.js";
import { CatalogInputError, isImageUrl, makeSlug } from "./catalogValidation.js";

export const reservedCategorySlugs = ["nam", "nu", "tre-em", "em-be"];
type Node = { _id: unknown; parent_id?: unknown; status?: boolean };
export function visibleCategoryIds(nodes: Node[]) {
  const byId = new Map(nodes.map((node) => [String(node._id), node]));
  return new Set(nodes.filter((node) => {
    const visited = new Set<string>(); let current: Node | undefined = node;
    while (current) {
      const id = String(current._id);
      if (visited.has(id) || current.status === false) return false;
      visited.add(id);
      if (!current.parent_id) return true;
      const parent = current.parent_id as { _id?: unknown };
      current = byId.get(String(parent._id ?? parent));
      if (!current) return false;
    }
    return true;
  }).map((node) => String(node._id)));
}
export async function assertCategoryReference(id: string | Types.ObjectId, session: ClientSession, active = false) {
  const visited = new Set<string>(); let next: string | Types.ObjectId | null = id;
  while (next) {
    const key = String(next);
    if (visited.has(key)) throw new AppError("Cây danh mục đang có vòng lặp; cần kiểm tra trước khi lưu.", 409);
    visited.add(key);
    const node: (ICategory & { _id: Types.ObjectId }) | null = await Category.findById(next).session(session).lean();
    if (!node) throw new AppError("Danh mục hoặc danh mục cha không tồn tại.", 404);
    if (active && !node.status) throw new AppError("Danh mục và các danh mục cha phải đang hiển thị khi phân loại/xuất bản mới.", 409);
    next = node.parent_id;
  }
}
export function categoryInput(body: unknown, current?: { name: string; slug: string; image?: string; description: string; status: boolean; parent_id?: unknown }) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new AppError("Dữ liệu danh mục không hợp lệ.", 400);
  const input = body as Record<string, unknown>, issues: { path: string; message: string }[] = [];
  const name = input.name === undefined ? current?.name ?? "" : typeof input.name === "string" ? input.name.trim() : "";
  if (!name || name.length > 120) issues.push({ path: "name", message: "Tên danh mục bắt buộc, tối đa 120 ký tự." });
  const slug = input.slug === undefined ? current?.slug ?? makeSlug(name) : typeof input.slug === "string" ? input.slug.trim().toLowerCase() : "";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 150) issues.push({ path: "slug", message: "Slug tối đa150 ký tự, chỉ gồm chữ thường không dấu, số và dấu gạch nối." });
  const image = input.image === undefined ? current?.image ?? "" : typeof input.image === "string" ? input.image.trim() : "invalid";
  if (image && !isImageUrl(image)) issues.push({ path: "image", message: "Đường dẫn ảnh phải là HTTP(S) hoặc tệp upload hợp lệ." });
  const description = input.description === undefined ? current?.description ?? "" : typeof input.description === "string" ? input.description.trim() : "invalid";
  if ((input.description !== undefined && typeof input.description !== "string") || description.length > 2000) issues.push({ path: "description", message: "Mô tả tối đa2000 ký tự." });
  if (input.status !== undefined && typeof input.status !== "boolean") issues.push({ path: "status", message: "Trạng thái phải là boolean." });
  const parent = input.parent_id === undefined ? current?.parent_id ?? null : input.parent_id;
  const parentId = parent === "" || parent === null ? null : typeof parent === "string" && mongoose.isObjectIdOrHexString(parent) ? new mongoose.Types.ObjectId(parent) : parent instanceof mongoose.Types.ObjectId ? parent : null;
  if (parent !== "" && parent !== null && !parentId) issues.push({ path: "parent_id", message: "Mã danh mục cha không hợp lệ." });
  if (issues.length) throw new CatalogInputError(issues);
  return { name, slug, image, description, parent_id: parentId, status: input.status === undefined ? current?.status ?? true : input.status as boolean };
}
export async function checkCategoryParent(id: Types.ObjectId | null, ownId: Types.ObjectId | null, session: ClientSession, requireActive = true) {
  if (!id) return;
  let current: Types.ObjectId | null = id; const seen = new Set<string>();
  while (current) {
    const key = String(current);
    if (key === String(ownId) || seen.has(key)) throw new AppError("Danh mục cha tạo vòng lặp trong cây danh mục.", 409);
    seen.add(key);
    const parent: (ICategory & { _id: Types.ObjectId }) | null = await Category.findById(current).session(session).lean();
    if (!parent) throw new AppError("Danh mục cha không tồn tại.", 404);
    if (requireActive && !parent.status) throw new AppError("Không được chọn danh mục cha đã ẩn.", 409);
    current = parent.parent_id;
  }
}
export async function categoryImpact(id: Types.ObjectId, session: ClientSession | null = null) {
  const category = await Category.findById(id).session(session).lean();
  if (!category) throw new AppError("Không tìm thấy danh mục.", 404);
  const [children, direct, legacy, rules] = await Promise.all([
    Category.countDocuments({ parent_id: id }).session(session), Product.countDocuments({ category_id: id }).session(session),
    LegacyProduct.countDocuments({ category_id: id }).session(session), SizeRule.countDocuments({ category_id: id }).session(session),
  ]);
  const reserved = reservedCategorySlugs.includes(category.slug);
  const reasons = [...(children ? [`Có ${children} danh mục con.`] : []), ...(direct + legacy ? [`Đang phân loại ${direct + legacy} sản phẩm (gồm ${legacy} bản ghi cũ).`] : []), ...(rules ? [`Có ${rules} quy tắc tư vấn size.`] : []), ...(reserved ? ["Danh mục thuộc điều hướng cố định của storefront."] : [])];
  if (category.previous_slugs?.length) reasons.push("Danh mục đang giữ liên kết slug cũ; nên ẩn để giữ chuyển hướng.");
  return { category, children, direct_products: direct, legacy_products: legacy, size_rules: rules, reserved_navigation: reserved, can_delete: reasons.length === 0, reasons, policy: "Ẩn khỏi điều hướng/danh mục, giữ trạng thái bán của từng sản phẩm." };
}
