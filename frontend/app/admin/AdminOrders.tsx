"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { AdminRequest, AdminPaginatedRequest } from "./ProductVariantsManager";
import type { ApiPagination } from "@/lib/api";
import AdminPagination, { adminListPath } from "./AdminPagination";
import { queueLabels, navigate, type OrderQueue } from "./adminNavigation";
import { paymentStatusText, paymentMethodText, type OrderStatus, type OrderPaymentStatus } from "@/lib/order-api";
import type { OrderPaymentResponse } from "@/lib/payment-api";
import OrderInvoiceModal, { type FullAdminOrder } from "./OrderInvoiceModal";
import OrderReturnPanel from "./OrderReturnPanel";
import AdminFeedback from "./AdminFeedback";
import AdminIcon from "./AdminIcon";

const nextOrderStatus = {
  pending: "processing",
  processing: "shipping",
  shipping: "completed",
} as const;

const statusLabels: Record<string, string> = {
  pending: "Chờ xác nhận",
  processing: "Đang xử lý",
  shipping: "Đang giao",
  delivery_failed: "Giao thất bại",
  returning: "Đang hoàn về",
  returned: "Đã kiểm hàng hoàn",
  completed: "Hoàn thành",
  cancelled: "Đã hủy",
};
const orderDate = new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" });
const shippingLabels: Record<string, string> = { Standard: "Tiêu chuẩn", Express: "Nhanh" };

export type OrderListView = {
  label: string;
  empty: string;
  description: string;
  status?: OrderStatus;
  paymentStatus?: OrderPaymentStatus;
  queue?: OrderQueue;
};

type Props = {
  queue?: OrderQueue;
  view?: OrderListView;
  initialSearch: string;
  request: AdminRequest;
  paginatedRequest: AdminPaginatedRequest;
  isAdmin: boolean;
};

export default function AdminOrders({ request, paginatedRequest, isAdmin, queue, initialSearch, view }: Props) {
  const [orders, setOrders] = useState<FullAdminOrder[]>([]);
  const [revision, setRevision] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [pagination, setPagination] = useState<ApiPagination>();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [shippingFilter, setShippingFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState("all");
  const [search, setSearch] = useState(initialSearch);
  const [selectedOrder, setSelectedOrder] = useState<FullAdminOrder | null>(null);
  const [invoiceOrder, setInvoiceOrder] = useState<FullAdminOrder | null>(null);
  const [cancelModalOrder, setCancelModalOrder] = useState<FullAdminOrder | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [listError, setListError] = useState("");
  const [success, setSuccess] = useState("");
  const activeQueue = view?.queue ?? queue;
  const activeStatus = view?.status ?? statusFilter;
  const activePaymentStatus = view?.paymentStatus ?? "";

  const formatPrice = (val: number) =>
    `${new Intl.NumberFormat("vi-VN").format(val)} đ`;

  const fetchOrders = useCallback((signal: AbortSignal) =>
    paginatedRequest<FullAdminOrder[]>(adminListPath("/admin/orders", {
      page, limit, queue: activeQueue ?? "", status: activeStatus, method: paymentFilter, payment_status: activePaymentStatus,
      shipping: shippingFilter, period: periodFilter, search: search.trim().replace(/^#/, ""),
    }), { signal })
      .then(({ data, pagination }) => {
        if (signal?.aborted) return;
        setListError("");
        setOrders(data);
        setPagination(pagination);
        if (!data.length && page > 1) setPage(page - 1);
        setSelectedOrder((current) => current ? data.find((order) => order._id === current._id) ?? null : null);
      })
      .catch((cause: unknown) => {
        if (!signal?.aborted) setListError(cause instanceof Error ? cause.message : "Không thể tải danh sách đơn hàng.");
      })
      .finally(() => { if (!signal?.aborted) setLoading(false); }),
  [paginatedRequest, page, limit, activeStatus, activePaymentStatus, paymentFilter, shippingFilter, periodFilter, search, activeQueue]);

  useEffect(() => {
    const controller = new AbortController();
    void fetchOrders(controller.signal);
    return () => controller.abort();
  }, [fetchOrders, revision]);

  const refreshOrders = () => { setLoading(true); setRevision((value) => value + 1); };

  const updateOrderStatus = async (orderId: string, status: string) => {
    if (busy) return;
    if (status === "completed" && orders.find((order) => order._id === orderId)?.payment_method === "COD" &&
        !window.confirm("Xác nhận đơn đã giao thành công và đã thu đủ tiền COD?")) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await request(`/admin/orders/${orderId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setSuccess(`Đã chuyển trạng thái đơn hàng sang "${statusLabels[status]}".`);
      refreshOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cập nhật trạng thái đơn hàng thất bại.");
    } finally {
      setBusy(false);
    }
  };

  const handleCancelOrder = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!cancelModalOrder || busy) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await request(`/admin/orders/${cancelModalOrder._id}/cancel`, {
        method: "PATCH",
        body: JSON.stringify({ note: cancelReason.trim(), acknowledge_refund: cancelModalOrder.payment_status === "success", legacy_link_closed: new FormData(e.currentTarget).has("legacy_link_closed") }),
      });
      setSuccess(cancelModalOrder.payment_status === "success"
        ? "Đã hủy đơn, hoàn kho và chuyển đơn sang danh sách chờ hoàn tiền."
        : "Đã hủy đơn hàng và hoàn lại tồn kho.");
      setCancelModalOrder(null);
      setCancelReason("");
      refreshOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hủy đơn hàng thất bại.");
    } finally {
      setBusy(false);
    }
  };

  const confirmBankTransfer = async (event: FormEvent<HTMLFormElement>, orderId: string) => {
    event.preventDefault();
    if (busy || !isAdmin) return;
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    const transactionId = String(form.get("transactionId") ?? "").trim();
    const amount = Number(form.get("amount"));
    if (!transactionId || !Number.isSafeInteger(amount) || amount <= 0) return;

    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const result = await request<OrderPaymentResponse>(`/payments/order/${orderId}`);
      const payment = result.payments.find(
        (item) => item.payment_method === "BankTransfer" && item.status === "pending",
      );
      if (!payment) throw new Error("Chưa có yêu cầu chuyển khoản đang chờ cho đơn này.");

      await request(`/payments/${payment._id}/confirm`, {
        method: "PATCH",
        body: JSON.stringify({ transaction_id: transactionId, amount }),
      });
      setSuccess("Đã xác nhận thanh toán chuyển khoản thành công.");
      refreshOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể xác nhận chuyển khoản.");
    } finally {
      setBusy(false);
    }
  };

  const reconcileSePay = async (orderId: string) => {
    if (busy || !isAdmin) return;
    setBusy(true); setError(""); setSuccess("");
    try {
      const result = await request<{ payment_status: string }>("/payments/sepay/orders/" + orderId + "/reconcile", { method: "POST" });
      setSuccess(result.payment_status === "success" ? "Đã ghi nhận chuyển khoản SePay." : "Chưa ghi nhận khoản chuyển khớp với đơn.");
      refreshOrders();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể đối soát SePay."); }
    finally { setBusy(false); }
  };

  // Filter orders
  const filteredOrders = orders;

  // Calculate status counts
  const counts: Record<string, number> = {
    all: 0, pending: 0, processing: 0, shipping: 0, completed: 0, cancelled: 0,
    ...pagination?.statusCounts,
  };

  return (
    <div className="admin-orders-page">
      <div className="admin-adminlist-header">
        <p className="admin-muted">{view?.description ?? "Theo dõi đơn, thanh toán và tiến độ giao hàng."}</p>
          <button
            type="button"
            className="admin-icon-button"
            aria-label="Làm mới đơn"
            title="Làm mới đơn"
            onClick={() => { setError(""); refreshOrders(); }}
            disabled={loading || busy}
          >
            <AdminIcon name="refresh" />
          </button>
      </div>
      <div className="admin-panel">

        {error && !selectedOrder && <AdminFeedback kind="error" message={error} />}
        {success && !selectedOrder && <AdminFeedback kind="success" message={success} />}

        {queue && <p className="workspace-current-filter"><strong>{queueLabels[queue]}</strong><button type="button" onClick={() => navigate("orders")}>Xem tất cả đơn</button></p>}
        {/* STATUS TABS */}
        {!view && <div className="admin-order-tabs" aria-label="Lọc theo trạng thái đơn">
          {[
            { id: "all", label: "Tất cả đơn" },
            { id: "pending", label: "Chờ xác nhận" },
            { id: "processing", label: "Đang xử lý" },
            { id: "shipping", label: "Đang giao" },
            { id: "delivery_failed", label: "Giao thất bại" },
            { id: "returning", label: "Đang hoàn về" },
            { id: "returned", label: "Đã kiểm hàng hoàn" },
            { id: "completed", label: "Hoàn thành" },
            { id: "cancelled", label: "Đã hủy" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`order-tab-btn ${statusFilter === tab.id ? "active" : ""}`}
              aria-pressed={statusFilter === tab.id}
              onClick={() => { setStatusFilter(tab.id); setPage(1); setLoading(true); }}
            >
              {tab.label}
              <span className="order-tab-count">{loading || listError ? "—" : counts[tab.id] ?? 0}</span>
            </button>
          ))}
        </div>}

        {/* SEARCH & FILTERS */}
        <div className="admin-filter-bar">
          <div className="admin-search-form">
            <input
              type="text"
              aria-label="Tìm đơn hàng"
              placeholder="Tìm theo mã đơn, họ tên, SĐT khách..."
              maxLength={100}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); setLoading(true); }}
              className="admin-search-input"
            />
            {search && (
              <button type="button" onClick={() => { setSearch(""); setPage(1); setLoading(true); }}>
                Xóa
              </button>
            )}
          </div>

          <div className="filter-select-group">
            <label htmlFor="admin-order-payment-filter">Thanh toán:</label>
            <select
              id="admin-order-payment-filter"
              value={paymentFilter}
              onChange={(e) => { setPaymentFilter(e.target.value); setPage(1); setLoading(true); }}
              className="admin-select"
            >
              <option value="all">Tất cả phương thức</option>
              {Object.entries(paymentMethodText).map(([id, label]) => <option value={id} key={id}>{label}</option>)}
            </select>
          </div>
          <div className="filter-select-group">
            <label htmlFor="admin-order-shipping-filter">Giao hàng</label>
            <select id="admin-order-shipping-filter" className="admin-select" value={shippingFilter} onChange={(event) => { setShippingFilter(event.target.value); setPage(1); setLoading(true); }}>
              <option value="all">Tất cả hình thức</option>
              {Object.entries(shippingLabels).map(([id, label]) => <option value={id} key={id}>{label}</option>)}
            </select>
          </div>
          <div className="filter-select-group">
            <label htmlFor="admin-order-period-filter">Ngày đặt</label>
            <select id="admin-order-period-filter" className="admin-select" value={periodFilter} onChange={(event) => { setPeriodFilter(event.target.value); setPage(1); setLoading(true); }}>
              <option value="all">Mọi thời điểm</option><option value="1">Hôm nay</option><option value="7">7 ngày gần nhất</option><option value="30">30 ngày gần nhất</option>
            </select>
          </div>
        </div>

        {/* ORDERS TABLE */}
        <div className="admin-table-wrap" role="region" aria-label="Bảng đơn hàng" tabIndex={0}>
          <table className="admin-table admin-orders-table">
            <thead>
              <tr>
                <th>Mã đơn</th>
                <th>Khách hàng</th>
                <th>Ngày đặt</th>
                <th>Số SP</th>
                <th>Tổng tiền</th>
                <th>Thanh toán</th>
                <th>Giao hàng</th>
                <th>Trạng thái</th>
                <th style={{ textAlign: "right" }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading || listError || filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="admin-empty">
                    {loading ? <AdminFeedback kind="loading" message="Đang tải đơn hàng…" /> : listError
                      ? <AdminFeedback kind="error" message={listError} onRetry={refreshOrders} />
                      : <AdminFeedback kind="empty" message={view?.empty ?? "Không có đơn hàng nào khớp điều kiện lọc."} />}
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const canAdvance =
                    (order.payment_method === "COD" || order.payment_status === "success") &&
                    order.order_status in nextOrderStatus;
                  const nextStatus = canAdvance
                    ? nextOrderStatus[order.order_status as keyof typeof nextOrderStatus]
                    : null;
                  const canCancel =
                    (isAdmin || (order.payment_status !== "success" && order.payment_method !== "PayOS")) && (order.order_status === "pending" || order.order_status === "processing");

                  return (
                    <tr key={order._id}>
                      <td>
                        <strong className="admin-order-number">#{order._id.slice(-8).toUpperCase()}</strong>
                      </td>
                      <td>
                        <strong>{order.receiver_name}</strong>
                        <br />
                        <small>{order.receiver_phone}</small>
                      </td>
                      <td><time dateTime={order.created_at}>{Number.isFinite(Date.parse(order.created_at)) ? orderDate.format(new Date(order.created_at)) : "—"}</time></td>
                      <td>{order.items.length ? order.items.reduce((total, item) => total + item.quantity, 0) : "—"}</td>
                      <td><strong>{formatPrice(order.final_amount)}</strong></td>
                      <td>
                        <span className="payment-method-chip">{order.payment_method === "COD" ? "COD" : paymentMethodText[order.payment_method] ?? order.payment_method}</span>
                        <br />
                        <small
                          className={`payment-status-badge ${order.payment_status === "success" ? "paid" : "unpaid"}`}
                        >
                          {paymentStatusText[order.payment_status]}
                        </small>
                      </td>
                      <td>{order.shipping_method ? shippingLabels[order.shipping_method] ?? order.shipping_method : "—"}</td>
                      <td>
                        <span className={`status-pill status-${order.order_status}`}>
                          {statusLabels[order.order_status] ?? order.order_status}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div className="admin-actions" style={{ justifyContent: "flex-end" }}>
                          <button
                            type="button"
                            className="secondary-btn"
                            onClick={() => setSelectedOrder(order)}
                          >
                            Chi tiết
                          </button>

                          <button
                            type="button"
                            className="print-action-btn"
                            title="In phiếu đơn hàng"
                            onClick={() => setInvoiceOrder(order)}
                          >
                            In
                          </button>

                          {canAdvance && nextStatus && (
                            <button
                              type="button"
                              className="admin-button advance-btn"
                              disabled={busy}
                              onClick={() => void updateOrderStatus(order._id, nextStatus)}
                            >
                              → {nextStatus === "completed" && order.payment_method === "COD" ? "Hoàn thành · đã thu COD" : statusLabels[nextStatus]}
                            </button>
                          )}

                          {canCancel && (
                            <button
                              type="button"
                              className="danger-btn"
                              disabled={busy}
                              onClick={() => setCancelModalOrder(order)}
                            >
                              Hủy
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {!listError && <AdminPagination page={page} pagination={{ ...pagination, totalPages: pagination?.totalPages ?? 1, limit }} loading={loading} onPage={(value) => { setPage(value); setLoading(true); }} onLimit={(value) => { setLimit(value); setPage(1); setLoading(true); }} />}
      </div>

      {/* MODAL: ORDER DETAILS */}
      {selectedOrder && (
        <div className="admin-modal-backdrop" onClick={() => setSelectedOrder(null)}>
          <div className="admin-modal" role="dialog" aria-modal="true" aria-label="Chi tiết đơn hàng" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Chi tiết đơn hàng #{selectedOrder._id.slice(-8).toUpperCase()}</h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => setSelectedOrder(null)}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              {error && <p className="admin-alert" role="alert">{error}</p>}
              {success && <p className="admin-success" role="status">{success}</p>}
              <div className="order-detail-meta-grid">
                <div className="meta-card">
                  <h4>Người nhận</h4>
                  <p>
                    <strong>{selectedOrder.receiver_name}</strong>
                  </p>
                  <p>📞 {selectedOrder.receiver_phone}</p>
                  <p>📍 {selectedOrder.shipping_address}</p>
                  {selectedOrder.note && <p>📝 Ghi chú: {selectedOrder.note}</p>}
                </div>

                <div className="meta-card">
                  <h4>Thanh toán & Vận chuyển</h4>
                  <p>
                    PTTT: <strong>{paymentMethodText[selectedOrder.payment_method]}</strong>
                  </p>
                  <p>
                    Trạng thái TT:{" "}
                    <span
                      className={`payment-status-badge ${selectedOrder.payment_status === "success" ? "paid" : "unpaid"}`}
                    >
                      {paymentStatusText[selectedOrder.payment_status]}
                    </span>
                  </p>
                  <p>
                    Trạng thái đơn:{" "}
                    <span className={`status-pill status-${selectedOrder.order_status}`}>
                      {statusLabels[selectedOrder.order_status]}
                    </span>
                  </p>
                  {selectedOrder.transaction_id && (
                    <p>Mã GD: {selectedOrder.transaction_id}</p>
                  )}
                </div>
              </div>

              {/* Special action for BankTransfer */}
              {isAdmin && ["pending", "cancelled"].includes(selectedOrder.order_status) && selectedOrder.payment_method === "BankTransfer" &&
                selectedOrder.payment_status === "pending" && (
                  <div className="admin-payment-action-box">
                    <h4>Xác nhận nhận chuyển khoản ngân hàng</h4>
                    <form onSubmit={(e) => void confirmBankTransfer(e, selectedOrder._id)}>
                      <label>
                        Nhập mã tham chiếu / mã giao dịch ngân hàng đã nhận:
                        <input
                          name="transactionId"
                          required
                          placeholder="VD: FT26019283921"
                          disabled={busy}
                        />
                      </label>
                      <label>
                        Số tiền thực nhận theo sao kê (VNĐ)
                        <input name="amount" type="number" min={1} step={1} required disabled={busy} />
                      </label>
                      <button type="submit" className="admin-button" disabled={busy}>
                        {busy ? "Đang xử lý..." : "Xác nhận đã nhận tiền"}
                      </button>
                    </form>
                  </div>
                )}

              {/* Đối soát SePay từ backend */}
              {isAdmin && selectedOrder.payment_method === "SePay" && ((selectedOrder.order_status === "pending" && selectedOrder.payment_status === "pending") || (selectedOrder.order_status === "cancelled" && selectedOrder.payment_status === "failed")) && (
                  <div className="admin-payment-action-box">
                    <h4>Đối soát thanh toán SePay</h4>
                    <p className="admin-muted">
                      Kiểm tra trạng thái giao dịch trực tiếp với SePay và đồng bộ vào hệ thống.
                    </p>
                    <button
                      type="button"
                      className="admin-button"
                      disabled={busy}
                      onClick={() => void reconcileSePay(selectedOrder._id)}
                    >
                      {busy ? "Đang đối soát..." : "Đối soát SePay"}
                    </button>
                  </div>
                )}

              <OrderReturnPanel key={selectedOrder._id} order={selectedOrder} request={request} isAdmin={isAdmin} onChanged={refreshOrders} />
              {/* ITEMS LIST */}
              <h4 style={{ marginTop: "20px" }}>Danh sách sản phẩm ({selectedOrder.items.length})</h4>
              <div className="admin-table-wrap" role="region" aria-label="Sản phẩm trong đơn" tabIndex={0}><table className="admin-table">
                <thead>
                  <tr>
                    <th>Sản phẩm</th>
                    <th>SKU</th>
                    <th>Size / Màu</th>
                    <th style={{ textAlign: "right" }}>Số lượng</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedOrder.items.map((it, idx) => (
                    <tr key={idx}>
                      <td>
                        <strong>{it.product_name}</strong>
                      </td>
                      <td>
                        <code>{it.sku}</code>
                      </td>
                      <td>
                        {it.size} / {it.color}
                      </td>
                      <td style={{ textAlign: "right" }}>{it.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table></div>

              <div className="modal-total-banner">
                <span>Tổng giá trị đơn hàng:</span>
                <strong>{formatPrice(selectedOrder.final_amount)}</strong>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="admin-button print-btn"
                onClick={() => {
                  setInvoiceOrder(selectedOrder);
                }}
              >
                In phiếu đơn hàng
              </button>

              {selectedOrder.order_status in nextOrderStatus &&
                (selectedOrder.payment_method === "COD" ||
                  selectedOrder.payment_status === "success") && (
                  <button
                    type="button"
                    className="admin-button advance-btn"
                    disabled={busy}
                    onClick={() =>
                      void updateOrderStatus(
                        selectedOrder._id,
                        nextOrderStatus[
                          selectedOrder.order_status as keyof typeof nextOrderStatus
                        ],
                      )
                    }
                  >
                    Chuyển sang &quot;
                    {
                      statusLabels[
                        nextOrderStatus[
                          selectedOrder.order_status as keyof typeof nextOrderStatus
                        ]
                      ]
                    }
                    &quot;
                    {selectedOrder.order_status === "shipping" && selectedOrder.payment_method === "COD" && " và xác nhận đã thu tiền COD"}
                  </button>
                )}

              {(isAdmin || (selectedOrder.payment_status !== "success" && selectedOrder.payment_method !== "PayOS")) && (selectedOrder.order_status === "pending" ||
                selectedOrder.order_status === "processing") && (
                <button
                  type="button"
                  className="danger-btn"
                  onClick={() => setCancelModalOrder(selectedOrder)}
                >
                  Hủy đơn này
                </button>
              )}

              <button
                type="button"
                className="secondary-btn"
                onClick={() => setSelectedOrder(null)}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CANCEL ORDER REASON */}
      {cancelModalOrder && (
        <div className="admin-modal-backdrop" onClick={() => setCancelModalOrder(null)}>
          <div
            className="admin-modal small-modal"
            role="dialog" aria-modal="true" aria-label="Xác nhận hủy đơn hàng"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>Xác nhận hủy đơn hàng</h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => setCancelModalOrder(null)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCancelOrder}>
              <div className="modal-body">
                <p>
                  Bạn có chắc muốn hủy đơn hàng{" "}
                  <strong>#{cancelModalOrder._id.slice(-8).toUpperCase()}</strong>?
                </p>
                <p className="admin-muted" style={{ fontSize: "13px" }}>
                  {cancelModalOrder.payment_status === "success" ? "Hủy đơn sẽ trả hàng về kho và đưa số tiền đã thu vào danh sách Chờ hoàn tiền. Quản trị viên ghi chứng từ sau khi chuyển hoàn cho khách." : "Số lượng đã giữ cho đơn này sẽ được trả về kho."}
                </p>
                {cancelModalOrder.payment_method === "PayOS" && cancelModalOrder.payment_status === "pending" && <label><input name="legacy_link_closed" type="checkbox" required /> Tôi đã đối chiếu tài khoản nhận tiền, xác minh đơn chưa thu tiền và liên kết cũ đã đóng hoặc chưa được tạo.</label>}
                <label style={{ display: "block", marginTop: "12px" }}>
                  Lý do hủy đơn:
                  <textarea
                    required
                    maxLength={1000} value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="VD: Khách hàng đổi ý, hết size sản phẩm, sai địa chỉ..."
                    rows={3}
                    style={{ width: "100%", marginTop: "6px" }}
                  />
                </label>
              </div>
              <div className="modal-footer">
                <button type="submit" className="admin-button danger" disabled={busy || !cancelReason.trim()}>
                  {busy ? "Đang hủy..." : "Xác nhận hủy đơn & Hoàn kho"}
                </button>
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => setCancelModalOrder(null)}
                >
                  Đóng
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRINT INVOICE MODAL */}
      {invoiceOrder && (
        <OrderInvoiceModal
          order={invoiceOrder} request={request}
          onClose={() => setInvoiceOrder(null)}
        />
      )}
    </div>
  );
}
