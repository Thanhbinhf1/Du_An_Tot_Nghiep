"use client";

import { useCallback, useEffect, useState } from "react";
import type { AdminPaginatedRequest } from "./ProductVariantsManager";
import { navigate } from "./adminNavigation";
import type { ApiPagination } from "@/lib/api";
import AdminPagination, { adminListPath } from "./AdminPagination";
import AdminIcon from "./AdminIcon";
import { paymentMethodText } from "@/lib/order-api";

type PaymentRecord = {
  _id: string;
  order_id?: {
    _id: string;
    receiver_name: string;
    receiver_phone: string;
    final_amount: number;
    order_status: string;
    payment_status?: string;
    refund?: { amount: number; reference: string };
    payment_method: string;
    created_at: string;
  } | null;
  payment_method: "PayOS" | "VNPay" | "SePay" | "MoMo" | "BankTransfer";
  transaction_id: string;
  status: "pending" | "success" | "failed";
  paid_at?: string | null;
  created_at: string;
};

export default function AdminPayments({ paginatedRequest }: { paginatedRequest: AdminPaginatedRequest }) {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [revision, setRevision] = useState(0);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<ApiPagination>();
  const [statusFilter, setStatusFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const formatPrice = (val: number) =>
    `${new Intl.NumberFormat("vi-VN").format(val)} đ`;

  const fetchPayments = useCallback((signal: AbortSignal) =>
    paginatedRequest<PaymentRecord[]>(adminListPath("/admin/payments", { page, limit: 25, summary: 1, status: statusFilter, method: methodFilter }), { signal })
      .then(({ data, pagination }) => {
        if (signal?.aborted) return;
        setPayments(data);
        setPagination(pagination);
        setError("");
      })
      .catch((cause: unknown) => {
        if (!signal?.aborted) setError(cause instanceof Error ? cause.message : "Không thể tải danh sách giao dịch thanh toán.");
      })
      .finally(() => { if (!signal?.aborted) setLoading(false); }),
  [paginatedRequest, page, statusFilter, methodFilter]);

  useEffect(() => {
    const controller = new AbortController();
    void fetchPayments(controller.signal);
    return () => controller.abort();
  }, [fetchPayments, revision]);

  const totals = loading || error ? undefined : pagination?.paymentTotals;

  return (
    <div className="admin-payments-page">
      <div className="admin-panel">
        <div className="admin-toolbar">
          <div>
            <h2>Giao dịch & Đối soát</h2>
            <p className="admin-muted">
              Kiểm tra tình trạng thanh toán và chứng từ của đơn hàng.
            </p>
          </div>
          <button
            type="button"
            className="admin-button"
            onClick={() => { setLoading(true); setRevision((value) => value + 1); }}
            disabled={loading}
          >
            {loading ? "Đang tải..." : "Làm mới giao dịch"}
          </button>
        </div>

        {error && <p className="admin-alert">{error}</p>}

        {/* METRICS ROW */}
        <div className="admin-metric-grid admin-metric-grid-three" aria-label="Tổng giao dịch theo bộ lọc">
          <article className="admin-metric-card"><span className="admin-tile-icon tone-green"><AdminIcon name="payments" /></span><div><span>Đã thu theo bộ lọc</span><strong>{totals ? formatPrice(totals.collected) : "—"}</strong></div></article>
          <article className="admin-metric-card"><span className="admin-tile-icon tone-blue"><AdminIcon name="refund" /></span><div><span>Đã ghi nhận hoàn tiền</span><strong>{totals ? formatPrice(totals.refunded) : "—"}</strong></div></article>
          <article className="admin-metric-card"><span className="admin-tile-icon tone-amber"><AdminIcon name="work" /></span><div><span>Giao dịch chờ xác nhận</span><strong>{totals?.pending ?? "—"}</strong></div></article>
        </div>

        {/* FILTERS BAR */}
        <div className="admin-filter-bar">
          <div className="filter-select-group">
            <label htmlFor="admin-payment-method">Phương thức</label>
            <select
              id="admin-payment-method"
              value={methodFilter}
              onChange={(e) => { setLoading(true); setPage(1); setMethodFilter(e.target.value); }}
              className="admin-select"
            >
              <option value="all">Tất cả cổng</option>
              {(["BankTransfer", "SePay", "MoMo", "VNPay", "PayOS"] as const).map((method) => <option value={method} key={method}>{paymentMethodText[method]}</option>)}
            </select>
          </div>

          <div className="filter-select-group">
            <label htmlFor="admin-payment-state">Trạng thái</label>
            <select
              id="admin-payment-state"
              value={statusFilter}
              onChange={(e) => { setLoading(true); setPage(1); setStatusFilter(e.target.value); }}
              className="admin-select"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="success">Đã thu tiền</option>
              <option value="pending">Chờ xác nhận</option>
              <option value="failed">Thất bại</option>
            </select>
          </div>
        </div>

        {/* PAYMENTS TABLE */}
        <div className="admin-table-wrap" role="region" aria-label="Bảng thanh toán" tabIndex={0}>
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
              {loading || error || payments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="admin-empty">
                    {loading ? "Đang tải dữ liệu giao dịch..." : error ? "Chưa thể hiển thị danh sách giao dịch." : "Không có giao dịch nào phù hợp."}
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
                        <button className="workspace-link" onClick={() => navigate("orders", { search: p.order_id!._id })}>#{p.order_id._id.slice(-8).toUpperCase()}</button>
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
                      {p.order_id?.payment_status === "refunded" && <p>Đơn đã hoàn tiền: {formatPrice(p.order_id.refund?.amount ?? 0)}<br/><small>Mã hoàn: {p.order_id.refund?.reference}</small></p>}
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
        <AdminPagination page={page} pagination={pagination} loading={loading} onPage={(value) => { setPage(value); setLoading(true); }} />
      </div>
    </div>
  );
}
