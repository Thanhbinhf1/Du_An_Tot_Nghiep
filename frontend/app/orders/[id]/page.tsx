"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useDemoAuth } from "@/lib/demo-auth";
import CancelOrderButton from "@/components/orders/CancelOrderButton";
import RequestReturnButton from "@/components/orders/RequestReturnButton";
import { formatVnd } from "@/data/products";
import {
  getBackendOrder,
  orderStatusText,
  paymentMethodText,
  paymentStatusText,
  type BackendOrderDetail,
} from "@/lib/order-api";
import { createOnlineCheckout } from "@/lib/online-checkout";

const steps = [
  { key: "pending", label: "Chờ xác nhận" },
  { key: "processing", label: "Đang chuẩn bị" },
  { key: "shipping", label: "Đang giao hàng" },
  { key: "completed", label: "Hoàn thành" },
];

export default function OrderDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const { token, account, isHydrated } = useDemoAuth();
  if (!isHydrated) return <div className="container" style={{ padding: 40 }}><p role="status">Đang kiểm tra đăng nhập...</p></div>;
  if (!token) {
    return (
      <section className="container store-state">
        <h1 className="page-title">Chi tiết đơn hàng</h1>
        <p>Vui lòng đăng nhập để xem chi tiết và tiến trình đơn hàng của bạn.</p>
        <Link href="/dang-nhap" className="pill-button dark-pill">Đăng nhập ngay</Link>
      </section>
    );
  }
  return <OrderDetails key={`${id}:${token}`} id={id} token={token} userEmail={account} />;
}

function OrderDetails({ id, token, userEmail }: { id: string; token: string; userEmail?: string }) {
  const router = useRouter();
  const [order, setOrder] = useState<BackendOrderDetail>();
  const [error, setError] = useState("");
  const [cancelMessage, setCancelMessage] = useState("");
  const [paying, setPaying] = useState(false);

  const loadOrder = useCallback(() => {
    getBackendOrder(id, token)
      .then((data) => setOrder(data))
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "Không thể tải đơn hàng.");
      });
  }, [id, token]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  useEffect(() => {
    if (order && window.location.hash === "#danh-gia") {
      document.getElementById("danh-gia")?.scrollIntoView({ behavior: "instant" });
    }
  }, [order]);

  function handleCancelled() {
    setError("");
    setCancelMessage("Đã hủy đơn hàng thành công.");
    loadOrder();
  }

  async function handleResumePayment() {
    if (!order || paying) return;
    setPaying(true);
    setError("");
    try {
      if (order.payment_method === "BankTransfer") {
        router.push(`/payment/bank-transfer?orderId=${encodeURIComponent(order._id)}`);
        return;
      }
      const url = await createOnlineCheckout(order._id, order.payment_method, token);
      window.location.assign(url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể mở cổng thanh toán.");
      setPaying(false);
    }
  }

  const currentStepIndex = order
    ? order.order_status === "cancelled"
      ? -1
      : steps.findIndex((s) => s.key === order.order_status)
    : 0;

  const canCancel = order?.actions?.cancel;
  const canPay = order?.actions?.pay;

  return (
    <article className="container" style={{ paddingTop: 28, paddingBottom: 64, maxWidth: 920 }}>
      <div className="breadcrumb" style={{ marginBottom: 16 }}>
        <Link href="/">Trang chủ</Link> / <Link href="/orders">Đơn hàng của tôi</Link> /{" "}
        <span>Chi tiết đơn #{id.slice(-8).toUpperCase()}</span>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <h1 className="page-title" style={{ margin: "8px 0" }}>
          Chi tiết đơn hàng #{id.slice(-8).toUpperCase()}
        </h1>
        <Link href="/orders" className="pill-button small-pill">
          ← Danh sách đơn hàng
        </Link>
      </div>

      {error && <div className="cart-error-banner" role="alert"><p>{error}</p></div>}
      {cancelMessage && <div className="product-added-message" role="status"><p>{cancelMessage}</p></div>}
      {!order && !error && <p role="status">Đang tải chi tiết đơn hàng...</p>}

      {order && (
        <div style={{ display: "grid", gap: 24, marginTop: 12 }}>
          {/* TIẾN TRÌNH ĐƠN HÀNG (TIMELINE TRACKING) */}
          <div className="panel tracking-card" style={{ padding: 24, background: "#fff", border: "1px solid #e0e0e0" }}>
            <h2 style={{ fontSize: 16, margin: "0 0 16px" }}>Tiến trình đơn hàng</h2>
            {["cancelled", "delivery_failed", "returning", "returned"].includes(order.order_status) ? (
              <div style={{ padding: 14, background: "#fff1f0", color: "#b42318", borderRadius: 4, fontWeight: 600 }}>
                {orderStatusText[order.order_status]}. {order.order_status === "delivery_failed" ? "Shop sẽ liên hệ để thống nhất giao lại hoặc hoàn hàng." : order.order_status === "returning" ? "Đơn đang được chuyển về shop để kiểm tra." : order.order_status === "returned" ? "Shop đã nhận và kiểm tra hàng hoàn; khoản hoàn tiền (nếu có) sẽ được đối soát riêng." : "Đơn hàng đã dừng xử lý."}
              </div>
            ) : (
              <div className="tracking-steps" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                {steps.map((step, index) => {
                  const isDone = index <= currentStepIndex;
                  return (
                    <div
                      key={step.key}
                      style={{
                        borderTop: isDone ? "3px solid #267844" : "3px solid #e2e2e2",
                        paddingTop: 8,
                        color: isDone ? "#267844" : "#888",
                        fontSize: 12,
                        fontWeight: isDone ? 700 : 500,
                      }}
                    >
                      <span>{step.label}</span>
                    </div>
                  );
                })}
              </div>
            )}
            {order.cancellation_reason && <div style={{ marginTop: 12 }}><strong>Lý do hủy đơn</strong><p>{order.cancellation_reason}</p></div>}
          </div>

          {/* THÔNG TIN GIAO NHẬN & THANH TOÁN */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 16,
            }}
          >
            <div className="panel" style={{ padding: 20, background: "#fff", border: "1px solid #e0e0e0" }}>
              <h3 style={{ fontSize: 15, margin: "0 0 12px", fontWeight: 600 }}>Thông tin nhận hàng</h3>
              <p style={{ margin: "4px 0", fontSize: 13 }}>
                Người nhận: <strong>{order.receiver_name}</strong>
              </p>
              <p style={{ margin: "4px 0", fontSize: 13 }}>
                Số điện thoại: <strong>{order.receiver_phone}</strong>
              </p>
              <p style={{ margin: "4px 0", fontSize: 13, color: "#555" }}>
                Địa chỉ: {order.shipping_address}
              </p>
              {order.note && (
                <p style={{ margin: "8px 0 0", fontSize: 12, color: "#666" }}>
                  Ghi chú: {order.note}
                </p>
              )}
            </div>

            <div className="panel" style={{ padding: 20, background: "#fff", border: "1px solid #e0e0e0" }}>
              <h3 style={{ fontSize: 15, margin: "0 0 12px", fontWeight: 600 }}>Thanh toán & Vận chuyển</h3>
              <p style={{ margin: "4px 0", fontSize: 13 }}>
                Phương thức: <strong>{paymentMethodText[order.payment_method] ?? order.payment_method}</strong>
              </p>
              <p style={{ margin: "4px 0", fontSize: 13 }}>
                Trạng thái thanh toán:{" "}
                <span
                  style={{
                    color: order.payment_status === "success" ? "#267844" : "#b42318",
                    fontWeight: 700,
                  }}
                >
                  {paymentStatusText[order.payment_status] ?? order.payment_status}
                </span>
              </p>
              <p style={{ margin: "4px 0", fontSize: 13 }}>
                Trạng thái đơn hàng: <strong>{orderStatusText[order.order_status] ?? order.order_status}</strong>
              </p>
              {order.payment_status === "refunded" && order.refund && <p>Số tiền đã hoàn <strong>{formatVnd(order.refund.amount)}</strong></p>}

              <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
                {canPay && (
                  <button
                    type="button"
                    className="pill-button dark small-pill"
                    disabled={paying}
                    onClick={handleResumePayment}
                  >
                    {paying ? "Đang xử lý..." : "Tiếp tục thanh toán"}
                  </button>
                )}
                {canCancel && (
                  <CancelOrderButton orderId={id} token={token} onCancelled={handleCancelled} />
                )}
                {order.order_status === "completed" && (
                  <RequestReturnButton
                    orderId={order._id}
                    receiverName={order.receiver_name}
                    userEmail={userEmail}
                    token={token}
                    onSubmitted={(ticketId) => setCancelMessage(`Đã gửi yêu cầu đổi/trả hàng thành công (Mã hồ sơ: ${ticketId}).`)}
                  />
                )}
                {["SePay", "MoMo", "BankTransfer"].includes(order.payment_method) && (
                  <Link
                    href={`/payment/result?orderId=${encodeURIComponent(order._id)}`}
                    className="pill-button small-pill"
                  >
                    Kiểm tra trạng thái thanh toán
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* DANH SÁCH SẢN PHẨM TRONG ĐƠN */}
          <div className="panel review-anchor" id="danh-gia" style={{ padding: 22, background: "#fff", border: "1px solid #e0e0e0" }}>
            <h2 style={{ fontSize: 17, margin: "0 0 16px" }}>Danh sách sản phẩm ({order.items.length})</h2>

            <div style={{ display: "grid", gap: 14 }}>
              {order.items.map((item) => (
                <div
                  key={item._id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1fr) auto",
                    gap: 16,
                    paddingBottom: 14,
                    borderBottom: "1px solid #eee",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <strong style={{ fontSize: 14, display: "block" }}>{item.product_name}</strong>
                    <div style={{ color: "#666", fontSize: 12, marginTop: 4 }}>
                      Mã SKU: {item.sku} • Màu: {item.color} • Kích cỡ: {item.size} • Số lượng: x{item.quantity}
                    </div>
                    <div style={{ marginTop: 6 }}>
                      <span className="price">{formatVnd(item.price_at_buy)}</span> / SP
                    </div>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>
                      {formatVnd(item.price_at_buy * item.quantity)}
                    </div>
                    {item.review_product_id ? (
                      <Link
                        href={`/product/${encodeURIComponent(item.review_product_id)}#product-reviews`}
                        scroll={false}
                        className="pill-button small-pill"
                        style={{ marginTop: 8 }}
                      >
                        ★ Đánh giá sản phẩm
                      </Link>
                    ) : order.order_status === "completed" && (
                      <p className="small muted" style={{ margin: "8px 0 0" }}>Sản phẩm hiện không mở đánh giá.</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 18, textAlign: "right", borderTop: "2px solid #111", paddingTop: 14 }}>
              {order.total_product_amount != null && <p>Tiền hàng {formatVnd(order.total_product_amount)}</p>}
              {order.shipping_fee != null && <p>Phí giao hàng{order.shipping_method === "Express" ? " hỏa tốc" : ""} {formatVnd(order.shipping_fee)}</p>}
              {Boolean(order.discount_amount) && <p>Giảm giá −{formatVnd(order.discount_amount ?? 0)}</p>}
              <span className="small muted">Tổng số tiền thanh toán</span>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#e60012", marginTop: 4 }}>
                {formatVnd(order.final_amount)}
              </div>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}
