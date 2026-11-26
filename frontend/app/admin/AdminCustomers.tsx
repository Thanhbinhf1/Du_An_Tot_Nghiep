"use client";
import { useEffect, useState, type FormEvent } from "react";
import type { AdminRequest, AdminPaginatedRequest } from "./ProductVariantsManager";
import type { ApiPagination } from "@/lib/api";
import { orderStatusText, paymentStatusText } from "@/lib/order-api";
import type { FullAdminOrder } from "./OrderInvoiceModal";
import AdminPagination, { adminListPath } from "./AdminPagination";
import AdminFeedback from "./AdminFeedback";
import AdminIcon from "./AdminIcon";
import CatalogDialog from "./CatalogDialog";
import { deliveryReasons } from "./OrderReturnPanel";

type Customer = { _id: string; name: string; email: string; phone?: string; role: "customer" | "staff" | "admin"; is_blocked: boolean; hasGoogle: boolean; hasPassword: boolean; createdAt: string; orderCount: number; completedCount: number; cancelledCount: number; returnedCount: number; refusalCount: number; totalSpent: number; canManage: boolean };
const roles = { customer: "Khách hàng", staff: "Nhân viên", admin: "Quản trị viên" };
const money = (value: number) => new Intl.NumberFormat("vi-VN").format(value) + " ₫";
export default function AdminCustomers({ request, paginatedRequest, currentUserRole, initialSearch, staffDirectory }: {
  request: AdminRequest; paginatedRequest: AdminPaginatedRequest; currentUserRole?: string; initialSearch: string; staffDirectory: boolean;
}) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState(initialSearch);
  const [role, setRole] = useState(staffDirectory ? "staff" : "customer");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<ApiPagination>();
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [listError, setListError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<Customer>();
  const [newRole, setNewRole] = useState("customer");
  const [history, setHistory] = useState<Customer>();
  const isAdmin = currentUserRole === "admin";
  useEffect(() => {
    const controller = new AbortController();
    paginatedRequest<Customer[]>(adminListPath("/admin/customers", { page, limit: 25, search, role }), { signal: controller.signal })
      .then(({ data, pagination }) => { if (!controller.signal.aborted) { setCustomers(data); setPagination(pagination); setListError(""); } })
      .catch((cause) => { if (!controller.signal.aborted) setListError(cause instanceof Error ? cause.message : "Không tải được tài khoản."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [paginatedRequest, page, search, role, revision]);
  function refresh() { setLoading(true); setRevision((v) => v + 1); }
  async function change(customer: Customer, action: "role" | "block") {
    if (!customer.canManage || busy) return;
    if (action === "block" && !window.confirm((customer.is_blocked ? "Mở khóa" : "Khóa") + " tài khoản " + customer.email + "? Các phiên đăng nhập cũ sẽ hết hiệu lực.")) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await request("/admin/customers/" + customer._id + "/" + action, { method: "PATCH", body: JSON.stringify(action === "role" ? { role: newRole } : { is_blocked: !customer.is_blocked }) });
      setNotice("Đã cập nhật tài khoản và thu hồi các phiên đăng nhập cũ."); setEditing(undefined); refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể cập nhật."); }
    finally { setBusy(false); }
  }
  return <>
    <div className="admin-adminlist-header">
      <p className="admin-muted">{staffDirectory ? "Quản lý quyền vận hành và trạng thái truy cập của nhân viên." : "Tra cứu hồ sơ khách, lịch sử đơn và chi tiêu từ đơn đã giao, thu tiền."}</p>
      <button type="button" className="admin-icon-button" aria-label="Làm mới" title="Làm mới" disabled={loading || busy} onClick={refresh}><AdminIcon name="refresh" /></button>
    </div>
    <section className="admin-panel">
      {error && !editing && <AdminFeedback kind="error" message={error} />}
      {notice && <AdminFeedback kind="success" message={notice} />}
      <div className="admin-filter-bar">
        <label className="admin-list-search">Tìm tài khoản<input maxLength={100} value={search} placeholder="Tên, email, số điện thoại" onChange={(event) => { setSearch(event.target.value); setPage(1); setLoading(true); }} /></label>
        {isAdmin && <label>Nhóm tài khoản<select aria-label="Nhóm tài khoản" value={role} onChange={(event) => { setRole(event.target.value); setPage(1); setLoading(true); }}>
          {!staffDirectory && <option value="customer">Khách hàng</option>}
          <option value="staff">Nhân viên</option><option value="admin">Quản trị viên (chỉ xem)</option>
          {!staffDirectory && <option value="all">Tất cả</option>}
        </select></label>}
      </div>
      <div className="admin-table-wrap" role="region" aria-label={staffDirectory ? "Danh sách nhân viên" : "Danh sách khách hàng"} tabIndex={0}>
        <table className="admin-table"><thead><tr>
          <th>{staffDirectory ? "Nhân viên" : "Hồ sơ"}</th><th>Đăng nhập</th>
          {!staffDirectory && <><th>Lịch sử mua</th><th>Từ chối nhận / Hoàn kho</th><th>Chi tiêu đã giao</th></>}
          <th>Vai trò</th><th>Trạng thái</th><th>Thao tác</th>
        </tr></thead><tbody>
          {loading || listError || !customers.length ? <tr><td colSpan={staffDirectory ? 5 : 8}>
            <AdminFeedback kind={loading ? "loading" : listError ? "error" : "empty"} message={loading ? "Đang tải tài khoản…" : listError || "Không tìm thấy tài khoản."} onRetry={!loading && listError ? refresh : undefined} />
          </td></tr> : customers.map((customer) => <tr key={customer._id}>
            <td><strong>{customer.name}</strong><br /><small>{customer.email}{customer.phone && <><br />{customer.phone}</>}</small></td>
            <td>{[customer.hasGoogle ? "Google" : "", customer.hasPassword ? "Mật khẩu" : ""].filter(Boolean).join(" + ") || "Chưa thiết lập"}</td>
            {!staffDirectory && <>
              <td><button type="button" onClick={() => setHistory(customer)}>{customer.orderCount} đơn · Xem đã mua gì</button><br /><small>Đã giao {customer.completedCount} · Hủy {customer.cancelledCount}</small></td>
              <td><strong>{customer.refusalCount} đơn từ chối nhận</strong><br /><small>{customer.returnedCount} đơn đã hoàn kho</small></td>
              <td>{money(customer.totalSpent)}</td>
            </>}
            <td>{roles[customer.role]}</td>
            <td><span className={"admin-data-pill tone-" + (customer.is_blocked ? "amber" : "green")}>{customer.is_blocked ? "Đã khóa" : "Hoạt động"}</span></td>
            <td>{isAdmin && customer.canManage ? <div className="admin-actions">
              <button type="button" disabled={busy} onClick={() => { setEditing(customer); setNewRole(customer.role); setError(""); }}>Phân quyền</button>
              <button type="button" disabled={busy} onClick={() => void change(customer, "block")}>{customer.is_blocked ? "Mở khóa" : "Khóa"}</button>
            </div> : <span className="admin-muted">{customer.role === "admin" ? "Tài khoản quản trị được bảo vệ" : "Chỉ xem"}</span>}</td>
          </tr>)}
        </tbody></table>
      </div>
      {!listError && <AdminPagination page={page} pagination={pagination} loading={loading} onPage={(value) => { setPage(value); setLoading(true); }} />}
    </section>
    {editing && <CatalogDialog title="Phân quyền tài khoản" close={() => { if (!busy) setEditing(undefined); }}>
      <p><strong>{editing.name}</strong> · {editing.email}</p>
      {error && <AdminFeedback kind="error" message={error} />}
      <form onSubmit={(event: FormEvent) => { event.preventDefault(); void change(editing, "role"); }}>
        <label>Vai trò<select value={newRole} onChange={(event) => setNewRole(event.target.value)}><option value="customer">Khách hàng</option><option value="staff">Nhân viên vận hành</option></select></label>
        <p className="admin-muted">Nhân viên được xử lý đơn, kho và kiểm duyệt. Quản trị viên quản lý quyền và ghi nhận hoàn tiền.</p>
        <div className="admin-actions"><button disabled={busy} className="primary">Lưu quyền</button><button type="button" disabled={busy} onClick={() => setEditing(undefined)}>Đóng</button></div>
      </form>
    </CatalogDialog>}
    {history && <CustomerHistory customer={history} paginatedRequest={paginatedRequest} onClose={() => setHistory(undefined)}/>}
  </>;
}
function CustomerHistory({ customer, paginatedRequest, onClose }: { customer: Customer; paginatedRequest: AdminPaginatedRequest; onClose: () => void }) {
  const [orders, setOrders] = useState<FullAdminOrder[]>([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<ApiPagination>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    paginatedRequest<FullAdminOrder[]>("/admin/customers/" + customer._id + "/orders?page=" + page + "&limit=10", { signal: controller.signal })
      .then(({ data, pagination }) => { if (!controller.signal.aborted) { setOrders(data); setPagination(pagination); } })
      .catch((cause) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Không tải được lịch sử."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [customer._id, page, paginatedRequest]);
  return <div className="admin-modal-backdrop"><section className="admin-modal large-modal" role="dialog" aria-modal="true" aria-label="Lịch sử mua hàng"><div className="admin-toolbar"><h2>Lịch sử mua · {customer.name}</h2><button onClick={onClose}>Đóng</button></div><p>{customer.orderCount} đơn · {customer.refusalCount} đơn từng từ chối nhận · Chi tiêu đã giao {money(customer.totalSpent)}</p>{error && <p role="alert">{error}</p>}
    {orders.map((order) => <article className="admin-history-card" key={order._id}><h3>#{order._id.slice(-8).toUpperCase()} · {orderStatusText[order.order_status]}</h3><p>{new Date(order.created_at).toLocaleString("vi-VN")} · {money(order.final_amount)} · {paymentStatusText[order.payment_status]}</p><ul>{order.items.map((item, i) => <li key={i}>{item.product_name} · {item.color} / {item.size} · {item.sku} · SL {item.quantity}</li>)}</ul>{order.delivery_incidents?.map((incident, i) => <p key={i} className="admin-alert">{deliveryReasons[incident.reason] ?? incident.reason} · {new Date(incident.at).toLocaleString("vi-VN")}: {incident.note}</p>)}</article>)}
    {!loading && !orders.length && <p>Khách chưa có đơn hàng.</p>}<AdminPagination page={page} pagination={pagination} loading={loading} onPage={(n) => { setPage(n); setLoading(true); }}/>
  </section></div>;
}
