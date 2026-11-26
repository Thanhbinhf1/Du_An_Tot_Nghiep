import mongoose, { type ClientSession, type Types } from "mongoose";
import Product from "../models/productModel.js";
import Variant from "../models/productVariantModel.js";
import Image from "../models/productImageModel.js";
import Brand from "../models/brandModel.js";
import Detail from "../models/orderDetailModel.js";
import Order from "../models/orderModel.js";
import Movement from "../models/inventoryMovementModel.js";
import { AppError } from "../middlewares/AppError.js";
import { assertCategoryReference } from "./categoryPolicy.js";
import { lockCategoryTree } from "./catalogMutation.js";
import { CatalogInputError, normalizeAttribute, publicationIssues, type CatalogBundle } from "./catalogValidation.js";

export async function readCatalogWorkspace(id: Types.ObjectId | string) {
  const product = await Product.findById(id).lean();
  if (!product) throw new AppError("Không tìm thấy sản phẩm.", 404);
  const [variants, images] = await Promise.all([Variant.find({ product_id: id }).sort({ _id: 1 }).lean(), Image.find({ product_id: id }).sort({ display_order: 1, _id: 1 }).lean()]);
  const ids = variants.map((row) => row._id);
  const [usage, groups, disposal] = ids.length ? await Promise.all([
    Detail.aggregate<{ _id: Types.ObjectId; count: number }>([{ $match: { product_variant_id: { $in: ids } } }, { $group: { _id: "$product_variant_id", count: { $sum: 1 } } }]),
    Detail.aggregate<{ _id: string; quantity: number }>([{ $match: { product_variant_id: { $in: ids } } }, { $lookup: { from: Order.collection.name, localField: "order_id", foreignField: "_id", as: "order" } }, { $unwind: "$order" }, { $group: { _id: "$order.order_status", quantity: { $sum: "$quantity" } } }]),
    Movement.aggregate<{ _id: null; quantity: number }>([{ $match: { variant_id: { $in: ids }, kind: "quarantine_disposal" } }, { $group: { _id: null, quantity: { $sum: { $multiply: ["$quarantine_delta", -1] } } } }]),
  ]) : [[], [], []];
  const counts = new Map(usage.map((row) => [String(row._id), row.count]));
  const quantities = new Map(groups.map((row) => [row._id, row.quantity]));
  const unallocated = variants.reduce((sum, row) => sum + row.stock_quantity, 0);
  const quarantine = variants.reduce((sum, row) => sum + (row.quarantine_quantity ?? 0), 0);
  const held = (quantities.get("pending") ?? 0) + (quantities.get("processing") ?? 0);
  return {
    product, variants: variants.map((row) => ({ ...row, order_count: counts.get(String(row._id)) ?? 0 })), images,
    inventory: { unallocated, sellable: product.status ? variants.filter((row) => row.status).reduce((sum, row) => sum + row.stock_quantity, 0) : 0, held, in_transit: (quantities.get("shipping") ?? 0) + (quantities.get("delivery_failed") ?? 0), awaiting_return: quantities.get("returning") ?? 0, quarantine, on_hand: unallocated + quarantine + held, disposed_lifetime: disposal[0]?.quantity ?? 0 },
  };
}

export async function persistCatalogBundle(bundle: CatalogBundle, actor: Types.ObjectId, id: string | undefined, session: ClientSession) {
  await lockCategoryTree(session);
  let product = id ? await Product.findById(id).session(session) : null;
  if (id && !product) throw new AppError("Không tìm thấy sản phẩm.", 404);
  if (id && (bundle.expected_version === undefined || bundle.expected_version !== (product!.get("__v") ?? 0))) throw new AppError("Sản phẩm vừa được sửa. Giữ bản nháp và tải lại để đối chiếu trước khi lưu.", 409);
  if (!id && bundle.action === "save") throw new AppError("Sản phẩm mới cần lưu nháp hoặc xuất bản có xác nhận.", 400);
  const wasLegacy = !!product && product.publication_state === undefined;
  const wasPublished = product?.status === true;
  const published = bundle.action === "publish" || (bundle.action === "save" && wasPublished);
  const enforcePublication = published && (bundle.action === "publish" || !wasLegacy);
  const issues = enforcePublication ? publicationIssues(bundle) : [];
  if (issues.length) throw new CatalogInputError(issues);
  const categoryChanged = String(product?.category_id ?? "") !== String(bundle.product.category_id ?? "");
  if (bundle.product.category_id) await assertCategoryReference(bundle.product.category_id, session, published && (bundle.action === "publish" || categoryChanged));
  if (bundle.product.brand_id) {
    const brand = await Brand.findById(bundle.product.brand_id).session(session).lean();
    if (!brand) throw new AppError("Thương hiệu không tồn tại.", 404);
    if (published && (bundle.action === "publish" || String(product?.brand_id ?? "") !== bundle.product.brand_id) && !brand.status) throw new AppError("Chọn thương hiệu đang hoạt động trước khi xuất bản/phân loại mới.", 409);
  }
  const unique = await Product.exists({ ...(product ? { _id: { $ne: product._id } } : {}), $or: [{ slug: bundle.product.slug }, ...(bundle.product.product_code ? [{ product_code: bundle.product.product_code }] : [])] }).session(session);
  if (unique) throw new AppError("Mã sản phẩm hoặc slug đã được sử dụng.", 409);
  const publication = bundle.action === "publish" ? "published" : bundle.action === "draft" ? "draft" : bundle.action === "hide" ? "hidden" : product?.publication_state;
  const values = { ...bundle.product, category_id: bundle.product.category_id ? new mongoose.Types.ObjectId(bundle.product.category_id) : null, brand_id: bundle.product.brand_id ? new mongoose.Types.ObjectId(bundle.product.brand_id) : null, status: published, publication_state: publication };
  if (!product) product = new Product(values);
  else { product.set(values); if (!bundle.product.product_code) product.set("product_code", undefined); product.increment(); }
  await product.save({ session }); // Locks this product against every variant/image editor in this transaction.
  const current = await Variant.find({ product_id: product._id }).sort({ _id: 1 }).session(session);
  const byId = new Map(current.map((row) => [String(row._id), row]));
  const submitted = new Set(bundle.variants.flatMap((row) => row._id ? [row._id] : []));
  if (current.some((row) => !submitted.has(String(row._id)))) throw new AppError("Không được bỏ dòng SKU đã lưu. Chuyển sang ngừng bán để giữ dữ liệu đơn hàng.", 409);
  const used = new Set((await Detail.find({ product_variant_id: { $in: current.map((row) => row._id) } }).select("product_variant_id").session(session).lean()).map((row) => String(row.product_variant_id)));
  const sizeNames = new Map<string, string>(), colorNames = new Map<string, string>();
  const canonicalName = (names: Map<string, string>, value: string) => {
    const normalized = normalizeAttribute(value), key = normalized.toLocaleLowerCase("vi");
    if (!names.has(key)) names.set(key, normalized);
    return names.get(key)!;
  };
  // Reuse existing labels for new/explicitly changed identities; never rename historical rows implicitly.
  for (const row of current) { canonicalName(sizeNames, row.size); canonicalName(colorNames, row.color); }
  const canonicalInput = <T extends { size: string; color: string }>(input: T): T => ({ ...input, size: canonicalName(sizeNames, input.size), color: canonicalName(colorNames, input.color) });
  for (const [index, row] of bundle.variants.entries()) {
    const skuConflict = await Variant.exists({ sku: { $regex: `^${row.sku.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" }, ...(row._id ? { _id: { $ne: row._id } } : {}) }).session(session);
    if (skuConflict) throw new CatalogInputError([{ path: `variants.${index}.sku`, message: "SKU đã được sử dụng." }], 409);
    const { _id, expected_version, stock_quantity, ...input } = row;
    if (_id) {
      const stored = byId.get(_id);
      if (!stored) throw new AppError("Có SKU không thuộc sản phẩm hoặc đã thay đổi.", 409);
      if (expected_version !== (stored.get("__v") ?? 0)) throw new AppError(`SKU ${stored.sku} vừa có thay đổi kho/giá. Tải lại trước khi lưu.`, 409);
      if (stock_quantity !== undefined && stock_quantity !== stored.stock_quantity) throw new CatalogInputError([{ path: `variants.${index}.stock_quantity`, message: "Điều chỉnh tồn của SKU đã có tại Quản lý tồn kho kèm chứng từ." }]);
      if (used.has(_id) && (input.sku !== stored.sku || input.size !== stored.size || input.color !== stored.color)) throw new CatalogInputError([{ path: `variants.${index}.sku`, message: "SKU có lịch sử đơn: giữ định danh/size/màu; ngừng bán và tạo SKU mới nếu đổi thuộc tính." }]);
      stored.set(input.size !== stored.size || input.color !== stored.color ? canonicalInput(input) : input); await stored.save({ session });
    } else {
      const created = await Variant.create([{ ...canonicalInput(input), product_id: product._id, stock_quantity: stock_quantity ?? 0 }], { session });
      const variant = created[0]!;
      await Movement.create([{ variant_id: variant._id, actor_id: actor, kind: "initial_stock", stock_delta: variant.stock_quantity, quarantine_delta: 0, note: "Tồn đầu khi khởi tạo SKU trong workspace sản phẩm." }], { session });
    }
  }
  const previousImages = await Image.find({ product_id: product._id }).session(session).lean();
  const imageIds = new Set<string>();
  for (const image of bundle.images) if (image._id) {
    if (imageIds.has(image._id) || !previousImages.some((row) => String(row._id) === image._id)) throw new AppError("ID ảnh bị trùng hoặc không thuộc sản phẩm.", 409);
    imageIds.add(image._id);
  }
  await Image.deleteMany({ product_id: product._id, _id: { $nin: [...imageIds].map((id) => new mongoose.Types.ObjectId(id)) } }, { session });
  for (const [index, image] of bundle.images.entries()) {
    const previous = image._id ? previousImages.find(row => String(row._id) === image._id) : undefined;
    const color = image.color ? previous?.color === image.color ? image.color : canonicalName(colorNames, image.color) : undefined;
    const values = { product_id: product._id, image_url: image.image_url, ...(color ? { color } : {}), is_primary: image.is_primary, display_order: index + 1 };
    if (image._id) await Image.updateOne({ _id: image._id, product_id: product._id }, { $set: { ...values, color: color ?? "" } }, { session, runValidators: true });
    else await Image.create([values], { session });
  }
  return product._id;
}
