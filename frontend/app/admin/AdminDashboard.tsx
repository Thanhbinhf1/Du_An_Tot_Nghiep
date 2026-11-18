"use client";

import { useEffect, useState } from "react";
import AdminIcon from "./AdminIcon";
import type { AdminRequest } from "./ProductVariantsManager";

type DashboardMetrics = {
  totalRevenue: number;
  totalOrders: number;
  pendingOrders: number;
  totalProducts: number;
  totalCustomers: number;
  lowStockCount: number;
};

type MonthlyPoint = {
  label: string;
  revenue: number;
  orders: number;
};

type TopProduct = {
  name: string;
  quantity: number;
  revenue: number;
};

type LowStockAlert = {
  _id: string;
  sku: string;
  size: string;
  color: string;
  stock: number;
  productName: string;
};

type RecentOrder = {
  _id: string;
  receiver_name: string;
  receiver_phone: string;
  final_amount: number;
  order_status: string;
  payment_method: string;
  created_at: string;
};

type DashboardData = {
  metrics: DashboardMetrics;
  ordersByStatus: Record<string, number>;
  monthlyRevenue: MonthlyPoint[];
  topProducts: TopProduct[];
  lowStockAlerts: LowStockAlert[];
  recentOrders: RecentOrder[];
};

export default function AdminDashboard({
  request,
  onNavigate,
}: {
  request: AdminRequest;
  onNavigate: (tab: string) => void;
}) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const formatPrice = (value: number) =>
    `${new Intl.NumberFormat("vi-VN").format(value)} ₫`;

  useEffect(() => {
    let active = true;
    request<DashboardData>("/admin/dashboard")
      .then((res) => {
        if (active) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : "Không thể tải số liệu thống kê.");
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [request]);

  if (loading) {
    return (
      <div className="admin-overview" role="status" aria-label="Đang tải tổng quan">
        {Array.from({ length: 5 }, (_, index) => (
          <div className="admin-stat-card skeleton-box" key={index} aria-hidden="true" />
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="admin-panel">
        <p className="admin-alert">{error || "Không có dữ liệu tổng quan."}</p>
      </div>
    );
  }

  const { metrics, ordersByStatus, monthlyRevenue, topProducts, lowStockAlerts, recentOrders } = data;
  const maxMonthlyRevenue = Math.max(...monthlyRevenue.map((m) => m.revenue), 1000000);

  const statusLabels: Record<string, { label: string; color: string }> = {
    pending: { label: "Chờ xác nhận", color: "#aa7635" },
    processing: { label: "Đang xử lý", color: "#57758d" },
    shipping: { label: "Đang giao", color: "#7e6392" },
    completed: { label: "Hoàn thành", color: "#4a805d" },
    cancelled: { label: "Đã hủy", color: "#a94654" },
  };

  return (
    <div className="admin-dashboard-root">
      {/* 1. KPI TOP METRICS */}
      <div className="admin-overview" aria-label="Chỉ số hoạt động F.Style">
        <article className="admin-stat-card primary">
          <span className="admin-stat-icon"><AdminIcon name="revenue" /></span>
          <div>
            <p>Tổng doanh thu thực</p>
            <strong>{formatPrice(metrics.totalRevenue)}</strong>
            <small>Đơn hoàn thành & thanh toán</small>
          </div>
        </article>

        <article className="admin-stat-card">
          <span className="admin-stat-icon admin-stat-icon-red"><AdminIcon name="orders" /></span>
          <div>
            <p>Tổng đơn hàng</p>
            <strong>{metrics.totalOrders}</strong>
            <small>{metrics.pendingOrders} đơn mới chờ duyệt</small>
          </div>
        </article>

        <article className="admin-stat-card">
          <span className="admin-stat-icon"><AdminIcon name="products" /></span>
          <div>
            <p>Sản phẩm Catalog</p>
            <strong>{metrics.totalProducts}</strong>
            <small>Đang kinh doanh</small>
          </div>
        </article>

        <article className="admin-stat-card">
          <span className="admin-stat-icon"><AdminIcon name="customers" /></span>
          <div>
            <p>Khách hàng</p>
            <strong>{metrics.totalCustomers}</strong>
            <small>Tài khoản mua sắm</small>
          </div>
        </article>

        <button
          type="button"
          className={`admin-stat-card admin-stock-link ${metrics.lowStockCount > 0 ? "warning-card" : ""}`}
          onClick={() => onNavigate("inventory")}
        >
          <span className="admin-stat-icon"><AdminIcon name="warning" /></span>
          <div>
            <p>Cảnh báo tồn kho</p>
            <strong style={{ color: metrics.lowStockCount > 0 ? "#dc2626" : undefined }}>
              {metrics.lowStockCount} SKU
            </strong>
            <small>Tồn kho ≤ 10 sản phẩm</small>
          </div>
        </button>
      </div>

      {/* 2. CHARTS & ORDER STATUS SECTION */}
      <div className="admin-chart-grid">
        {/* Doanh thu theo tháng */}
        <div className="admin-panel chart-box">
          <div className="admin-panel-heading">
            <div>
              <h2>Biểu đồ doanh thu (6 tháng gần nhất)</h2>
              <p>Doanh thu từ các đơn hàng giao thành công hoặc đã thanh toán.</p>
            </div>
          </div>
          <div className="admin-bar-chart">
            {monthlyRevenue.map((item, idx) => {
              const heightPercent = Math.round((item.revenue / maxMonthlyRevenue) * 100);
              return (
                <div key={idx} className="chart-bar-group">
                  <div className="chart-bar-value">{formatPrice(item.revenue)}</div>
                  <div className="chart-bar-track">
                    <div
                      className="chart-bar-fill"
                      style={{ height: `${heightPercent}%` }}
                      title={`${item.label}: ${formatPrice(item.revenue)} (${item.orders} đơn)`}
                    />
                  </div>
                  <div className="chart-bar-label">{item.label}</div>
                  <small className="chart-bar-orders">{item.orders} đơn</small>
                </div>
              );
            })}
          </div>
        </div>

        {/* Tỷ lệ đơn hàng theo trạng thái */}
        <div className="admin-panel status-breakdown-box">
          <div className="admin-panel-heading">
            <div>
              <h2>Trạng thái đơn hàng</h2>
              <p>Phân bố {metrics.totalOrders} đơn theo quy trình xử lý.</p>
            </div>
          </div>
          <div className="status-progress-list">
            {Object.entries(ordersByStatus).map(([stKey, count]) => {
              const meta = statusLabels[stKey] ?? {
                label: stKey,
                color: "#6b7280",
              };
              const percent = metrics.totalOrders > 0 ? Math.round((count / metrics.totalOrders) * 100) : 0;
              return (
                <div key={stKey} className="status-item">
                  <div className="status-item-header">
                    <span>
                      <i aria-hidden="true" style={{ backgroundColor: meta.color }} />
                      <strong>{meta.label}</strong>
                    </span>
                    <span>
                      <strong>{count}</strong> đơn ({percent}%)
                    </span>
                  </div>
                  <div className="status-bar-track">
                    <div
                      className="status-bar-fill"
                      style={{ width: `${percent}%`, backgroundColor: meta.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: "18px" }}>
            <button
              type="button"
              className="admin-button"
              style={{ width: "100%" }}
              onClick={() => onNavigate("orders")}
            >
              Xem chi tiết toàn bộ đơn hàng →
            </button>
          </div>
        </div>
      </div>

      {/* 3. TOP PRODUCTS & LOW STOCK ALERTS */}
      <div className="admin-chart-grid" style={{ marginTop: "24px" }}>
        {/* Top 5 sản phẩm bán chạy */}
        <div className="admin-panel">
          <div className="admin-panel-heading">
            <div>
              <h2>🔥 Top sản phẩm bán chạy</h2>
              <p>Xếp theo tổng số lượng bán ra trên hệ thống.</p>
            </div>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Top</th>
                  <th>Tên sản phẩm</th>
                  <th style={{ textAlign: "right" }}>Đã bán</th>
                  <th style={{ textAlign: "right" }}>Doanh thu mang lại</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="admin-empty">
                      Chưa có đơn hàng phát sinh doanh số.
                    </td>
                  </tr>
                ) : (
                  topProducts.map((prod, idx) => (
                    <tr key={idx}>
                      <td>
                        <span className={`rank-badge rank-${idx + 1}`}>#{idx + 1}</span>
                      </td>
                      <td>
                        <strong>{prod.name}</strong>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <span className="badge-highlight">{prod.quantity} cái</span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <strong>{formatPrice(prod.revenue)}</strong>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Cảnh báo tồn kho */}
        <div className="admin-panel">
          <div className="admin-panel-heading">
            <div>
              <h2>⚠️ Cảnh báo tồn kho sắp hết</h2>
              <p>Các phân loại có số lượng tồn kho còn ít hơn hoặc bằng 10 cái.</p>
            </div>
            <button
              type="button"
              className="admin-button secondary-btn"
              onClick={() => onNavigate("inventory")}
            >
              Quản lý kho
            </button>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Sản phẩm / Biến thể</th>
                  <th style={{ textAlign: "center" }}>Tồn kho</th>
                  <th style={{ textAlign: "right" }}>Tình trạng</th>
                </tr>
              </thead>
              <tbody>
                {lowStockAlerts.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="admin-empty" style={{ color: "#10b981" }}>
                      ✅ Tồn kho dồi dào, không có SKU nào dưới 10 sản phẩm.
                    </td>
                  </tr>
                ) : (
                  lowStockAlerts.map((item) => (
                    <tr key={item._id}>
                      <td>
                        <code>{item.sku}</code>
                      </td>
                      <td>
                        <strong>{item.productName}</strong>
                        <br />
                        <small>
                          Size: {item.size} · Màu: {item.color}
                        </small>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <strong
                          style={{
                            color: item.stock === 0 ? "#dc2626" : "#f59e0b",
                            fontSize: "15px",
                          }}
                        >
                          {item.stock}
                        </strong>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <span
                          className={`stock-badge ${item.stock === 0 ? "out-of-stock" : "low-stock"}`}
                        >
                          {item.stock === 0 ? "Hết hàng" : "Sắp hết"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 4. RECENT ORDERS TABLE */}
      <div className="admin-panel" style={{ marginTop: "24px" }}>
        <div className="admin-panel-heading">
          <div>
            <h2>📋 Đơn hàng mới nhất cần theo dõi</h2>
            <p>Các giao dịch khách hàng vừa thực hiện.</p>
          </div>
          <button
            type="button"
            className="admin-button"
            onClick={() => onNavigate("orders")}
          >
            Quản lý đơn hàng →
          </button>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Mã đơn</th>
                <th>Khách nhận</th>
                <th>Điện thoại</th>
                <th>Thanh toán</th>
                <th>Tổng tiền</th>
                <th>Trạng thái</th>
                <th>Thời gian</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="admin-empty">
                    Chưa có đơn hàng nào được ghi nhận.
                  </td>
                </tr>
              ) : (
                recentOrders.map((ord) => (
                  <tr key={ord._id}>
                    <td>
                      <strong>#{ord._id.slice(-8).toUpperCase()}</strong>
                    </td>
                    <td>{ord.receiver_name}</td>
                    <td>{ord.receiver_phone}</td>
                    <td>{ord.payment_method}</td>
                    <td>
                      <strong>{formatPrice(ord.final_amount)}</strong>
                    </td>
                    <td>
                      <span className={`status-pill status-${ord.order_status}`}>
                        {ord.order_status}
                      </span>
                    </td>
                    <td>
                      <small>{new Date(ord.created_at).toLocaleString("vi-VN")}</small>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
