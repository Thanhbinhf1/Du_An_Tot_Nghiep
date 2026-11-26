import mongoose from "mongoose";
import { AppError } from "../middlewares/AppError.js";

export type CatalogIssue = { path: string; message: string };
export class CatalogInputError extends AppError {
  constructor(public issues: CatalogIssue[], code = 400) { super("Kiểm tra các trường được đánh dấu trước khi lưu.", code); }
}
export const normalizeAttribute = (value: string) => value.normalize("NFKC").trim().replace(/\s+/g, " ");
export const attributeKey = (size: string, color: string) => `${normalizeAttribute(size).toLocaleLowerCase("vi")}\u0000${normalizeAttribute(color).toLocaleLowerCase("vi")}`;
export function makeSlug(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
export function isImageUrl(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim() || value.length > 2000) return false;
  if (/^\/uploads\/[a-zA-Z0-9._-]+$/.test(value)) return true;
  try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password; } catch { return false; }
}
export type CatalogVariantInput = { _id?: string; expected_version?: number; sku: string; size: string; color: string; price: number; sale_price: number | null; status: boolean; stock_quantity?: number };
export type CatalogImageInput = { _id?: string; image_url: string; color?: string; is_primary: boolean };
export type CatalogMetadata = { name: string; slug: string; product_code?: string; category_id: string | null; brand_id: string | null; gender?: string; description: string; material: string; care_instructions: string; is_featured: boolean };
export type CatalogBundle = { product: CatalogMetadata; variants: CatalogVariantInput[]; images: CatalogImageInput[]; action: "draft" | "publish" | "save" | "hide"; expected_version?: number };
export function parseCatalogBundle(value: unknown): CatalogBundle {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new CatalogInputError([{ path: "product", message: "Dữ liệu sản phẩm phải là object." }]);
  const body = value as Record<string, unknown>, issues: CatalogIssue[] = [];
  const raw = body.product && typeof body.product === "object" && !Array.isArray(body.product) ? body.product as Record<string, unknown> : {};
  const text = (key: string, max: number, required = false) => {
    const value = raw[key];
    if ((value !== undefined && typeof value !== "string") || (typeof value === "string" && value.trim().length > max) || (required && (typeof value !== "string" || !value.trim()))) issues.push({ path: `product.${key}`, message: `${key === "name" ? "Tên sản phẩm" : key} ${required ? "bắt buộc và " : ""}tối đa ${max} ký tự.` });
    return typeof value === "string" ? value.trim() : "";
  };
  const name = text("name", 200, true), slug = text("slug", 200) || makeSlug(name);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) issues.push({ path: "product.slug", message: "Slug chỉ gồm chữ thường không dấu, số và dấu gạch nối." });
  const code = text("product_code", 60).toUpperCase();
  if (code && !/^[A-Z0-9]+(?:[-_][A-Z0-9]+)*$/.test(code)) issues.push({ path: "product.product_code", message: "Mã sản phẩm chỉ gồm A-Z, số, gạch nối hoặc gạch dưới." });
  const ref = (key: string) => {
    const value = raw[key]; if (value === undefined || value === null || value === "") return null;
    if (typeof value !== "string" || !mongoose.isObjectIdOrHexString(value)) { issues.push({ path: `product.${key}`, message: "Mã tham chiếu không hợp lệ." }); return null; }
    return value;
  };
  const gender = text("gender", 30);
  if (gender && !["Nam", "Nữ", "Trẻ em", "Em bé", "Unisex"].includes(gender)) issues.push({ path: "product.gender", message: "Nhóm khách hàng không hợp lệ." });
  if (raw.is_featured !== undefined && typeof raw.is_featured !== "boolean") issues.push({ path: "product.is_featured", message: "Trạng thái nổi bật phải là boolean." });
  const product: CatalogMetadata = { name, slug, ...(code ? { product_code: code } : {}), category_id: ref("category_id"), brand_id: ref("brand_id"), ...(gender ? { gender } : {}), description: text("description", 10000), material: text("material", 2000), care_instructions: text("care_instructions", 2000), is_featured: raw.is_featured === true };
  const variants: CatalogVariantInput[] = [], skus = new Set<string>(), pairs = new Set<string>(), ids = new Set<string>();
  if (!Array.isArray(body.variants) || body.variants.length > 200) issues.push({ path: "variants", message: "Danh sách tối đa 200 SKU." });
  else body.variants.forEach((row: unknown, index: number) => {
    const path = `variants.${index}`;
    if (!row || typeof row !== "object" || Array.isArray(row)) { issues.push({ path, message: "Dòng biến thể không hợp lệ." }); return; }
    const input = row as Record<string, unknown>;
    const rowText = (key: string, max: number) => { const value = input[key]; if (typeof value !== "string" || !value.trim() || value.trim().length > max) issues.push({ path: `${path}.${key}`, message: `Bắt buộc, tối đa ${max} ký tự.` }); return typeof value === "string" ? normalizeAttribute(value) : ""; };
    const sku = rowText("sku", 100).toUpperCase(), size = rowText("size", 60), color = rowText("color", 60), pair = attributeKey(size, color);
    if (skus.has(sku)) issues.push({ path: `${path}.sku`, message: "SKU bị trùng trong bảng." }); skus.add(sku);
    if (pairs.has(pair)) issues.push({ path: `${path}.color`, message: "Tổ hợp size/màu bị trùng (không phân biệt hoa thường)." }); pairs.add(pair);
    for (const key of ["price", "sale_price", "stock_quantity", "expected_version"]) {
      const number = input[key];
      if (key === "sale_price" && (number === null || number === undefined)) continue;
      if (["stock_quantity", "expected_version"].includes(key) && number === undefined) continue;
      if (typeof number !== "number" || !Number.isSafeInteger(number) || number < 0) issues.push({ path: `${path}.${key}`, message: "Phải là số nguyên an toàn không âm." });
    }
    if (typeof input.sale_price === "number" && typeof input.price === "number" && input.sale_price > input.price) issues.push({ path: `${path}.sale_price`, message: "Giá giảm không được vượt giá gốc." });
    if (typeof input.status !== "boolean") issues.push({ path: `${path}.status`, message: "Trạng thái phải là boolean." });
    if (input._id !== undefined) {
      if (typeof input._id !== "string" || !mongoose.isObjectIdOrHexString(input._id) || ids.has(input._id)) issues.push({ path: `${path}._id`, message: "ID dòng không hợp lệ hoặc trùng." });
      else ids.add(input._id);
      if (!Number.isSafeInteger(input.expected_version) || Number(input.expected_version) < 0) issues.push({ path: `${path}.expected_version`, message: "Cần phiên bản dòng đã đọc." });
    }
    variants.push({ ...(typeof input._id === "string" ? { _id: input._id } : {}), ...(typeof input.expected_version === "number" ? { expected_version: input.expected_version } : {}), sku, size, color, price: input.price as number, sale_price: input.sale_price == null ? null : input.sale_price as number, status: input.status === true, ...(typeof input.stock_quantity === "number" ? { stock_quantity: input.stock_quantity } : {}) });
  });
  const images: CatalogImageInput[] = [];
  if (!Array.isArray(body.images) || body.images.length > 30) issues.push({ path: "images", message: "Tối đa 30 ảnh." });
  else body.images.forEach((row: unknown, index: number) => {
    const path = `images.${index}`;
    if (!row || typeof row !== "object" || Array.isArray(row)) { issues.push({ path, message: "Ảnh không hợp lệ." }); return; }
    const image = row as Record<string, unknown>;
    if (typeof image.is_primary !== "boolean") issues.push({ path: `${path}.is_primary`, message: "Trạng thái ảnh chính phải là boolean." });
    if (!isImageUrl(image.image_url)) issues.push({ path: `${path}.image_url`, message: "Ảnh phải dùng HTTP(S) hoặc tệp upload hợp lệ." });
    if (image._id !== undefined && (typeof image._id !== "string" || !mongoose.isObjectIdOrHexString(image._id))) issues.push({ path: `${path}._id`, message: "ID ảnh không hợp lệ." });
    const color = typeof image.color === "string" ? normalizeAttribute(image.color) : "";
    if (image.color !== undefined && typeof image.color !== "string") issues.push({ path: `${path}.color`, message: "Màu ảnh không hợp lệ." });
    if (color && !variants.some((variant) => normalizeAttribute(variant.color).toLocaleLowerCase("vi") === color.toLocaleLowerCase("vi"))) issues.push({ path: `${path}.color`, message: "Màu ảnh phải thuộc biến thể trong bảng." });
    images.push({ ...(typeof image._id === "string" ? { _id: image._id } : {}), image_url: String(image.image_url ?? "").trim(), ...(color ? { color } : {}), is_primary: image.is_primary === true });
  });
  if (images.length && images.filter((image) => image.is_primary).length !== 1) issues.push({ path: "images", message: "Cần đúng một ảnh chính." });
  if (!["draft", "publish", "save", "hide"].includes(String(body.action))) issues.push({ path: "action", message: "Thao tác lưu không hợp lệ." });
  if (body.expected_version !== undefined && (typeof body.expected_version !== "number" || !Number.isSafeInteger(body.expected_version) || body.expected_version < 0)) issues.push({ path: "expected_version", message: "Phiên bản sản phẩm không hợp lệ." });
  if (issues.length) throw new CatalogInputError(issues);
  return { product, variants, images, action: body.action as CatalogBundle["action"], ...(typeof body.expected_version === "number" ? { expected_version: body.expected_version } : {}) };
}
export function publicationIssues(bundle: CatalogBundle): CatalogIssue[] {
  return [
    ...(!bundle.product.product_code ? [{ path: "product.product_code", message: "Cần mã sản phẩm trước khi xuất bản." }] : []),
    ...(!bundle.product.category_id ? [{ path: "product.category_id", message: "Chọn danh mục đang hoạt động." }] : []),
    ...(!bundle.product.brand_id ? [{ path: "product.brand_id", message: "Chọn thương hiệu đang hoạt động." }] : []),
    ...(!bundle.variants.some((row) => row.status) ? [{ path: "variants", message: "Cần ít nhất một SKU đang bán (tồn0 được phép)." }] : []),
    ...(!bundle.images.length ? [{ path: "images", message: "Cần ít nhất một ảnh trước khi xuất bản." }] : []),
  ];
}
