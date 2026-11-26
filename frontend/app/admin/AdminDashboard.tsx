"use client";

import { useEffect, useId, useState } from "react";
import { orderStatusText, type OrderStatus } from "@/lib/order-api";
import AdminFeedback from "./AdminFeedback";
import AdminIcon, { type AdminIconName } from "./AdminIcon";
import { queueLabels, type OrderQueue, navigate } from "./adminNavigation";
import type { AdminRequest } from "./ProductVariantsManager";

type Goods = { _id: string; name: string; quantity: number; revenue: number; stock: number; action?: string };
type Advice = { _id: string; sku: string; productName: string; size: string; color: string; stock: number; sold30: number; coverDays: number | null; suggestedQuantity: number; action: string };
type Point = { label: string; revenue: number; orders: number };
type Data = {
  queues: Record<OrderQueue, number>;
  metrics: { totalOrders: number; lowStockCount: number };
  topProducts: Goods[];
  slowProducts: Goods[];
  restockRecommendations: Advice[];
  lowStockAlerts: Advice[];
  dailyRevenue?: (Omit<Point, "label"> & { date: string })[];
  monthlyRevenue: Point[];
  ordersByStatus: Record<string, number>;
  recentOrders?: { _id: string; order_status: string; created_at: string }[];
};

const currency = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" });
const number = new Intl.NumberFormat("vi-VN");
const compact = new Intl.NumberFormat("vi-VN", { notation: "compact", maximumFractionDigits: 1 });
const recentDate = new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" });
const queueKeys = Object.keys(queueLabels) as OrderQueue[];
const workIcons: Record<OrderQueue, AdminIconName> = {
  ready: "orders", awaiting_payment: "payments", packing: "inventory", delivery_issue: "fulfillment", incoming_return: "inventory", refund_due: "refund",
};
const statusColors: Record<string, string> = {
  completed: "#15946a", shipping: "#3986d7", processing: "#d99a21", pending: "#9473d1",
  delivery_failed: "#dc5353", returning: "#d8793e", returned: "#5592a0", cancelled: "#778391",
};

const chartGroups = { day: "Ngày", week: "Tuần", month: "Tháng" } as const;
type ChartGroup = keyof typeof chartGroups;
const dayLabel = (date: string) => date.slice(8) + "/" + date.slice(5, 7);

function revenuePoints(data: Data, group: ChartGroup): Point[] {
  if (group === "month") return data.monthlyRevenue;
  const days = data.dailyRevenue ?? [];
  if (group === "day") return days.slice(-7).map(({ date, revenue, orders }) => ({ label: dayLabel(date), revenue, orders }));
  const weeks: Point[] = [];
  for (let offset = 0; offset < days.length; offset += 7) {
    const week = days.slice(offset, offset + 7);
    weeks.push({
      label: dayLabel(week[0].date) + "–" + dayLabel(week[week.length - 1].date),
      revenue: week.reduce((total, item) => total + item.revenue, 0),
      orders: week.reduce((total, item) => total + item.orders, 0),
    });
  }
  return weeks;
}

function RevenueChart({ points }: { points: Point[] }) {
  const gradient = useId();
  const [selected, setSelected] = useState<number | null>(null);
  const detail = points[selected ?? points.length - 1];
  const maximum = Math.max(0, ...points.map((point) => point.revenue));
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(maximum, 1)));
  const step = Math.max(1, Math.ceil(maximum / (4 * magnitude / 2)) * magnitude / 2);
  const top = 22;
  const baseline = 176;
  const plot = points.map((point, index) => ({
    x: 66 + index * 546 / Math.max(1, points.length - 1),
    y: baseline - point.revenue * (baseline - top) / (4 * step),
  }));
  const line = plot.map(({ x, y }, index) => (index === 0 ? "M" : "L") + x + "," + y).join(" ");
  const area = line + " L" + plot[plot.length - 1].x + "," + baseline + " H" + plot[0].x + " Z";

  return (
    <div className="admin-revenue-chart">
      <svg viewBox="0 0 644 210" preserveAspectRatio="none" aria-hidden="true">
        <defs><linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#48bf8c" stopOpacity=".53" /><stop offset="1" stopColor="#cceede" stopOpacity=".26" /></linearGradient></defs>
        {[0, 1, 2, 3, 4].map((tick) => {
          const y = baseline - tick * (baseline - top) / 4;
          return <g key={tick}><line x1="66" x2="612" y1={y} y2={y} /><text x="56" y={y + 4} textAnchor="end">{compact.format(tick * step)}</text></g>;
        })}
        <path d={area} fill={"url(#" + gradient + ")"} />
        <path d={line} className="admin-revenue-line" />
        {plot.map(({ x, y }, index) => <circle key={points[index].label} cx={x} cy={y} r={index === (selected ?? points.length - 1) ? 5 : 3} />)}
      </svg>
      <div className="admin-chart-labels" style={{ gridTemplateColumns: "repeat(" + points.length + ", minmax(0, 1fr))" }} onMouseLeave={() => setSelected(null)}>
        {points.map((point, index) => <button key={point.label} type="button" aria-label={point.label + ": " + currency.format(point.revenue) + ", " + point.orders + " đơn"} onMouseEnter={() => setSelected(index)} onFocus={() => setSelected(index)} onClick={() => setSelected(index)}>{point.label}</button>)}
      </div>
      <p className="admin-chart-caption"><span>{detail.label}</span><strong>{currency.format(detail.revenue)}</strong><span>{number.format(detail.orders)} đơn đủ điều kiện</span></p>
    </div>
  );
}

function OrderStatusChart({ counts }: { counts: Data["ordersByStatus"] }) {
  const entries = Object.entries(counts).filter(([, count]) => count > 0).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, [, count]) => sum + count, 0);
  let angle = 0;
  const slices = entries.map(([status, count]) => {
    const start = angle;
    angle += count * 100 / total;
    return (statusColors[status] ?? "#9aa5ae") + " " + start + "% " + angle + "%";
  });
  const gradient = total ? "conic-gradient(" + slices.join(", ") + ")" : "#e9efed";
  return <section className="admin-panel admin-chart-card">
    <h2>Đơn hàng theo trạng thái</h2>
    <div className="admin-status-chart">
      <div className="admin-donut" style={{ background: gradient }}>
        <div><strong>{number.format(total)}</strong><span>Đơn hàng</span></div>
      </div>
      {total > 0 ? <ul className="admin-chart-legend">{entries.map(([status, count]) => <li key={status}>
        <span className="admin-legend-dot" style={{ backgroundColor: statusColors[status] ?? "#9aa5ae" }} />
        <span>{orderStatusText[status as OrderStatus] ?? status}</span>
        <strong>{number.format(count)}</strong>
      </li>)}</ul> : <p className="admin-muted">Chưa có đơn hàng.</p>}
    </div>
  </section>;
}

function WorkList({ data, workOnly, onNavigate }: { data: Data; workOnly: boolean; onNavigate: typeof navigate }) {
  const total = queueKeys.reduce((sum, key) => sum + data.queues[key], 0);
  return <section className="admin-panel admin-dashboard-list">
    <div className="admin-card-title"><h2>Công việc cần xử lý ({number.format(total)})</h2>
      {!workOnly && <button className="admin-quiet-link" type="button" onClick={() => onNavigate("work")}>Xem tất cả <AdminIcon name="chevron" /></button>}
    </div>
    <ul className="admin-compact-list">
      {queueKeys.map((key) => <li key={key}>
        <span className={"admin-tile-icon tone-" + (key === "delivery_issue" || key === "refund_due" ? "red" : key === "incoming_return" || key === "packing" ? "amber" : "green")}><AdminIcon name={workIcons[key]} /></span>
        <strong>{queueLabels[key]}</strong><span className="admin-list-count">{number.format(data.queues[key])}</span>
        <button className="admin-inline-button" type="button" aria-label={queueLabels[key] + " · Xử lý"} onClick={() => {
          if (key === "delivery_issue" || key === "incoming_return" || key === "refund_due") onNavigate("fulfillment", { view: key });
          else onNavigate("orders", { queue: key });
        }}>Xử lý</button>
      </li>)}
    </ul>
  </section>;
}

function downloadRevenue(points: Point[]) {
  const csv = "\uFEFFKỳ,Doanh thu (VND),Số đơn đủ điều kiện\r\n" + points.map(({ label, revenue, orders }) => [label, revenue, orders].join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "VSC-BAPD-doanh-thu.csv";
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function AdminDashboard({ request, onNavigate, mode }: { request: AdminRequest; onNavigate: typeof navigate; mode: "dashboard" | "work" | "reports" }) {
  const workOnly = mode === "work";
  const reportsOnly = mode === "reports";
  const [data, setData] = useState<Data>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [group, setGroup] = useState<ChartGroup>("day");

  useEffect(() => {
    const controller = new AbortController();
    request<Data>("/admin/dashboard", { signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) { setData(result); setError(""); } })
      .catch((cause: unknown) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Không tải được tổng quan."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [request, revision]);

  function refresh() { setError(""); setLoading(true); setRevision((value) => value + 1); }
  if (!data) return <div className="admin-panel"><AdminFeedback kind={error ? "error" : "loading"} message={error || "Đang tải tổng quan…"} onRetry={error ? refresh : undefined} /></div>;

  const visibleGroup = data.dailyRevenue?.length ? group : "month";
  const points = revenuePoints(data, visibleGroup);
  const revenue = (data.dailyRevenue?.length ? data.dailyRevenue.slice(-7) : data.monthlyRevenue.slice(-1)).reduce((total, point) => total + point.revenue, 0);
  const stats = [
    { label: "Doanh thu hợp lệ", value: currency.format(revenue), note: data.dailyRevenue?.length ? "7 ngày gần nhất" : "Tháng hiện tại", icon: "revenue", tone: "green" },
    { label: "Tổng đơn hàng", value: number.format(data.metrics.totalOrders), note: "Tất cả trạng thái", icon: "orders", tone: "green" },
    { label: "Đơn đang xử lý", value: number.format(data.queues.ready + data.queues.packing), note: "Chờ xác nhận hoặc bàn giao", icon: "inventory", tone: "amber" },
    { label: "Đơn chờ hoàn tiền", value: number.format(data.queues.refund_due), note: "Cần ghi nhận đối soát", icon: "refund", tone: "red" },
  ] as const;
  const activity = data.recentOrders ?? [];

  return <div className="admin-dashboard-root" aria-busy={loading}>
    <div className={"admin-dashboard-actions" + (reportsOnly ? " admin-report-actions" : "")}>
      {reportsOnly && <button className="admin-inline-button" type="button" disabled={loading || !points.length} onClick={() => downloadRevenue(points)}><AdminIcon name="download" /> Xuất doanh thu CSV</button>}
      <button className="admin-icon-button" type="button" aria-label="Làm mới" title="Làm mới" disabled={loading} onClick={refresh}><AdminIcon name="refresh" /></button>
    </div>
    {error && <AdminFeedback kind="error" message={error} onRetry={refresh} />}
    {!workOnly && <>
      <section className="admin-metric-grid" aria-label="Kết quả kinh doanh">
        {stats.map(({ label, value, note, icon, tone }) => <div className="admin-metric-card" key={label}>
          <span className={"admin-tile-icon tone-" + tone}><AdminIcon name={icon} /></span>
          <div><span>{label}</span><strong>{value}</strong><small>{note}</small></div>
        </div>)}
      </section>
      <div className="admin-dashboard-grid admin-dashboard-charts">
        <section className="admin-panel admin-chart-card">
          <div className="admin-card-title">
            <h2>Doanh thu theo thời gian</h2>
            <div className="admin-segmented" aria-label="Độ chi tiết doanh thu">
              {(Object.keys(chartGroups) as ChartGroup[]).filter((id) => id === "month" || data.dailyRevenue?.length).map((id) => <button type="button" key={id} aria-pressed={id === visibleGroup} onClick={() => setGroup(id)}>{chartGroups[id]}</button>)}
            </div>
          </div>
          <p className="admin-muted admin-chart-note">{visibleGroup === "day" ? "7 ngày gần nhất" : visibleGroup === "week" ? "6 kỳ gần nhất, mỗi kỳ 7 ngày" : "6 tháng gần nhất"} · Theo ngày hoàn thành, giờ Việt Nam</p>
          {points.length > 0 && <RevenueChart key={visibleGroup} points={points} />}
        </section>
        <OrderStatusChart counts={data.ordersByStatus} />
      </div>
    </>}
    <div className={reportsOnly || workOnly ? undefined : "admin-dashboard-grid"}>
      {!reportsOnly && <WorkList data={data} workOnly={workOnly} onNavigate={onNavigate} />}
      {!workOnly && <section className="admin-panel admin-dashboard-list">
        <div className="admin-card-title"><h2>Sản phẩm bán chạy · 30 ngày</h2></div>
        {data.topProducts.length ? <ol className="admin-compact-list admin-ranked-list">
          {data.topProducts.slice(0, 5).map((product, index) => <li key={product._id}>
            <span className="admin-ranked-number">{index + 1}</span><span className="admin-tile-icon tone-green"><AdminIcon name="products" /></span>
            <span className="admin-list-title"><strong>{product.name}</strong><small>Đã bán {number.format(product.quantity)}</small></span>
            <strong className="admin-list-money">{currency.format(product.revenue)}</strong>
          </li>)}
        </ol> : <p className="admin-muted">Chưa có sản phẩm từ đơn đã giao và thu tiền.</p>}
      </section>}
    </div>
    {!reportsOnly && <div className={workOnly ? undefined : "admin-dashboard-grid"}>
      <section className="admin-panel admin-dashboard-list">
        <div className="admin-card-title"><h2>Cảnh báo tồn kho & gợi ý</h2><button type="button" className="admin-quiet-link" onClick={() => onNavigate("inventory")}>Mở kho <AdminIcon name="chevron" /></button></div>
        <p className="admin-stock-alert"><span className="admin-tile-icon tone-amber"><AdminIcon name="warning" /></span><strong>{number.format(data.metrics.lowStockCount)} SKU tồn từ 10 trở xuống</strong></p>
        {data.lowStockAlerts.length > 0 && <ul className="admin-compact-list">
          {data.lowStockAlerts.slice(0, 3).map((row) => <li key={row._id}><span className="admin-list-title"><strong>{row.productName}</strong><small>{row.sku}</small></span><span className="admin-list-count">{number.format(row.stock)} còn bán</span><button type="button" className="admin-inline-button" onClick={() => onNavigate("inventory", { search: row.sku })}>Xem SKU</button></li>)}
        </ul>}
      </section>
      {!workOnly && <section className="admin-panel admin-dashboard-list">
        <div className="admin-card-title"><h2>Đơn đặt gần đây</h2><button type="button" className="admin-quiet-link" onClick={() => onNavigate("orders")}>Xem tất cả <AdminIcon name="chevron" /></button></div>
        {activity.length ? <ul className="admin-compact-list admin-recent-list">{activity.slice(0, 4).map((order) => <li key={order._id}>
          <span className="admin-legend-dot" style={{ backgroundColor: statusColors[order.order_status] ?? "#778391" }} />
          <span className="admin-list-title"><button type="button" className="admin-quiet-link" onClick={() => onNavigate("orders", { search: order._id })}>Đơn #{order._id.slice(-8).toUpperCase()}</button><small>{orderStatusText[order.order_status as OrderStatus] ?? order.order_status}</small></span>
          <small>{Number.isFinite(Date.parse(order.created_at)) ? recentDate.format(new Date(order.created_at)) : "—"}</small>
        </li>)}</ul> : <p className="admin-muted">Chưa có đơn đặt gần đây.</p>}
      </section>}
    </div>}
    {!workOnly && <>
      <section className="admin-panel">
        <h2>Cần nhập thêm theo màu và size</h2>
        <p className="admin-muted">Gợi ý dựa trên đơn đã giao và thu tiền trong 30 ngày gần nhất.</p>
        <AdviceTable items={data.restockRecommendations} empty="Chưa có biến thể đạt điều kiện cần nhập thêm." />
      </section>
      <section className="admin-panel">
        <h2>Hàng bán chậm cần xử lý</h2>
        <p className="admin-muted">Sản phẩm đã lên ít nhất 30 ngày, còn tồn, bán tối đa 3 sản phẩm trong 30 ngày hoặc có lượng tồn đủ bán trên 90 ngày.</p>
        <div className="admin-table-wrap"><table className="admin-table">
          <thead><tr><th>Sản phẩm</th><th>Đã bán</th><th>Còn tồn</th><th>Hướng xử lý</th></tr></thead>
          <tbody>{data.slowProducts.map((product) => <tr key={product._id}><td><strong>{product.name}</strong></td><td>{product.quantity}</td><td>{product.stock}</td><td>{product.action}</td></tr>)}
            {!data.slowProducts.length && <tr><td colSpan={4}>Chưa có sản phẩm phù hợp.</td></tr>}</tbody>
        </table></div>
      </section>
    </>}
  </div>;
}

function AdviceTable({ items, empty }: { items: Advice[]; empty: string }) {
  return <div className="admin-table-wrap"><table className="admin-table">
    <thead><tr><th>Sản phẩm / SKU</th><th>Màu / Size</th><th>Tồn bán được</th><th>Bán 30 ngày</th><th>Còn đủ bán</th><th>Gợi ý nhập</th><th>Đề xuất</th></tr></thead>
    <tbody>{items.map((row) => <tr key={row._id}><td><strong>{row.productName}</strong><br /><button className="admin-quiet-link" type="button" onClick={() => navigate("inventory", { search: row.sku })}>{row.sku}</button></td><td>{row.color} / {row.size}</td><td>{row.stock}</td><td>{row.sold30}</td><td>{row.coverDays === null ? "Chưa đủ dữ liệu" : row.coverDays + " ngày"}</td><td>{row.suggestedQuantity || "—"}</td><td>{row.action}</td></tr>)}
      {!items.length && <tr><td colSpan={7}>{empty}</td></tr>}</tbody>
  </table></div>;
}
