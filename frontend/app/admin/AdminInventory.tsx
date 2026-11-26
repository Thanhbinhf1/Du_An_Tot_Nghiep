"use client";

import { useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import { resolveProductImage, type ApiPagination } from "@/lib/api";
import type { CatalogOption } from "@/lib/admin-catalog";
import AdminFeedback from "./AdminFeedback";
import AdminIcon from "./AdminIcon";
import AdminPagination, { adminListPath } from "./AdminPagination";
import CatalogDialog from "./CatalogDialog";
import type { AdminPaginatedRequest, AdminRequest } from "./ProductVariantsManager";

type Variant = {
  _id: string; sku: string; size: string; color: string; stock_quantity: number; quarantine_quantity?: number;
  held_quantity?: number; __v?: number; status: boolean; sold30: number; suggestedQuantity: number;
  product_id?: { name: string; status: boolean } | null; image?: string;
};
type Movement = { _id: string; stock_delta: number; quarantine_delta: number; note: string; actor_id?: { name: string }; created_at: string };
type Mode = "add" | "set" | "release" | "dispose";
type StockDialog = { kind: "adjust"; variant: Variant; mode: Mode } | { kind: "history"; variant: Variant };
const inventoryFilters = [
  { id: "all", label: "Tất cả", summary: "Tổng SKU", icon: "inventory", tone: "green" },
  { id: "in_stock", label: "Tồn trên 10", summary: "Tồn trên 10", icon: "products", tone: "green" },
  { id: "low", label: "Tồn thấp", summary: "Tồn thấp", icon: "warning", tone: "amber" },
  { id: "out", label: "Hết hàng", summary: "Hết hàng", icon: "inventory", tone: "red" },
  { id: "quarantine", label: "Cách ly", summary: "SKU có hàng cách ly", icon: "work", tone: "blue" },
] as const;
const modes = { add: "Nhập thêm hàng nguyên vẹn", set: "Kiểm kê · Đặt lại tồn chưa phân bổ", release: "Đã kiểm đạt · Chuyển cách ly sang tồn chưa phân bổ", dispose: "Thanh lý / hủy · Xuất khỏi kho cách ly" } as const;
const dateTime = new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" });

function variantStatus(variant: Variant) {
  if (!variant.status || !variant.product_id?.status) return { label: "Ngừng bán", tone: "neutral" };
  if (variant.stock_quantity === 0) return { label: "Hết hàng", tone: "red" };
  if (variant.stock_quantity <= 10) return { label: "Tồn thấp", tone: "amber" };
  return { label: "Đang bán", tone: "green" };
}

export default function AdminInventory({ request, paginatedRequest, isAdmin, initialSearch }: {
  initialSearch: string; request: AdminRequest; paginatedRequest: AdminPaginatedRequest; isAdmin: boolean;
}) {
  const [variants, setVariants] = useState<Variant[]>([]);
  const [categories, setCategories] = useState<CatalogOption[]>([]);
  const [search, setSearch] = useState(initialSearch);
  const [bucket, setBucket] = useState<(typeof inventoryFilters)[number]["id"]>("all");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [pagination, setPagination] = useState<ApiPagination>();
  const [revision, setRevision] = useState(0);
  const [dialog, setDialog] = useState<StockDialog>();
  const [movements, setMovements] = useState<Movement[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [listError, setListError] = useState("");
  const [categoryError, setCategoryError] = useState("");
  const [dialogError, setDialogError] = useState("");
  const [notice, setNotice] = useState("");
  const historyId = dialog?.kind === "history" ? dialog.variant._id : undefined;

  useEffect(() => {
    const controller = new AbortController();
    request<CatalogOption[]>("/categories?all=true", { signal: controller.signal })
      .then((rows) => { if (!controller.signal.aborted) { setCategories(rows); setCategoryError(""); } })
      .catch(() => { if (!controller.signal.aborted) setCategoryError("Không tải được danh mục. Bạn vẫn có thể tìm theo SKU hoặc tên."); });
    return () => controller.abort();
  }, [request, revision]);

  useEffect(() => {
    const controller = new AbortController();
    const path = adminListPath("/admin/inventory", { page, limit, bucket, category_id: category, search: search.trim() });
    paginatedRequest<Variant[]>(path, { signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return;
        setVariants(result.data);
        setPagination(result.pagination);
        if (!result.data.length && page > 1) setPage(Math.max(1, result.pagination?.totalPages ?? 1));
      })
      .catch((cause: unknown) => { if (!controller.signal.aborted) setListError(cause instanceof Error ? cause.message : "Không tải được kho."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [paginatedRequest, page, limit, search, bucket, category, revision]);

  useEffect(() => {
    if (!historyId) return;
    const controller = new AbortController();
    request<Movement[]>("/admin/inventory/" + historyId + "/history", { signal: controller.signal })
      .then((rows) => { if (!controller.signal.aborted) setMovements(rows); })
      .catch((cause: unknown) => { if (!controller.signal.aborted) setDialogError(cause instanceof Error ? cause.message : "Không tải được lịch sử kho."); })
      .finally(() => { if (!controller.signal.aborted) setHistoryLoading(false); });
    return () => controller.abort();
  }, [historyId, request]);

  function startLoading() { setListError(""); setLoading(true); }
  function refresh() { startLoading(); setRevision((value) => value + 1); }
  function changeBucket(value: typeof bucket) {
    if (value === bucket) return;
    setBucket(value); setPage(1); startLoading();
  }
  function openDialog(next: StockDialog) {
    setDialogError("");
    setNotice("");
    if (next.kind === "history" && historyId !== next.variant._id) { setMovements([]); setHistoryLoading(true); }
    setDialog(next);
  }
  function openFirst(kind: Mode | "history") {
    if (!variants[0]) return;
    openDialog(kind === "history" ? { kind: "history", variant: variants[0] } : { kind: "adjust", variant: variants[0], mode: kind });
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (dialog?.kind !== "adjust" || busy) return;
    const form = new FormData(event.currentTarget);
    const { variant, mode } = dialog;
    const quarantine = mode === "release" || mode === "dispose";
    setBusy(true); setDialogError("");
    try {
      await request("/admin/inventory/" + variant._id + (quarantine ? "/quarantine" : "/adjustment"), {
        method: "POST",
        body: JSON.stringify({ ...(quarantine ? { action: mode } : { mode }), quantity: Number(form.get("quantity")), expected_version: variant.__v ?? 0, note: form.get("note") }),
      });
      setDialog(undefined);
      setNotice("Đã cập nhật và lưu chứng từ kho.");
      refresh();
    } catch (cause: unknown) {
      setDialogError(cause instanceof Error ? cause.message : "Không thể cập nhật kho.");
    } finally { setBusy(false); }
  }

  const canOpen = !loading && !listError && variants.length > 0;
  const historyMode = dialog?.kind === "history";
  const skuOptions = dialog ? variants.filter((variant) => dialog.kind === "history"
    || (dialog.mode !== "release" && dialog.mode !== "dispose") || (variant.quarantine_quantity ?? 0) > 0) : [];

  return <div className="admin-inventory-page">
    <div className="admin-adminlist-header">
      <p className="admin-muted">Theo dõi tồn chưa phân bổ, hàng giữ cho đơn và hàng cách ly theo từng SKU.</p>
      <div className="admin-action-row">
        <button className="admin-button" type="button" disabled={!canOpen} onClick={() => openFirst("add")}><AdminIcon name="plus" /> Nhập kho</button>
        <button className="admin-inline-button" type="button" disabled={!canOpen} onClick={() => openFirst("set")}><AdminIcon name="work" /> Kiểm kê</button>
        <button className="admin-inline-button" type="button" disabled={!canOpen} onClick={() => openFirst("history")}><AdminIcon name="history" /> Lịch sử kho</button>
        <button className="admin-icon-button" type="button" aria-label="Làm mới kho" title="Làm mới kho" disabled={loading} onClick={refresh}><AdminIcon name="refresh" /></button>
      </div>
    </div>
    <section className="admin-metric-grid admin-metric-grid-five" aria-label="Thống kê tồn kho">
      {inventoryFilters.map(({ id, summary, icon, tone }) => <button className="admin-metric-card" type="button" key={id} aria-pressed={bucket === id} onClick={() => changeBucket(id)}>
        <span className={"admin-tile-icon tone-" + tone}><AdminIcon name={icon} /></span>
        <span><span>{summary}</span><strong>{loading || listError ? "—" : (pagination?.statusCounts?.[id]?.toLocaleString("vi-VN") ?? "—")}</strong></span>
      </button>)}
    </section>
    <section className="admin-panel">
      {categoryError && <p className="admin-alert" role="alert">{categoryError}</p>}
      {notice && <p className="admin-success" role="status">{notice}</p>}
      <div className="admin-order-tabs" aria-label="Lọc theo lượng tồn">
        {inventoryFilters.map(({ id, label }) => <button type="button" className={"order-tab-btn" + (id === bucket ? " active" : "")} aria-pressed={id === bucket} key={id} onClick={() => changeBucket(id)}>{label}</button>)}
      </div>
      <div className="admin-filter-bar">
        <label className="admin-list-search">Tìm trong kho<input value={search} placeholder="Tên sản phẩm, SKU, size, màu…" maxLength={100} onChange={(event) => { setSearch(event.target.value); setPage(1); startLoading(); }} /></label>
        <label>Danh mục<select value={category} onChange={(event) => { setCategory(event.target.value); setPage(1); startLoading(); }}>
          <option value="">Tất cả danh mục</option>
          {categories.map((item) => <option value={item._id} key={item._id}>{item.name}</option>)}
        </select></label>
      </div>
      <div className="admin-table-wrap" role="region" aria-label="Bảng tồn kho" tabIndex={0}>
        <table className="admin-table admin-inventory-table">
          <thead><tr><th>Sản phẩm / SKU</th><th>Size</th><th>Màu</th><th>Tồn thực tế</th><th>Đang giữ</th><th>Chưa phân bổ</th><th>Cách ly</th><th>Bán 30 ngày</th><th>Gợi ý nhập</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
          <tbody>
            {loading || listError || !variants.length ? <tr><td colSpan={11}><AdminFeedback kind={loading ? "loading" : listError ? "error" : "empty"} message={loading ? "Đang tải tồn kho…" : listError || "Không có biến thể phù hợp."} onRetry={!loading && listError ? refresh : undefined} /></td></tr> : variants.map((variant) => {
              const state = variantStatus(variant);
              const held = variant.held_quantity;
              const quarantine = variant.quarantine_quantity ?? 0;
              return <tr key={variant._id}>
                <td><div className="admin-table-product">
                  {variant.image ? <Image src={resolveProductImage(variant.image)} alt="" width={36} height={40} unoptimized /> : <span className="admin-tile-icon tone-neutral"><AdminIcon name="products" /></span>}
                  <span><strong>{variant.product_id?.name ?? "Sản phẩm không còn"}</strong><small>{variant.sku}</small></span>
                </div></td>
                <td>{variant.size}</td><td>{variant.color}</td><td>{held === undefined ? "—" : variant.stock_quantity + held + quarantine}</td><td>{held ?? "—"}</td>
                <td><strong>{variant.stock_quantity}</strong></td><td>{quarantine}</td><td>{variant.sold30 ?? 0}</td><td>{variant.suggestedQuantity || "—"}</td>
                <td><span className={"admin-data-pill tone-" + state.tone}>{state.label}</span></td>
                <td><div className="admin-actions admin-inventory-actions">
                  <button type="button" onClick={() => openDialog({ kind: "adjust", variant, mode: "add" })}>Cập nhật</button>
                  <button type="button" aria-label={"Lịch sử kho " + variant.sku} title="Lịch sử kho" onClick={() => openDialog({ kind: "history", variant })}><AdminIcon name="history" /></button>
                </div></td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
      {!listError && <AdminPagination page={page} pagination={{ ...pagination, totalPages: pagination?.totalPages ?? 1, limit }} loading={loading} onPage={(value) => { setPage(value); startLoading(); }} onLimit={(value) => { setLimit(value); setPage(1); startLoading(); }} />}
    </section>
    {dialog && <CatalogDialog title={historyMode ? "Lịch sử kho" : "Cập nhật kho"} close={() => { if (!busy) setDialog(undefined); }}>
      <label className="admin-stack">SKU trên trang hiện tại
        <select disabled={busy} value={dialog.variant._id} onChange={(event) => {
          const variant = variants.find((item) => item._id === event.target.value);
          if (variant) openDialog({ ...dialog, variant });
        }}>
          {skuOptions.map((item) => <option key={item._id} value={item._id}>{item.sku} · {item.product_id?.name}</option>)}
        </select>
      </label>
      {dialogError && <p className="admin-alert" role="alert">{dialogError}</p>}
      {dialog.kind === "adjust" ? <form key={dialog.variant._id} onSubmit={save}>
        <p className="admin-muted">Chưa phân bổ {dialog.variant.stock_quantity} · Cách ly {dialog.variant.quarantine_quantity ?? 0}</p>
        <label className="admin-stack">Nghiệp vụ<select disabled={busy} name="action" value={dialog.mode} onChange={(event) => setDialog({ ...dialog, mode: event.target.value as Mode })}>
          <option value="add">{modes.add}</option><option value="set">{modes.set}</option>
          {isAdmin && (dialog.variant.quarantine_quantity ?? 0) > 0 && <><option value="release">{modes.release}</option><option value="dispose">{modes.dispose}</option></>}
        </select></label>
        <label className="admin-stack">Số lượng<input name="quantity" type="number" required disabled={busy} min={dialog.mode === "set" ? 0 : 1} step={1} max={Number.MAX_SAFE_INTEGER} /></label>
        <label className="admin-stack">Chứng từ / kết quả kiểm tra / lý do<textarea name="note" required disabled={busy} maxLength={1000} /></label>
        <div className="admin-actions"><button className="primary" disabled={busy}>Lưu nghiệp vụ kho</button><button type="button" disabled={busy} onClick={() => setDialog(undefined)}>Đóng</button></div>
      </form> : <>
        <p className="admin-muted">50 nghiệp vụ nhập, kiểm kê và hàng hoàn gần nhất của SKU. Biến động đặt/hủy đơn nằm trong lịch sử đơn.</p>
        {historyLoading ? <p role="status">Đang tải lịch sử kho…</p> : !dialogError && (movements.length ? movements.map((movement) => <article className="admin-history-card" key={movement._id}>
          <strong>{movement.note}</strong><p>Tồn chưa phân bổ {movement.stock_delta > 0 ? "+" : ""}{movement.stock_delta} · Cách ly {movement.quarantine_delta > 0 ? "+" : ""}{movement.quarantine_delta}</p>
          <small>{movement.actor_id?.name} · {dateTime.format(new Date(movement.created_at))}</small>
        </article>) : <p>Chưa có nhật ký kho mới.</p>)}
      </>}
    </CatalogDialog>}
  </div>;
}
