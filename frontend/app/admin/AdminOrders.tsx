"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { AdminRequest } from "./ProductVariantsManager";
import { paymentStatusText } from "@/lib/order-api";
import type { OrderPaymentResponse } from "@/lib/payment-api";
import OrderInvoiceModal, { type FullAdminOrder } from "./OrderInvoiceModal";

const nextOrderStatus = {
  pending: "processing",
  processing: "shipping",
  shipping: "completed",
} as const;

const statusLabels: Record<string, string> = {
  pending: "Chờ xác nhận",
  processing: "Đang xử lý",
  shipping: "Đang giao",
  completed: "Hoàn thành",
  cancelled: "Đã hủy",
};

export default function AdminOrders({ request, isAdmin }: { request: AdminRequest; isAdmin: boolean }) {
  const [orders, setOrders] = useState<FullAdminOrder[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<FullAdminOrder | null>(null);
  const [invoiceOrder, setInvoiceOrder] = useState<FullAdminOrder | null>(null);
  const [cancelModalOrder, setCancelModalOrder] = useState<FullAdminOrder | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const formatPrice = (val: number) =>
    `${new Intl.NumberFormat("vi-VN").format(val)} đ`;

  const fetchOrders = useCallback((signal?: AbortSignal) =>
    request<FullAdminOrder[]>("/admin/orders", { signal })
      .then((data) => {
        if (signal?.aborted) return;
        setOrders(data);
        setSelectedOrder((current) => current ? data.find((order) => order._id === current._id) ?? null : null);
      })
      .catch((cause: unknown) => {
        if (!signal?.aborted) setError(cause instanceof Error ? cause.message : "Không thể tải danh sách đơn hàng.");
      })
      .finally(() => { if (!signal?.aborted) setLoading(false); }),
  [request]);

  useEffect(() => {
    const controller = new AbortController();
    void fetchOrders(controller.signal);
    return () => controller.abort();
  }, [fetchOrders]);

  const updateOrderStatus = async (orderId: string, status: string) => {
    if (busy) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await request(`/admin/orders/${orderId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setSuccess(`Đã chuyển trạng thái đơn hàng sang "${statusLabels[status]}".`);
      await fetchOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cập nhật trạng thái đơn hàng thất bại.");
    } finally {
      setBusy(false);
    }
  };

  const handleCancelOrder = async (e: FormEvent) => {
    e.preventDefault();
    if (!cancelModalOrder || busy) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await request(`/admin/orders/${cancelModalOrder._id}/cancel`, {
        method: "PATCH",
        body: JSON.stringify({ note: cancelReason || "Quản trị viên hủy đơn hàng" }),
      });
      setSuccess("Đã hủy đơn hàng và hoàn lại số lượng tồn kho thành công.");
      setCancelModalOrder(null);
      setCancelReason("");
      await fetchOrders();
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
    const transactionId = String(new FormData(formEl).get("transactionId") ?? "").trim();
    if (!transactionId) return;

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
        body: JSON.stringify({ transaction_id: transactionId }),
      });
      setSuccess("Đã xác nhận thanh toán chuyển khoản thành công.");
      await fetchOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể xác nhận chuyển khoản.");
    } finally {
      setBusy(false);
    }
  };

  const reconcileVNPay = async (orderId: string) => {
    if (busy || !isAdmin) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const result = await request<OrderPaymentResponse>(`/payments/order/${orderId}`);
      const payment = result.payments.find((item) => item.payment_method === "VNPay");
      if (!payment) throw new Error("Đơn này chưa có yêu cầu thanh toán VNPay.");
      const gateway = await request<{
        gateway_response_code: string;
        gateway_transaction_status: string;
        database_updated: boolean;
      }>(`/payments/vnpay/${payment._id}/reconcile`, {
        method: "POST",
        body: JSON.stringify({ apply: true }),
      });
      setSuccess(
        `VNPay phản hồi mã ${gateway.gateway_response_code}, trạng thái ${gateway.gateway_transaction_status}.${gateway.database_updated ? " Đã đồng bộ trạng thái đơn hàng." : ""}`,
      );
      await fetchOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể đối soát VNPay.");
    } finally {
      setBusy(false);
    }
  };

  // Filter orders
  const filteredOrders = orders.filter((order) => {
    if (statusFilter !== "all" && order.order_status !== statusFilter) return false;
    if (paymentFilter !== "all" && order.payment_method !== paymentFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      const matchId = order._id.toLowerCase().includes(q);
      const matchName = order.receiver_name.toLowerCase().includes(q);
      const matchPhone = order.receiver_phone.includes(q);
      const matchEmail = order.user_id?.email.toLowerCase().includes(q);
      if (!matchId && !matchName && !matchPhone && !matchEmail) return false;
    }
    return true;
  });

  // Calculate status counts
  const counts: Record<string, number> = {
    all: orders.length,
    pending: orders.filter((o) => o.order_status === "pending").length,
    processing: orders.filter((o) => o.order_status === "processing").length,
    shipping: orders.filter((o) => o.order_status === "shipping").length,
    completed: orders.filter((o) => o.order_status === "completed").length,
    cancelled: orders.filter((o) => o.order_status === "cancelled").length,
  };

  return (
    <div className="admin-orders-page">
      <div className="admin-panel">
        <div className="admin-toolbar">
          <div>
            <h2>Quản lý đơn hàng & Vận chuyển</h2>
            <p className="admin-muted">
              Theo dõi tiến độ, thanh toán và in phiếu giao hàng cho khách ({orders.length} đơn).
            </p>
          </div>
          <button
            type="button"
            className="admin-button"
            onClick={() => { setLoading(true); setError(""); void fetchOrders(); }}
            disabled={loading || busy}
          >
            {loading ? "Đang tải..." : "🔄 Làm mới đơn"}
          </button>
        </div>

        {error && <p className="admin-alert">{error}</p>}
        {success && <p className="admin-success">{success}</p>}

        {/* STATUS TABS */}
        <div className="admin-order-tabs">
          {[
            { id: "all", label: "Tất cả đơn" },
            { id: "pending", label: "Chờ xác nhận" },
            { id: "processing", label: "Đang xử lý" },
            { id: "shipping", label: "Đang giao" },
            { id: "completed", label: "Hoàn thành" },
            { id: "cancelled", label: "Đã hủy" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`order-tab-btn ${statusFilter === tab.id ? "active" : ""}`}
              onClick={() => setStatusFilter(tab.id)}
            >
              {tab.label}
              <span className="order-tab-count">{counts[tab.id] ?? 0}</span>
            </button>
          ))}
        </div>

        {/* SEARCH & FILTERS */}
        <div className="admin-filter-bar">
          <div className="admin-search-form">
            <input
              type="text"
              placeholder="Tìm theo mã đơn, họ tên, SĐT khách..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="admin-search-input"
            />
            {search && (
              <button type="button" onClick={() => setSearch("")}>
                Xóa
              </button>
            )}
          </div>

          <div className="filter-select-group">
            <label>Thanh toán:</label>
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="admin-select"
            >
              <option value="all">Tất cả phương thức</option>
              <option value="COD">Thanh toán COD</option>
              <option value="BankTransfer">Chuyển khoản (BankTransfer)</option>
              <option value="VNPay">Cổng VNPay</option>
              <option value="SePay">SePay</option>
              <option value="MoMo">Ví MoMo</option>
            </select>
          </div>
        </div>

        {/* ORDERS TABLE */}
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Mã đơn / Ngày</th>
                <th>Khách nhận hàng</th>
                <th>Sản phẩm</th>
                <th>Phương thức TT</th>
                <th>Tổng tiền</th>
                <th>Trạng thái</th>
                <th style={{ textAlign: "right" }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="admin-empty">
                    {loading ? "Đang tải đơn hàng..." : "Không có đơn hàng nào khớp điều kiện lọc."}
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
                    order.payment_status !== "success" && (order.order_status === "pending" || order.order_status === "processing");

                  return (
                    <tr key={order._id}>
                      <td>
                        <strong>#{order._id.slice(-8).toUpperCase()}</strong>
                        <br />
                        <small>{new Date(order.created_at).toLocaleString("vi-VN")}</small>
                      </td>
                      <td>
                        <strong>{order.receiver_name}</strong>
                        <br />
                        <small>{order.receiver_phone}</small>
                        <br />
                        <small className="admin-muted">{order.user_id?.email}</small>
                      </td>
                      <td>
                        {order.items.length ? (
                          <div className="order-items-preview">
                            {order.items.slice(0, 2).map((it, idx) => (
                              <div key={idx} className="preview-line">
                                • {it.product_name} ({it.size}) × {it.quantity}
                              </div>
                            ))}
                            {order.items.length > 2 && (
                              <small className="admin-muted">
                                +{order.items.length - 2} món khác
                              </small>
                            )}
                          </div>
                        ) : (
                          <span className="admin-muted">Không có chi tiết</span>
                        )}
                      </td>
                      <td>
                        <span className="payment-method-chip">{order.payment_method}</span>
                        <br />
                        <small
                          className={`payment-status-badge ${order.payment_status === "success" ? "paid" : "unpaid"}`}
                        >
                          {paymentStatusText[order.payment_status]}
                        </small>
                      </td>
                      <td>
                        <strong>{formatPrice(order.final_amount)}</strong>
                      </td>
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
                            title="In hóa đơn xuất kho"
                            onClick={() => setInvoiceOrder(order)}
                          >
                            🖨️ In
                          </button>

                          {canAdvance && nextStatus && (
                            <button
                              type="button"
                              className="admin-button advance-btn"
                              disabled={busy}
                              onClick={() => void updateOrderStatus(order._id, nextStatus)}
                            >
                              → {statusLabels[nextStatus]}
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
      </div>

      {/* MODAL: ORDER DETAILS */}
      {selectedOrder && (
        <div className="admin-modal-backdrop" onClick={() => setSelectedOrder(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
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
                    PTTT: <strong>{selectedOrder.payment_method}</strong>
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
              {isAdmin && selectedOrder.order_status === "pending" && selectedOrder.payment_method === "BankTransfer" &&
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
                      <button type="submit" className="admin-button" disabled={busy}>
                        {busy ? "Đang xử lý..." : "Xác nhận đã nhận tiền"}
                      </button>
                    </form>
                  </div>
                )}

              {/* Special action for VNPay */}
              {isAdmin && selectedOrder.order_status === "pending" && selectedOrder.payment_method === "VNPay" &&
                selectedOrder.payment_status === "pending" && (
                  <div className="admin-payment-action-box">
                    <h4>Đối soát cổng thanh toán VNPay</h4>
                    <p className="admin-muted">
                      Kiểm tra trạng thái giao dịch trực tiếp với VNPay API và đồng bộ vào hệ thống.
                    </p>
                    <button
                      type="button"
                      className="admin-button"
                      disabled={busy}
                      onClick={() => void reconcileVNPay(selectedOrder._id)}
                    >
                      {busy ? "Đang đối soát..." : "Đối soát VNPay"}
                    </button>
                  </div>
                )}

              {/* ITEMS LIST */}
              <h4 style={{ marginTop: "20px" }}>Danh sách sản phẩm ({selectedOrder.items.length})</h4>
              <table className="admin-table">
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
              </table>

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
                🖨️ In hóa đơn xuất kho
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
                  </button>
                )}

              {selectedOrder.payment_status !== "success" && (selectedOrder.order_status === "pending" ||
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
                  Toàn bộ các mặt hàng trong đơn sẽ được tự động hoàn lại số lượng tồn kho.
                </p>
                <label style={{ display: "block", marginTop: "12px" }}>
                  Lý do hủy đơn:
                  <textarea
                    required
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="VD: Khách hàng đổi ý, hết size sản phẩm, sai địa chỉ..."
                    rows={3}
                    style={{ width: "100%", marginTop: "6px" }}
                  />
                </label>
              </div>
              <div className="modal-footer">
                <button type="submit" className="admin-button danger" disabled={busy}>
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
          order={invoiceOrder}
          onClose={() => setInvoiceOrder(null)}
        />
      )}
    </div>
  );
}
