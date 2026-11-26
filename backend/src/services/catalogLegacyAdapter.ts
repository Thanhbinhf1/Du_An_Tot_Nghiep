import mongoose from "mongoose";
import type { Request } from "express";
import type { AuthRequest } from "../middlewares/authMiddleware.js";
import { AppError } from "../middlewares/AppError.js";
import { parseCatalogBundle, CatalogInputError, type CatalogBundle, type CatalogVariantInput, type CatalogImageInput } from "./catalogValidation.js";
import { persistCatalogBundle, readCatalogWorkspace } from "./catalogWorkspace.js";
import { catalogMutation } from "./catalogMutation.js";

export async function legacyBundle(id: string) {
  const state = await readCatalogWorkspace(id);
  return {
    product: { ...state.product, category_id: state.product.category_id ? String(state.product.category_id) : null, brand_id: state.product.brand_id ? String(state.product.brand_id) : null },
    expected_version: state.product.__v ?? 0,
    action: "save" as CatalogBundle["action"],
    variants: state.variants.map(row => ({ _id: String(row._id), expected_version: row.__v ?? 0, sku: row.sku, size: row.size, color: row.color, price: row.price, sale_price: row.sale_price, stock_quantity: row.stock_quantity, status: row.status })) as CatalogVariantInput[],
    images: state.images.map((row, index) => ({ _id: String(row._id), image_url: row.image_url, color: row.color, is_primary: index === Math.max(0, state.images.findIndex(image => image.is_primary)) })) as CatalogImageInput[],
  };
}
export async function saveLegacyBundle(req: Request, id: string | undefined, body: unknown) {
  const actor = (req as AuthRequest).user?._id;
  if (!actor) throw new AppError("Cần đăng nhập quản trị.", 401);
  let bundle: CatalogBundle;
  try { bundle = parseCatalogBundle(body); }
  catch (error) {
    if (id && error instanceof CatalogInputError && error.issues.some(issue => /bị trùng/.test(issue.message))) throw new CatalogInputError(error.issues,409);
    throw error;
  }
  const work = (session: mongoose.ClientSession) => persistCatalogBundle(bundle, actor, id, session);
  if (req.headers["idempotency-key"]) {
    const result = await catalogMutation({ actor, kind: "product", key: req.headers["idempotency-key"], body: { id, ...bundle } }, work);
    return readCatalogWorkspace(result.id);
  }
  const saved = await mongoose.connection.transaction(work);
  return readCatalogWorkspace(saved);
}
