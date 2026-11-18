"use client";

import { useCallback, useEffect, useState } from "react";
import type { AdminRequest } from "./ProductVariantsManager";

type Customer = {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  role: "customer" | "staff" | "admin";
  is_blocked: boolean;
  auth_provider: "local" | "google";
  createdAt: string;
  orderCount: number;
  totalSpent: number;
};

export default function AdminCustomers({
  request,
  currentUserRole,
}: {
  request: AdminRequest;
  currentUserRole?: string;
}) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [newRole, setNewRole] = useState<"customer" | "staff" | "admin">("customer");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const isAdmin = currentUserRole === "admin";
  const formatPrice = (val: number) =>
    `${new Intl.NumberFormat("vi-VN").format(val)} đ`;

  const fetchCustomers = useCallback((signal?: AbortSignal) =>
    request<Customer[]>(`/admin/customers?search=${encodeURIComponent(query)}&role=${roleFilter === "all" ? "" : roleFilter}`, { signal })
      .then((data) => {
        if (signal?.aborted) return;
        setCustomers(data);
        setError("");
      })
      .catch((cause: unknown) => {
        if (!signal?.aborted) setError(cause instanceof Error ? cause.message : "Không thể tải danh sách khách hàng.");
      })
      .finally(() => { if (!signal?.aborted) setLoading(false); }),
  [request, query, roleFilter]);

  useEffect(() => {
    const controller = new AbortController();
    void fetchCustomers(controller.signal);
    return () => controller.abort();
  }, [fetchCustomers]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    if (query === search.trim()) void fetchCustomers();
    else setQuery(search.trim());
  };

  const handleUpdateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer || busy || !isAdmin) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await request(`/admin/customers/${selectedCustomer._id}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role: newRole }),
      });
      setSuccess(`Đã cập nhật vai trò của "${selectedCustomer.name}" thành ${newRole}.`);
      setSelectedCustomer(null);
      await fetchCustomers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cập nhật phân quyền thất bại.");
    } finally {
      setBusy(false);
    }
  };

  const handleToggleBlock = async (customer: Customer) => {
    if (!isAdmin || busy) return;
    const actionName = customer.is_blocked ? "mở khóa" : "khóa";
    if (!window.confirm(`Bạn có chắc muốn ${actionName} tài khoản "${customer.email}"?`)) {
      return;
    }
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await request(`/admin/customers/${customer._id}/block`, {
        method: "PATCH",
      });
      setSuccess(`Đã ${actionName} tài khoản thành công.`);
      await fetchCustomers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Thao tác khóa/mở khóa thất bại.");
    } finally {
      setBusy(false);
    }
  };

  const roleLabels: Record<string, { label: string; className: string }> = {
    customer: { label: "Khách hàng", className: "role-customer" },
    staff: { label: "Nhân viên", className: "role-staff" },
    admin: { label: "Quản trị viên", className: "role-admin" },
  };

  return (
    <div className="admin-customers-page">
      <div className="admin-panel">
        <div className="admin-toolbar">
          <div>
            <h2>Quản lý khách hàng & Phân quyền tài khoản</h2>
            <p className="admin-muted">
              Xem hồ sơ mua sắm, tích lũy chi tiêu và điều chỉnh quyền truy cập hệ thống ({customers.length} tài khoản).
            </p>
          </div>
          <button
            type="button"
            className="admin-button"
            onClick={() => { setLoading(true); void fetchCustomers(); }}
            disabled={loading || busy}
          >
            {loading ? "Đang tải..." : "🔄 Làm mới danh sách"}
          </button>
        </div>

        {error && <p className="admin-alert">{error}</p>}
        {success && <p className="admin-success">{success}</p>}

        {/* Staff note if not admin */}
        {!isAdmin && (
          <p className="admin-muted" style={{ padding: "8px 12px", background: "#f3f4f6", borderRadius: "6px" }}>
            ℹ️ Bạn đang đăng nhập với vai trò <strong>Nhân viên (Staff)</strong>. Các thao tác nâng/hạ quyền và khóa tài khoản chỉ dành cho Quản trị viên (Admin).
          </p>
        )}

        {/* FILTERS BAR */}
        <div className="admin-filter-bar">
          <form onSubmit={handleSearchSubmit} className="admin-search-form">
            <input
              type="text"
              placeholder="Tìm theo tên, email, số điện thoại..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="admin-search-input"
            />
            <button type="submit" className="admin-button secondary-btn">
              Tìm
            </button>
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setLoading(true);
                  if (query) setQuery("");
                  else void fetchCustomers();
                }}
              >
                Xóa
              </button>
            )}
          </form>

          <div className="filter-select-group">
            <label>Vai trò:</label>
            <select
              value={roleFilter}
              onChange={(e) => { setLoading(true); setRoleFilter(e.target.value); }}
              className="admin-select"
            >
              <option value="all">Tất cả vai trò</option>
              <option value="customer">Khách hàng</option>
              <option value="staff">Nhân viên (Staff)</option>
              <option value="admin">Quản trị viên (Admin)</option>
            </select>
          </div>
        </div>

        {/* CUSTOMERS TABLE */}
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Họ tên</th>
                <th>Email / SĐT</th>
                <th>Hình thức đăng nhập</th>
                <th style={{ textAlign: "center" }}>Số đơn</th>
                <th style={{ textAlign: "right" }}>Tổng chi tiêu</th>
                <th style={{ textAlign: "center" }}>Vai trò</th>
                <th style={{ textAlign: "center" }}>Trạng thái</th>
                <th>Ngày tạo</th>
                {isAdmin && <th style={{ textAlign: "right" }}>Thao tác</th>}
              </tr>
            </thead>
            <tbody>
              {customers.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 9 : 8} className="admin-empty">
                    {loading ? "Đang tải dữ liệu khách hàng..." : "Không tìm thấy tài khoản nào."}
                  </td>
                </tr>
              ) : (
                customers.map((c) => {
                  const roleMeta = roleLabels[c.role] ?? {
                    label: c.role,
                    className: "role-customer",
                  };
                  return (
                    <tr key={c._id}>
                      <td>
                        <strong>{c.name}</strong>
                      </td>
                      <td>
                        {c.email}
                        {c.phone && (
                          <>
                            <br />
                            <small className="admin-muted">📞 {c.phone}</small>
                          </>
                        )}
                      </td>
                      <td>
                        <span className="auth-provider-chip">
                          {c.auth_provider === "google" ? "Google" : "Email & Password"}
                        </span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span className="badge-highlight">{c.orderCount} đơn</span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <strong>{formatPrice(c.totalSpent)}</strong>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span className={`role-badge ${roleMeta.className}`}>
                          {roleMeta.label}
                        </span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span
                          className={`account-status-badge ${c.is_blocked ? "blocked" : "active"}`}
                        >
                          {c.is_blocked ? "Đã khóa" : "Hoạt động"}
                        </span>
                      </td>
                      <td>
                        <small>{new Date(c.createdAt).toLocaleDateString("vi-VN")}</small>
                      </td>
                      {isAdmin && (
                        <td style={{ textAlign: "right" }}>
                          <div className="admin-actions" style={{ justifyContent: "flex-end" }}>
                            <button
                              type="button"
                              className="secondary-btn"
                              onClick={() => {
                                setSelectedCustomer(c);
                                setNewRole(c.role);
                              }}
                            >
                              Phân quyền
                            </button>
                            <button
                              type="button"
                              className={c.is_blocked ? "admin-button" : "danger-btn"}
                              onClick={() => void handleToggleBlock(c)}
                            >
                              {c.is_blocked ? "Mở khóa" : "Khóa"}
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ROLE ASSIGNMENT MODAL */}
      {selectedCustomer && (
        <div className="admin-modal-backdrop" onClick={() => setSelectedCustomer(null)}>
          <div
            className="admin-modal small-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>Phân quyền tài khoản</h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => setSelectedCustomer(null)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleUpdateRole}>
              <div className="modal-body">
                <p>
                  Thay đổi quyền hạn cho: <strong>{selectedCustomer.name}</strong> ({selectedCustomer.email})
                </p>

                <div style={{ margin: "16px 0" }}>
                  <label style={{ display: "block", marginBottom: "6px" }}>
                    Chọn vai trò mới:
                  </label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as Customer["role"])}
                    className="admin-select"
                    style={{ width: "100%", padding: "10px" }}
                  >
                    <option value="customer">Khách hàng (customer) - Mua sắm và xem đơn cá nhân</option>
                    <option value="staff">Nhân viên (staff) - Quản lý sản phẩm, đơn hàng, kho</option>
                    <option value="admin">Quản trị viên (admin) - Toàn quyền cấu hình và nhân sự</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="submit" className="admin-button" disabled={busy}>
                  {busy ? "Đang lưu..." : "Lưu vai trò"}
                </button>
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => setSelectedCustomer(null)}
                >
                  Hủy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
