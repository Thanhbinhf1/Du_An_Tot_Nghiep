"use client";

import { useCallback, useEffect, useState } from "react";
import type { AdminRequest } from "./ProductVariantsManager";

type PaymentRecord = {
  _id: string;
  order_id?: {
    _id: string;
    receiver_name: string;
    receiver_phone: string;
    final_amount: number;
    order_status: string;
    payment_method: string;
    created_at: string;
  } | null;
  payment_method: "VNPay" | "MoMo" | "BankTransfer";
  transaction_id: string;
  status: "pending" | "success" | "failed";
  paid_at?: string | null;
  created_at: string;
};

export default function AdminPayments({ request }: { request: AdminRequest }) {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const formatPrice = (val: number) =>
    `${new Intl.NumberFormat("vi-VN").format(val)} đ`;

  const fetchPayments = useCallback((signal?: AbortSignal) =>
    request<PaymentRecord[]>(`/admin/payments?status=${statusFilter === "all" ? "" : statusFilter}&method=${methodFilter === "all" ? "" : methodFilter}`, { signal })
      .then((data) => {
        if (signal?.aborted) return;
        setPayments(data);
        setError("");
      })
      .catch((cause: unknown) => {
        if (!signal?.aborted) setError(cause instanceof Error ? cause.message : "Không thể tải danh sách giao dịch thanh toán.");
      })
      .finally(() => { if (!signal?.aborted) setLoading(false); }),
  [request, statusFilter, methodFilter]);

  useEffect(() => {
    const controller = new AbortController();
    void fetchPayments(controller.signal);
    return () => controller.abort();
  }, [fetchPayments]);

  const totalCollected = payments
    .filter((p) => p.status === "success")
    .reduce((sum, p) => sum + (p.order_id?.final_amount ?? 0), 0);

  const pendingCount = payments.filter((p) => p.status === "pending").length;

  return (
    <div className="admin-payments-page">
      <div className="admin-panel">
        <div className="admin-toolbar">
          <div>
            <h2>Quản lý giao dịch thanh toán & Đối soát</h2>
            <p className="admin-muted">
              Kiểm tra tình trạng thanh toán qua BankTransfer, VNPay, MoMo ({payments.length} giao dịch).
            </p>
          </div>
          <button
            type="button"
            className="admin-button"
            onClick={() => { setLoading(true); void fetchPayments(); }}
            disabled={loading}
          >
            {loading ? "Đang tải..." : "🔄 Làm mới giao dịch"}
          </button>
        </div>

        {error && <p className="admin-alert">{error}</p>}

        {/* METRICS ROW */}
        <div className="admin-overview" style={{ marginBottom: "18px" }}>
          <article className="admin-stat-card primary">
            <span className="admin-stat-icon">💳</span>
            <div>
              <p>Đã thu qua cổng/chuyển khoản</p>
              <strong>{formatPrice(totalCollected)}</strong>
              <small>Giao dịch thành công</small>
            </div>
          </article>

          <article className="admin-stat-card">
            <span className="admin-stat-icon admin-stat-icon-red">⏳</span>
            <div>
              <p>Chờ xác nhận / Đối soát</p>
              <strong>{pendingCount} giao dịch</strong>
              <small>Cần kiểm tra sao kê hoặc IPN</small>
            </div>
          </article>
        </div>

        {/* FILTERS BAR */}
        <div className="admin-filter-bar">
          <div className="filter-select-group">
            <label>Phương thức:</label>
            <select
              value={methodFilter}
              onChange={(e) => { setLoading(true); setMethodFilter(e.target.value); }}
              className="admin-select"
            >
              <option value="all">Tất cả cổng</option>
              <option value="BankTransfer">Chuyển khoản (BankTransfer)</option>
              <option value="VNPay">Cổng VNPay</option>
              <option value="MoMo">Ví MoMo</option>
            </select>
          </div>

          <div className="filter-select-group">
            <label>Trạng thái:</label>
            <select
              value={statusFilter}
              onChange={(e) => { setLoading(true); setStatusFilter(e.target.value); }}
              className="admin-select"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="success">Thành công (success)</option>
              <option value="pending">Đang chờ (pending)</option>
              <option value="failed">Thất bại (failed)</option>
            </select>
          </div>
        </div>

        {/* PAYMENTS TABLE */}
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Mã GD / Ngày</th>
                <th>Mã đơn hàng</th>
                <th>Khách hàng</th>
                <th>Cổng thanh toán</th>
                <th>Mã tham chiếu ngân hàng</th>
                <th style={{ textAlign: "right" }}>Số tiền</th>
                <th style={{ textAlign: "center" }}>Trạng thái</th>
                <th>Thời gian thanh toán</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="admin-empty">
                    {loading ? "Đang tải dữ liệu giao dịch..." : "Không có giao dịch nào phù hợp."}
                  </td>
                </tr>
              ) : (
                payments.map((p) => (
                  <tr key={p._id}>
                    <td>
                      <code>{p._id.slice(-8).toUpperCase()}</code>
                      <br />
                      <small>{new Date(p.created_at).toLocaleString("vi-VN")}</small>
                    </td>
                    <td>
                      {p.order_id ? (
                        <strong>#{p.order_id._id.slice(-8).toUpperCase()}</strong>
                      ) : (
                        <span className="admin-muted">Đơn đã xóa</span>
                      )}
                    </td>
                    <td>
                      {p.order_id ? (
                        <>
                          <strong>{p.order_id.receiver_name}</strong>
                          <br />
                          <small>{p.order_id.receiver_phone}</small>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      <span className="payment-method-chip">{p.payment_method}</span>
                    </td>
                    <td>
                      {p.transaction_id ? (
                        <code>{p.transaction_id}</code>
                      ) : (
                        <span className="admin-muted">Chưa có</span>
                      )}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <strong>{formatPrice(p.order_id?.final_amount ?? 0)}</strong>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <span
                        className={`payment-status-badge ${p.status === "success" ? "paid" : p.status === "pending" ? "unpaid" : "failed"}`}
                      >
                        {p.status === "success" ? "Thành công" : p.status === "pending" ? "Đang chờ" : "Thất bại"}
                      </span>
                    </td>
                    <td>
                      {p.paid_at ? (
                        <small>{new Date(p.paid_at).toLocaleString("vi-VN")}</small>
                      ) : (
                        <span className="admin-muted">—</span>
                      )}
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
