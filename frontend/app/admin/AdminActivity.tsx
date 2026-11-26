import { useEffect, useState } from "react";
import { orderStatusText, type OrderStatus } from "@/lib/order-api";
import AdminFeedback from "./AdminFeedback";
import AdminIcon from "./AdminIcon";
import { navigate } from "./adminNavigation";
import type { AdminRequest } from "./ProductVariantsManager";

type Activity = { id: string; actor?: string; at?: string };
type OrderActivity = Activity & { orderId: string; action: OrderStatus };
type StockActivity = Activity & { sku?: string; action: "return_inspection" | "quarantine_release" | "quarantine_disposal" | "adjustment" | "initial_stock"; stockDelta: number; quarantineDelta: number };
type ActivityData = { orders: OrderActivity[]; inventory: StockActivity[] };
const stockActions: Record<StockActivity["action"], string> = {
  return_inspection: "Kiểm hàng hoàn",
  quarantine_release: "Giải phóng cách ly",
  quarantine_disposal: "Xuất bỏ hàng cách ly",
  adjustment: "Điều chỉnh tồn kho",
  initial_stock: "Ghi nhận tồn ban đầu",
};
const filters = { all: "Tất cả", orders: "Đơn hàng", inventory: "Kho" } as const;
type Filter = keyof typeof filters;
const dateTime = new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" });
const sign = (value: number) => value > 0 ? "+" + value : String(value);

export default function AdminActivity({ request }: { request: AdminRequest }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [data, setData] = useState<ActivityData>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    request<ActivityData>("/admin/activity", { signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) setData(result); })
      .catch((cause: unknown) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Không tải được nhật ký."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [request, revision]);

  function refresh() { setLoading(true); setError(""); setRevision((value) => value + 1); }
  const orders = (data?.orders ?? []).map((item) => ({ ...item, kind: "orders" as const }));
  const inventory = (data?.inventory ?? []).map((item) => ({ ...item, kind: "inventory" as const }));
  const rows = [...orders, ...inventory].filter((item) => filter === "all" || filter === item.kind)
    .sort((a, b) => (Date.parse(b.at ?? "") || 0) - (Date.parse(a.at ?? "") || 0) || b.id.localeCompare(a.id))
    .slice(0, 50);

  return <section className="admin-panel">
    <div className="admin-toolbar"><p className="admin-muted">50 bản ghi gần nhất theo bộ lọc, lấy từ lịch sử trạng thái đơn và biến động từng SKU.</p>
      <button className="admin-icon-button" type="button" disabled={loading} onClick={refresh} aria-label="Làm mới nhật ký" title="Làm mới nhật ký"><AdminIcon name="refresh" /></button>
    </div>
    <div className="admin-order-tabs" aria-label="Nguồn nhật ký">
      {(Object.keys(filters) as Filter[]).map((id) => <button type="button" className={"order-tab-btn" + (id === filter ? " active" : "")} key={id}
        aria-pressed={id === filter} onClick={() => setFilter(id)}>{filters[id]}</button>)}
    </div>
    <div className="admin-table-wrap" role="region" aria-label="Bảng nhật ký hoạt động" tabIndex={0}>
      <table className="admin-table admin-activity-table">
        <thead><tr><th>Thời gian (giờ Việt Nam)</th><th>Người thực hiện</th><th>Nghiệp vụ</th><th>Đối tượng</th><th>Kết quả ghi nhận</th></tr></thead>
        <tbody>
          {loading || error || !rows.length ? <tr><td colSpan={5}><AdminFeedback kind={loading ? "loading" : error ? "error" : "empty"}
            message={loading ? "Đang tải nhật ký…" : error || "Chưa có bản ghi phù hợp."} onRetry={error ? refresh : undefined} /></td></tr> : rows.map((item) => {
            const date = Date.parse(item.at ?? "");
            return <tr key={item.kind + item.id}>
              <td>{Number.isFinite(date) ? <time dateTime={item.at}>{dateTime.format(date)}</time> : "—"}</td>
              <td>{item.actor || "Hệ thống / không rõ"}</td>
              <td><span className={"admin-data-pill tone-" + (item.kind === "orders" ? "blue" : "green")}>{filters[item.kind]}</span></td>
              <td>{item.kind === "orders"
                ? <button type="button" className="admin-quiet-link" onClick={() => navigate("orders", { search: item.orderId })}>#{item.orderId.slice(-8).toUpperCase()}</button>
                : item.sku ? <button type="button" className="admin-quiet-link" onClick={() => navigate("inventory", { search: item.sku! })}>{item.sku}</button> : "—"}</td>
              <td>{item.kind === "orders" ? orderStatusText[item.action] ?? item.action : <>
                {stockActions[item.action] ?? item.action}
                <br /><small>Chưa phân bổ {sign(item.stockDelta)} · Cách ly {sign(item.quarantineDelta)}</small>
              </>}</td>
            </tr>;
          })}
        </tbody>
      </table>
    </div>
  </section>;
}
