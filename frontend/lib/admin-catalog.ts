export type CatalogOption = { _id: string; name: string; status?: boolean; parent_id?: string | { _id: string } | null };
export type CatalogProduct = { _id?: string; __v?: number; name: string; slug: string; product_code?: string; category_id: string | null; brand_id: string | null; description?: string; material?: string; care_instructions?: string; gender?: string; is_featured?: boolean; status?: boolean; publication_state?: string };
export type CatalogVariant = { key?: string; _id?: string; __v?: number; order_count?: number; sku: string; size: string; color: string; price: number | string; sale_price: number | string | null; stock_quantity: number | string; status: boolean };
export type CatalogImage = { _id?: string; image_url: string; color?: string; is_primary: boolean };
export type CatalogState = { product: CatalogProduct; variants: CatalogVariant[]; images: CatalogImage[]; inventory?: Record<string, number> };
export const slugify = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const normalize = (s: string) => s.normalize("NFKC").trim().replace(/\s+/g, " ");
export const pairKey = (size: string, color: string) => `${normalize(size).toLocaleLowerCase("vi")}\0${normalize(color).toLocaleLowerCase("vi")}`;
export const splitAttributes = (s: string) => { const values = new Map<string,string>(); for (const value of s.split(",").map(normalize).filter(Boolean)) { const key = value.toLocaleLowerCase("vi"); if (!values.has(key)) values.set(key,value); } return [...values.values()]; };
export function mergeMatrix(rows: CatalogVariant[], sizes: string[], colors: string[], code: string, price: string, stock: string) {
  const result = [...rows], pairs = new Set(rows.map(row => pairKey(row.size, row.color)));
  for (const size of sizes) for (const color of colors) {
    const key = pairKey(size, color); if (pairs.has(key)) continue;
    if (result.length >= 200) throw new Error("Tối đa 200 SKU; dữ liệu cũ được giữ nguyên.");
    pairs.add(key);
    result.push({ key: `matrix-${key}`, sku: `${code || "SP"}-${slugify(size)}-${slugify(color)}`.toUpperCase(), size, color, price, sale_price: null, stock_quantity: stock, status: true });
  }
  return result;
}
const integer = (value: unknown) => value !== "" && value !== null && Number.isSafeInteger(Number(value)) && Number(value) >= 0;
export function validateCatalog(state: CatalogState, publish: boolean) {
  const issues: Record<string, string> = {}, product = state.product;
  if (!product.name.trim()) issues["product.name"] = "Nhập tên sản phẩm.";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(product.slug)) issues["product.slug"] = "Dùng chữ thường không dấu, số và gạch nối.";
  if (product.product_code?.trim() && !/^[A-Z0-9]+(?:[-_][A-Z0-9]+)*$/i.test(product.product_code.trim())) issues["product.product_code"] = "Dùng chữ, số, dấu gạch nối hoặc gạch dưới.";
  const skus = new Set<string>(), pairs = new Set<string>();
  state.variants.forEach((row, index) => {
    const prefix = `variants.${index}`, sku = row.sku.trim().toUpperCase(), key = pairKey(row.size, row.color);
    if (!sku || skus.has(sku)) issues[`${prefix}.sku`] = "SKU bắt buộc và không được trùng.";
    if (!row.size.trim()) issues[`${prefix}.size`] = "Nhập size.";
    if (!row.color.trim() || pairs.has(key)) issues[`${prefix}.color`] = "Nhập màu, tổ hợp không được trùng.";
    skus.add(sku); pairs.add(key);
    for (const field of ["price", "stock_quantity"] as const) if (!integer(row[field])) issues[`${prefix}.${field}`] = "Nhập số nguyên không âm.";
    if (row.sale_price !== null && row.sale_price !== "" && (!integer(row.sale_price) || Number(row.sale_price) > Number(row.price))) issues[`${prefix}.sale_price`] = "Giá giảm từ 0 đến giá gốc.";
  });
  if (state.images.length && state.images.filter(image => image.is_primary).length !== 1) issues.images = "Chọn đúng một ảnh chính.";
  const colors = new Set(state.variants.map(row => normalize(row.color).toLocaleLowerCase("vi")));
  state.images.forEach((image, index) => {
    if (image.color?.trim() && !colors.has(normalize(image.color).toLocaleLowerCase("vi"))) issues[`images.${index}.color`] = "Chọn màu còn trong danh sách SKU hoặc dùng ảnh chung.";
  });
  if (publish) {
    if (!product.product_code?.trim()) issues["product.product_code"] = "Cần mã sản phẩm để xuất bản.";
    if (!product.category_id) issues["product.category_id"] = "Chọn danh mục đang hoạt động.";
    if (!product.brand_id) issues["product.brand_id"] = "Chọn thương hiệu đang hoạt động.";
    if (!state.images.length) issues.images = "Cần ít nhất một ảnh.";
    if (!state.variants.some(row => row.status)) issues.variants = "Cần ít nhất một SKU đang bán.";
  }
  return issues;
}
export function catalogPayload(state: CatalogState, action: string) {
  return { product: state.product, expected_version: state.product.__v, action,
    variants: state.variants.map(row => ({ ...row, key: undefined, __v: undefined, order_count: undefined, expected_version: row._id ? row.__v ?? 0 : undefined, price: Number(row.price), sale_price: row.sale_price === "" || row.sale_price === null ? null : Number(row.sale_price), stock_quantity: Number(row.stock_quantity) })), images: state.images };
}
export function categoryDescendants(nodes: CatalogOption[], id: string) {
  const result = new Set([id]); let changed = true;
  while (changed) { changed = false; for (const node of nodes) { const parent = typeof node.parent_id === "object" ? node.parent_id?._id : node.parent_id; if (parent && result.has(parent) && !result.has(node._id)) { result.add(node._id); changed = true; } } }
  return result;
}
