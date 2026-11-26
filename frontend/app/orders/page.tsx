"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

import { useDemoAuth } from "@/lib/demo-auth";
import CancelOrderButton from "@/components/orders/CancelOrderButton";
import {
  getMyBackendOrders,
  orderStatusText,
  paymentStatusText,
  paymentMethodText,
  type BackendOrder,
  type OrderStatus,
} from "@/lib/order-api";
import { formatVnd } from "@/data/products";
import { createOnlineCheckout } from "@/lib/online-checkout";

const orderTabs: { id: "all" | OrderStatus; label: string }[] = [
  { id: "all", label: "Tất cả" },
  { id: "pending", label: "Chờ xác nhận" },
  { id: "processing", label: "Đang chuẩn bị" },
  { id: "shipping", label: "Đang giao" },
  { id: "delivery_failed", label: "Giao thất bại" },
  { id: "returning", label: "Đang hoàn về" },
  { id: "returned", label: "Đã hoàn hàng" },
  { id: "completed", label: "Hoàn thành" },
  { id: "cancelled", label: "Đã hủy" },
];

export default function BackendOrdersPage() {
  const { token, isHydrated } = useDemoAuth();
  if (!isHydrated) {
    return <section className="container" style={{ padding: "40px 0" }}><p role="status">Đang kiểm tra đăng nhập...</p></section>;
  }
  if (!token) {
    return <section className="container checkout-empty" style={{ padding: "40px 0" }}>
      <h1 className="page-title">Đơn hàng của tôi</h1>
      <p>Vui lòng đăng nhập để xem lịch sử đơn hàng của bạn.</p>
      <Link href="/dang-nhap" className="pill-button dark">Đăng nhập ngay</Link>
    </section>;
  }
  return <AccountOrders key={token} token={token} />;
}

function AccountOrders({ token }: { token: string }) {
  const mounted = useRef(false);
  const [orders, setOrders] = useState<BackendOrder[]>([]);
  const [activeTab, setActiveTab] = useState<"all" | OrderStatus>("all");
  const [loadedToken, setLoadedToken] = useState("");
  const [error, setError] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [payingOrder, setPayingOrder] = useState("");
  const [cancelSuccess, setCancelSuccess] = useState("");

  const loadOrders = useCallback((signal?: AbortSignal) => {
    if (!token) return;
    getMyBackendOrders(token, signal)
      .then((data) => {
        if (signal?.aborted) return;
        setOrders(data);
        setLoadedToken(token);
        setError("");
      })
      .catch((cause: unknown) => {
        if (signal?.aborted) return;
        setLoadedToken(token);
        setError(cause instanceof Error ? cause.message : "Không thể tải đơn hàng.");
      });
  }, [token]);

  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    loadOrders(controller.signal);
    return () => { mounted.current = false; controller.abort(); };
  }, [loadOrders]);

  async function resumePayment(order: BackendOrder) {
    if (!token || payingOrder) return;
    setPayingOrder(order._id);
    setPaymentError("");
    try {
      const destination = await createOnlineCheckout(order._id, order.payment_method, token);
      if (mounted.current) window.location.assign(destination);
    } catch (cause) {
      if (!mounted.current) return;
      setPaymentError(cause instanceof Error ? cause.message : "Không thể mở cổng thanh toán.");
      setPayingOrder("");
    }
  }

  function handleCancelled() {
    if (!mounted.current) return;
    setCancelSuccess("Đã hủy đơn hàng thành công.");
    loadOrders();
  }

  const filteredOrders = useMemo(() => {
    if (activeTab === "all") return orders;
    return orders.filter((o) => o.order_status === activeTab);
  }, [orders, activeTab]);

  const loading = loadedToken !== token;

  return (
    <section className="container store-orders" style={{ paddingTop: 28, paddingBottom: 64 }}>
      <div className="breadcrumb" style={{ marginBottom: 12 }}>
        <Link href="/">Trang chủ</Link> / <Link href="/profile">Tài khoản</Link> / <span>Đơn hàng</span>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <h1 className="page-title" style={{ margin: "8px 0" }}>
          Quản lý đơn hàng ({orders.length})
        </h1>
        <Link href="/products" className="pill-button small-pill">
          + Mua sắm thêm
        </Link>
      </div>

      {/* TABS TRẠNG THÁI ĐƠN HÀNG */}
      <div
        className="tabs"
        role="tablist"
        aria-label="Lọc trạng thái đơn hàng"
        style={{ display: "flex", overflowX: "auto", paddingBottom: 2, marginBottom: 20 }}
      >
        {orderTabs.map((tab) => {
          const count =
            tab.id === "all" ? orders.length : orders.filter((o) => o.order_status === tab.id).length;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`tab${isActive ? " active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
              style={{ whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6 }}
            >
              <span>{tab.label}</span>
              {count > 0 && (
                <span
                  style={{
                    fontSize: 11,
                    padding: "1px 6px",
                    borderRadius: 999,
                    background: isActive ? "#111" : "#eee",
                    color: isActive ? "#fff" : "#555",
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {loading && <p role="status">Đang tải danh sách đơn hàng...</p>}
      {paymentError && <p className="cart-error-banner" role="alert">{paymentError}</p>}
      {cancelSuccess && <p className="product-added-message" role="status">{cancelSuccess}</p>}
      {error && <p className="cart-error-banner" role="alert">{error}</p>}

      {!loading && !error && filteredOrders.length === 0 && (
        <div className="empty-state" style={{ margin: "24px 0" }}>
          <h2>Chưa có đơn hàng nào</h2>
          <p>
            {activeTab === "all"
              ? "Bạn chưa đặt đơn hàng nào trên VSC_BAPD. Hãy khám phá bộ sưu tập mới nhé!"
              : `Hiện không có đơn hàng nào ở trạng thái "${orderStatusText[activeTab as OrderStatus]}".`}
          </p>
          <Link className="pill-button dark" href="/products" style={{ marginTop: 12 }}>
            Khám phá sản phẩm VSC_BAPD
          </Link>
        </div>
      )}

      {!loading && !error && filteredOrders.length > 0 && (
        <div style={{ display: "grid", gap: 18 }}>
          {filteredOrders.map((order) => {
            const canContinuePayment = order.actions?.pay;
            const canCancel = order.actions?.cancel;
            const isCompleted = order.order_status === "completed";
            const createdDate = order.created_at || order.createdAt;

            return (
              <article
                className="panel order-card"
                key={order._id}
                style={{
                  padding: 22,
                  background: "#fff",
                  border: "1px solid #e0e0e0",
                  display: "grid",
                  gap: 12,
                }}
              >
                {/* Header đơn hàng */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 10,
                    paddingBottom: 12,
                    borderBottom: "1px solid #eee",
                  }}
                >
                  <div>
                    <h2 style={{ fontSize: 16, margin: "0 0 4px", fontWeight: 700 }}>
                      Đơn hàng #{order._id.slice(-8).toUpperCase()}
                    </h2>
                    <span className="small muted">
                      Đặt lúc: {createdDate ? new Date(createdDate).toLocaleString("vi-VN") : "Gần đây"} • Mã: {order._id}
                    </span>
                  </div>

                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span
                      style={{
                        padding: "4px 10px",
                        borderRadius: 3,
                        fontSize: 12,
                        fontWeight: 600,
                        background:
                          order.order_status === "completed"
                            ? "#edf7ef"
                            : order.order_status === "cancelled"
                              ? "#fff1f0"
                              : "#f5f5f5",
                        color:
                          order.order_status === "completed"
                            ? "#267844"
                            : order.order_status === "cancelled"
                              ? "#b42318"
                              : "#111",
                      }}
                    >
                      {orderStatusText[order.order_status] ?? order.order_status}
                    </span>
                    <span
                      style={{
                        padding: "4px 10px",
                        borderRadius: 3,
                        fontSize: 12,
                        fontWeight: 600,
                        background: order.payment_status === "success" ? "#edf7ef" : "#fff8e6",
                        color: order.payment_status === "success" ? "#267844" : "#9a6700",
                      }}
                    >
                      {paymentStatusText[order.payment_status] ?? order.payment_status}
                    </span>
                  </div>
                </div>

                {/* Thông tin người nhận & Địa chỉ */}
                <div style={{ display: "grid", gap: 4, fontSize: 13, color: "#444" }}>
                  <div>
                    Người nhận: <strong>{order.receiver_name}</strong> • ĐT: {order.receiver_phone}
                  </div>
                  <div>Địa chỉ giao: {order.shipping_address}</div>
                  <div>
                    Hình thức thanh toán: <strong>{paymentMethodText[order.payment_method] ?? order.payment_method}</strong>
                  </div>
                  {order.note && <div className="small muted">Ghi chú: {order.note}</div>}
                </div>

                {/* Tổng tiền & Nút tác vụ */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 12,
                    paddingTop: 12,
                    borderTop: "1px solid #eee",
                  }}
                >
                  <div>
                    <span className="small muted" style={{ display: "block" }}>
                      Tổng tiền thanh toán
                    </span>
                    <strong style={{ fontSize: 18, color: "#e60012" }}>{formatVnd(order.final_amount)}</strong>
                  </div>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                    <Link className="pill-button small-pill" href={`/orders/${encodeURIComponent(order._id)}`}>
                      Xem chi tiết
                    </Link>

                    {/* Kiểm tra thanh toán */}
                    {["SePay", "MoMo", "BankTransfer"].includes(order.payment_method) && (
                      <Link
                        className="pill-button small-pill"
                        href={`/payment/result?orderId=${encodeURIComponent(order._id)}`}
                      >
                        Kết quả thanh toán
                      </Link>
                    )}

                    {/* Tiếp tục thanh toán BankTransfer */}
                    {canContinuePayment && order.payment_method === "BankTransfer" && (
                      <Link
                        className="pill-button dark small-pill"
                        href={`/payment/bank-transfer?orderId=${encodeURIComponent(order._id)}`}
                      >
                        Tiếp tục chuyển khoản
                      </Link>
                    )}

                    {canContinuePayment && order.payment_method !== "BankTransfer" && (
                        <button
                          type="button"
                          className="pill-button dark small-pill"
                          disabled={Boolean(payingOrder)}
                          onClick={() => void resumePayment(order)}
                        >
                          {payingOrder === order._id ? "Đang mở cổng..." : `Tiếp tục thanh toán ${order.payment_method}`}
                        </button>
                      )}

                    {/* Hủy đơn hàng */}
                    {canCancel && (
                      <CancelOrderButton orderId={order._id} token={token} onCancelled={handleCancelled} />
                    )}

                    {/* Đánh giá sản phẩm khi đơn hoàn thành */}
                    {isCompleted && (
                      <Link className="pill-button dark small-pill" href={`/orders/${encodeURIComponent(order._id)}#danh-gia`} scroll={false}>
                        ★ Chọn sản phẩm để đánh giá
                      </Link>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
