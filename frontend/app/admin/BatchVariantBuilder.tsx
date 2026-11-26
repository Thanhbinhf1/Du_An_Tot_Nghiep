"use client";
import { useState, type FormEvent } from "react";
import type { AdminRequest } from "./ProductVariantsManager";
import { getColorSwatch } from "@/lib/product-colors";
import { resolveProductImage } from "@/lib/api";

type Variant = { _id: string; sku: string; size: string; color: string; price: number; sale_price: number | null; stock_quantity: number; status: boolean; __v?: number };
type Row = Omit<Variant, "_id" | "__v"> & { selected: boolean };
type Color = { name: string; image_url: string };
const key = (size: string, color: string) => size.trim().toLocaleLowerCase("vi") + "|" + color.trim().toLocaleLowerCase("vi");
const code = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "");
export default function BatchVariantBuilder({ productId, productSlug, existing, request, onSaved }: { productId: string; productSlug: string; existing: Variant[]; request: AdminRequest; onSaved: (rows: Variant[], image?: string) => void }) {
  const [sizes, setSizes] = useState("S, M, L, XL");
  const [colors, setColors] = useState<Color[]>([{ name: "Đen", image_url: "" }]);
  const [prefix, setPrefix] = useState(code(productSlug).slice(0, 30));
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("0");
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [uploading, setUploading] = useState<number>();
  const [open, setOpen] = useState(true);
  function generate(e: FormEvent) {
    e.preventDefault(); setError(""); setNotice("");
    const sizeList = [...new Set(sizes.split(/[,;\n]+/).map((s) => s.trim().toUpperCase()).filter(Boolean))];
    const cleanColors = colors.map((c) => ({ ...c, name: c.name.trim() }));
    if (!sizeList.length || sizeList.length > 20 || cleanColors.some((c) => !c.name) || new Set(cleanColors.map((c) => c.name.toLocaleLowerCase("vi"))).size !== cleanColors.length || cleanColors.length * sizeList.length > 200 || !prefix.trim()) { setError("Nhập các size cách nhau bằng dấu phẩy và màu không trùng; tối đa 200 tổ hợp, cần tiền tố SKU."); return; }
    const amount = Number(price), qty = Number(stock);
    if (!price.trim() || !stock.trim() || !Number.isSafeInteger(amount) || amount < 0 || !Number.isSafeInteger(qty) || qty < 0) { setError("Giá và tồn phải là số nguyên không âm."); return; }
    const saved = new Set(existing.map((v) => key(v.size, v.color)));
    setRows(cleanColors.flatMap((c) => sizeList.map((size) => ({ sku: code(prefix) + "-" + code(c.name) + "-" + code(size), size, color: c.name, price: amount, sale_price: null, stock_quantity: qty, status: true, selected: !saved.has(key(size, c.name)) }))));
    setColors(cleanColors);
  }
  function update(i: number, patch: Partial<Row>) { setRows((current) => current.map((row, index) => index === i ? { ...row, ...patch } : row)); }
  async function upload(index: number, file?: File) {
    if (!file) return; setUploading(index); setError("");
    try { const body = new FormData(); body.set("image", file); const result = await request<{ url: string }>("/admin/uploads", { method: "POST", body }); setColors((list) => list.map((c, i) => i === index ? { ...c, image_url: result.url } : c)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Không tải được ảnh màu."); }
    finally { setUploading(undefined); }
  }
  async function save() {
    if (busy || uploading !== undefined) return; setError(""); setNotice("");
    const selected = rows.filter((row) => row.selected);
    if (!selected.length) { setError("Chọn ít nhất một tổ hợp chưa có."); return; }
    if (new Set(selected.map((row) => row.sku.trim().toUpperCase())).size !== selected.length) { setError("SKU đang bị trùng. Sửa SKU trong bảng trước khi lưu."); return; }
    setBusy(true);
    try {
      const created = await request<Variant[]>("/products/" + productId + "/variants/batch", { method: "POST", body: JSON.stringify({ variants: selected.map((row) => ({ sku: row.sku, size: row.size, color: row.color, price: row.price, sale_price: row.sale_price, stock_quantity: row.stock_quantity, status: row.status })), color_images: colors.filter((c) => c.image_url.trim() && selected.some((row) => row.color === c.name)).map((c) => ({ color: c.name, image_url: c.image_url.trim() })) }) });
      setRows([]); setNotice("Đã lưu " + created.length + " biến thể cùng ảnh theo màu."); onSaved(created, colors.find((c) => c.image_url.trim())?.image_url);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể lưu bảng biến thể."); }
    finally { setBusy(false); }
  }
  return <section className="admin-batch-builder"><div className="admin-toolbar"><div><h3>Tạo nhanh màu × kích cỡ</h3><p className="admin-muted">Ảnh dùng chung cho các size cùng màu. SKU, giá và tồn riêng cho từng tổ hợp; dòng đã có sẽ không được thêm lại.</p></div><button type="button" onClick={() => setOpen(!open)}>{open ? "Thu gọn" : "Mở bảng tạo nhanh"}</button></div>
    {open && <><form onSubmit={generate}><fieldset disabled={busy || uploading !== undefined} className="admin-form variant-fieldset"><legend>1. Chọn size và màu</legend><label>Các kích cỡ<input value={sizes} onChange={(e) => { setSizes(e.target.value); setRows([]); }} placeholder="XS, S, M, L, XL" required/></label><label>Tiền tố SKU<input value={prefix} onChange={(e) => { setPrefix(e.target.value); setRows([]); }} maxLength={60} required/></label><label>Giá gốc chung (VND)<input type="number" min={0} step={1} required value={price} onChange={(e) => { setPrice(e.target.value); setRows([]); }}/></label><label>Tồn khởi tạo mỗi tổ hợp<input type="number" min={0} step={1} required value={stock} onChange={(e) => { setStock(e.target.value); setRows([]); }}/></label>
      <div className="wide">{colors.map((color, i) => <div key={i} className="admin-color-row"><label>Tên màu {i + 1}<input value={color.name} required maxLength={60} onChange={(e) => { setColors((list) => list.map((c, index) => index === i ? { ...c, name: e.target.value } : c)); setRows([]); }}/></label><span className="admin-color-dot" style={{ backgroundColor: getColorSwatch(color.name) ?? "#ddd" }}/><label>Ảnh màu {i + 1}<input value={color.image_url} onChange={(e) => setColors((list) => list.map((c, index) => index === i ? { ...c, image_url: e.target.value } : c))} placeholder="Link ảnh hoặc tải tệp"/></label><label>Tải ảnh màu {i + 1}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => void upload(i, e.target.files?.[0])}/></label>{color.image_url && <img className="admin-image-thumb" src={resolveProductImage(color.image_url)} alt={color.name}/>}<button type="button" disabled={colors.length === 1} onClick={() => { setColors((list) => list.filter((_, index) => index !== i)); setRows([]); }}>Bỏ màu</button></div>)}</div>
      <div className="admin-actions wide"><button type="button" disabled={colors.length >= 20} onClick={() => { setColors((list) => [...list, { name: "", image_url: "" }]); setRows([]); }}>Thêm màu</button><button className="admin-button">2. Tạo bảng để kiểm tra</button></div></fieldset></form>
      {uploading !== undefined && <p role="status">Đang tải ảnh màu…</p>}{error && <p role="alert" className="admin-alert">{error}</p>}{notice && <p role="status" className="admin-success">{notice}</p>}
      {rows.length > 0 && <><h4>Kiểm tra giá và tồn từng size trước khi lưu</h4><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Chọn</th><th>Màu / Size</th><th>SKU</th><th>Giá gốc</th><th>Giá giảm (trống = không giảm)</th><th>Tồn</th></tr></thead><tbody>{rows.map((row, i) => { const exists = existing.some((v) => key(v.size, v.color) === key(row.size, row.color)); return <tr key={key(row.size, row.color)}><td><input aria-label={"Chọn " + row.color + " " + row.size} type="checkbox" disabled={exists || busy} checked={row.selected && !exists} onChange={(e) => update(i, { selected: e.target.checked })}/>{exists && <small>Đã có</small>}</td><td>{row.color} / {row.size}</td><td><input aria-label={"SKU " + row.color + " " + row.size} value={row.sku} disabled={exists || busy} onChange={(e) => update(i, { sku: e.target.value })}/></td><td><input aria-label={"Giá " + row.color + " " + row.size} type="number" min={0} step={1} disabled={exists || busy} value={row.price} onChange={(e) => update(i, { price: Number(e.target.value) })}/></td><td><input aria-label={"Giá giảm " + row.color + " " + row.size} type="number" min={0} max={row.price} step={1} disabled={exists || busy} value={row.sale_price ?? ""} onChange={(e) => update(i, { sale_price: e.target.value === "" ? null : Number(e.target.value) })}/></td><td><input aria-label={"Tồn " + row.color + " " + row.size} type="number" min={0} step={1} disabled={exists || busy} value={row.stock_quantity} onChange={(e) => update(i, { stock_quantity: Number(e.target.value) })}/></td></tr>; })}</tbody></table></div><button type="button" className="admin-button" disabled={busy || uploading !== undefined} onClick={() => void save()}>{busy ? "Đang lưu…" : "3. Lưu " + rows.filter((row) => row.selected).length + " biến thể"}</button></>}
    </>}
  </section>;
}
