import { useEffect, useRef, useState, type FormEvent } from "react";
import AdminFeedback from "./AdminFeedback";
import AdminIcon from "./AdminIcon";
import AdminPagination from "./AdminPagination";
import CatalogDialog from "./CatalogDialog";
import type { AdminRequest } from "./ProductVariantsManager";

type Coupon = {
  _id: string;
  code: string;
  discount_type: "percent" | "fixed";
  discount_value: number;
  min_order_value: number;
  max_discount?: number | null;
  usage_limit: number;
  used_count: number;
  start_date: string;
  end_date: string;
  status: boolean;
};

const blank = {
  code: "", discount_type: "percent" as Coupon["discount_type"], discount_value: "",
  min_order_value: "0", max_discount: "", usage_limit: "100", start_date: "", end_date: "", status: true,
};

const couponStates = {
  active: { label: "Đang áp dụng", tone: "green" },
  upcoming: { label: "Sắp bắt đầu", tone: "blue" },
  expired: { label: "Đã hết hạn", tone: "neutral" },
  exhausted: { label: "Hết lượt", tone: "amber" },
  disabled: { label: "Đã tắt", tone: "neutral" },
} as const;
type CouponState = keyof typeof couponStates;
const money = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" });
const dateTime = new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" });
const dateInput = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});
const dateLabel = (value: string) => Number.isFinite(Date.parse(value)) ? dateTime.format(new Date(value)) : "—";
const inputValue = (value: string) => Number.isFinite(Date.parse(value)) ? dateInput.format(new Date(value)).replace(" ", "T") : "";

function couponState(coupon: Coupon, now: number): CouponState {
  if (!coupon.status) return "disabled";
  if (Date.parse(coupon.end_date) < now) return "expired";
  if (Date.parse(coupon.start_date) > now) return "upcoming";
  return coupon.used_count >= coupon.usage_limit ? "exhausted" : "active";
}

export default function AdminCoupons({ request, isAdmin }: { request: AdminRequest; isAdmin: boolean }) {
  const [list, setList] = useState<{ rows: Coupon[]; loadedAt: number }>();
  const [revision, setRevision] = useState(0);
  const [editor, setEditor] = useState<Coupon | "new">();
  const [confirmDelete, setConfirmDelete] = useState<Coupon>();
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [state, setState] = useState("all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [discountType, setDiscountType] = useState<Coupon["discount_type"]>("percent");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const writing = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    request<Coupon[]>("/admin/coupons", { signal: controller.signal })
      .then((rows) => {
        if (controller.signal.aborted) return;
        setList({ rows, loadedAt: Date.now() });
        setLoadError("");
      })
      .catch((cause: unknown) => { if (!controller.signal.aborted) setLoadError(cause instanceof Error ? cause.message : "Không tải được mã giảm giá."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [request, revision]);

  function refresh() { setLoading(true); setLoadError(""); setRevision((value) => value + 1); }
  function open(item: Coupon | "new") {
    setEditor(item);
    setDiscountType(item === "new" ? "percent" : item.discount_type);
    setActionError("");
    setNotice("");
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor || writing.current) return;
    const form = new FormData(event.currentTarget);
    const end = new Date(String(form.get("end_date")) + "+07:00");
    const start = new Date(String(form.get("start_date")) + "+07:00");
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start >= end) {
      setActionError("Thời gian kết thúc phải sau thời gian bắt đầu.");
      return;
    }
    const max = form.get("max_discount");
    const payload = {
      code: String(form.get("code")).trim().toUpperCase(), discount_type: discountType,
      discount_value: Number(form.get("discount_value")), min_order_value: Number(form.get("min_order_value")),
      max_discount: max ? Number(max) : null, usage_limit: Number(form.get("usage_limit")),
      start_date: start.toISOString(), end_date: end.toISOString(), status: form.get("status") === "on",
    };
    writing.current = true;
    setBusy(true); setActionError("");
    try {
      await request(editor === "new" ? "/admin/coupons" : "/admin/coupons/" + editor._id, {
        method: editor === "new" ? "POST" : "PUT", body: JSON.stringify(payload),
      });
      setNotice(editor === "new" ? "Đã tạo mã giảm giá." : "Đã cập nhật mã giảm giá.");
      setEditor(undefined);
      setPage(1);
      refresh();
    } catch (cause) { setActionError(cause instanceof Error ? cause.message : "Không thể lưu mã."); }
    finally { writing.current = false; setBusy(false); }
  }
  async function remove() {
    if (!isAdmin || !confirmDelete || writing.current) return;
    writing.current = true;
    setBusy(true); setActionError("");
    try {
      await request("/admin/coupons/" + confirmDelete._id, { method: "DELETE" });
      window.dispatchEvent(new Event("fstyle-catalog-change"));
      setNotice("Đã xóa mã " + confirmDelete.code + ".");
      setConfirmDelete(undefined);
      refresh();
    } catch (cause) { setActionError(cause instanceof Error ? cause.message : "Không thể xóa mã."); }
    finally { writing.current = false; setBusy(false); }
  }

  const rows = list?.rows.map((coupon) => ({ coupon, state: couponState(coupon, list.loadedAt) })) ?? [];
  const shown = rows.filter((item) => item.coupon.code.includes(search.trim().toUpperCase())
    && (state === "all" || item.state === state) && (type === "all" || item.coupon.discount_type === type));
  const totalPages = Math.max(1, Math.ceil(shown.length / limit));
  const visiblePage = Math.min(page, totalPages);
  const form = editor && editor !== "new" ? {
    ...editor,
    start_date: inputValue(editor.start_date), end_date: inputValue(editor.end_date),
  } : blank;
  const stats = [
    { label: "Tổng số mã", value: rows.length, icon: "coupons", tone: "green" },
    { label: "Đang áp dụng", value: rows.filter((item) => item.state === "active").length, icon: "work", tone: "green" },
    { label: "Sắp bắt đầu", value: rows.filter((item) => item.state === "upcoming").length, icon: "history", tone: "blue" },
    { label: "Tổng lượt đã dùng", value: rows.reduce((total, item) => total + (item.coupon.used_count ?? 0), 0), icon: "reports", tone: "amber" },
  ] as const;

  return <>
    <div className="admin-adminlist-header">
      <p className="admin-muted">Theo dõi chương trình, điều kiện áp dụng và lượt sử dụng.</p>
      <button className="admin-button admin-inline-icon" type="button" onClick={() => open("new")}><AdminIcon name="plus" /> Tạo mã giảm giá</button>
    </div>
    <section className="admin-metric-grid" aria-label="Thống kê mã giảm giá">
      {stats.map(({ label, value, icon, tone }) => <div className="admin-metric-card" key={label}>
        <span className={"admin-tile-icon tone-" + tone}><AdminIcon name={icon} /></span>
        <span><span>{label}</span><strong>{loading || loadError ? "—" : value.toLocaleString("vi-VN")}</strong></span>
      </div>)}
    </section>
    <section className="admin-panel">
      <div className="admin-card-title"><h2>Danh sách mã giảm giá</h2><button type="button" className="admin-icon-button" aria-label="Làm mới mã giảm giá" disabled={loading || busy} onClick={refresh}><AdminIcon name="refresh" /></button></div>
      {notice && <AdminFeedback kind="success" message={notice} />}
      <div className="admin-order-tabs admin-coupon-tabs" aria-label="Trạng thái mã giảm giá">
        {[["all", "Tất cả"], ...Object.entries(couponStates).map(([id, entry]) => [id, entry.label])].map(([id, label]) => <button
          type="button" key={id} className={"order-tab-btn" + (state === id ? " active" : "")} aria-pressed={state === id}
          onClick={() => { setState(id); setPage(1); }}>{label}</button>)}
      </div>
      <div className="admin-filter-bar">
        <label className="admin-list-search">Tìm theo mã<input value={search} maxLength={100} placeholder="VD: FSTYLE10" onChange={(event) => { setSearch(event.target.value); setPage(1); }} /></label>
        <label>Loại ưu đãi<select value={type} onChange={(event) => { setType(event.target.value); setPage(1); }}>
          <option value="all">Tất cả</option><option value="percent">Phần trăm</option><option value="fixed">Giảm cố định</option>
        </select></label>
      </div>
      <div className="admin-table-wrap" role="region" aria-label="Bảng mã giảm giá" tabIndex={0}>
        <table className="admin-table admin-coupon-table">
          <thead><tr><th>Mã</th><th>Mức giảm</th><th>Điều kiện</th><th>Đã dùng / Giới hạn</th><th>Thời hạn (giờ Việt Nam)</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
          <tbody>
            {loading || loadError || !shown.length ? <tr><td colSpan={7}>
              <AdminFeedback kind={loading ? "loading" : loadError ? "error" : "empty"} message={loading ? "Đang tải mã giảm giá…" : loadError || "Không có mã khớp bộ lọc."} onRetry={loadError ? refresh : undefined} />
            </td></tr> : shown.slice((visiblePage - 1) * limit, visiblePage * limit).map(({ coupon, state: status }) => <tr key={coupon._id}>
              <td><strong>{coupon.code}</strong></td>
              <td>{coupon.discount_type === "percent" ? coupon.discount_value + "%" : money.format(coupon.discount_value)}</td>
              <td>Đơn từ {money.format(coupon.min_order_value)}{coupon.max_discount != null && <small><br />Tối đa {money.format(coupon.max_discount)}</small>}</td>
              <td>{coupon.used_count ?? 0} / {coupon.usage_limit}</td>
              <td>{dateLabel(coupon.start_date)}<br /><small>Đến {dateLabel(coupon.end_date)}</small></td>
              <td><span className={"admin-data-pill tone-" + couponStates[status].tone}>{couponStates[status].label}</span></td>
              <td><div className="admin-actions">
                <button type="button" disabled={busy} onClick={() => open(coupon)} aria-label={"Sửa " + coupon.code}>Sửa</button>
                {isAdmin && !coupon.used_count && <button type="button" className="danger-btn" disabled={busy} onClick={() => { setActionError(""); setNotice(""); setConfirmDelete(coupon); }} aria-label={"Xóa " + coupon.code}>Xóa</button>}
              </div></td>
            </tr>)}
          </tbody>
        </table>
      </div>
      {!loadError && <AdminPagination page={visiblePage} pagination={{ total: shown.length, totalPages, limit }} loading={loading} onPage={setPage} onLimit={(value) => { setLimit(value); setPage(1); }} />}
    </section>
    {editor && <CatalogDialog title={editor === "new" ? "Tạo mã giảm giá" : "Cập nhật mã giảm giá"} close={() => { if (!busy) setEditor(undefined); }}>
      {actionError && <p className="admin-alert" role="alert">{actionError}</p>}
      <form onSubmit={save}>
        <fieldset className="admin-form variant-fieldset" disabled={busy}>
          <label>Mã giảm giá<input required name="code" maxLength={100} defaultValue={form.code} placeholder="VD: FSTYLE10" /></label>
          <label>Loại ưu đãi<select value={discountType} onChange={(event) => setDiscountType(event.target.value as Coupon["discount_type"])}><option value="percent">Phần trăm</option><option value="fixed">Số tiền cố định</option></select></label>
          <label>Giá trị giảm<input name="discount_value" required min={0} max={discountType === "percent" ? 100 : undefined} type="number" step="any" defaultValue={form.discount_value} /></label>
          <label>Giá trị đơn tối thiểu<input name="min_order_value" required min={0} type="number" step="any" defaultValue={form.min_order_value} /></label>
          <label>Mức giảm tối đa<input name="max_discount" min={0} type="number" step="any" defaultValue={form.max_discount ?? ""} /></label>
          <label>Giới hạn sử dụng<input name="usage_limit" required min={editor === "new" ? 1 : Math.max(1, editor.used_count || 0)} type="number" defaultValue={form.usage_limit} /></label>
          <label>Bắt đầu<input name="start_date" type="datetime-local" required defaultValue={form.start_date} /></label>
          <label>Kết thúc<input name="end_date" type="datetime-local" required defaultValue={form.end_date} /></label>
          <p className="admin-muted wide">Thời gian áp dụng theo giờ Việt Nam.</p>
          <label className="admin-coupon-toggle wide"><input name="status" type="checkbox" defaultChecked={form.status} /> Kích hoạt mã sau khi lưu</label>
        </fieldset>
        <div className="admin-actions"><button className="primary" disabled={busy}>{busy ? "Đang lưu…" : editor === "new" ? "Tạo mã" : "Lưu thay đổi"}</button><button type="button" disabled={busy} onClick={() => setEditor(undefined)}>Hủy</button></div>
      </form>
    </CatalogDialog>}
    {confirmDelete && <CatalogDialog title={"Xóa mã " + confirmDelete.code + "?"} close={() => { if (!busy) setConfirmDelete(undefined); }}>
      <p>Mã sẽ bị xóa khỏi danh sách ưu đãi.</p>
      {actionError && <p className="admin-alert" role="alert">{actionError}</p>}
      <div className="admin-actions"><button type="button" disabled={busy} onClick={() => setConfirmDelete(undefined)}>Hủy</button><button type="button" className="danger" disabled={busy} onClick={() => void remove()}>{busy ? "Đang xóa…" : "Xác nhận xóa"}</button></div>
    </CatalogDialog>}
  </>;
}
