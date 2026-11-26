"use client";

import { useEffect, useState } from "react";
import type { AdminRequest } from "./ProductVariantsManager";
import { orderStatusText, paymentMethodText, paymentStatusText, type PaymentMethod } from "@/lib/order-api";
import type { OrderPaymentStatus } from "@/lib/order-api";

export type OrderItem = {
  _id?: string;
  product_name: string;
  sku: string;
  size: string;
  color: string;
  quantity: number;
  price_at_buy?: number;
};

export type FullAdminOrder = {
  _id: string;
  user_id: { name: string; email: string; phone?: string } | null;
  receiver_name: string;
  receiver_phone: string;
  shipping_address: string;
  shipping_method?: string;
  total_product_amount?: number;
  discount_amount?: number;
  shipping_fee?: number;
  final_amount: number;
  order_status: import("@/lib/order-api").OrderStatus;
  delivery_incidents?: { reason: string; note: string; at: string }[];
  refund?: { amount: number; reference: string; note: string; at: string };
  payment_status: OrderPaymentStatus;
  payment_method: PaymentMethod;
  transaction_id?: string;
  note?: string;
  created_at: string;
  items: OrderItem[];
};

export default function OrderInvoiceModal({
  order,
  request,
  onClose,
}: {
  order: FullAdminOrder;
  request: AdminRequest;
  onClose: () => void;
}) {
  type Store = { store_name: string; address: string; hotline: string; email: string };
  const [store, setStore] = useState<Store>();
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    request<Store>("/admin/settings", { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setStore(data); })
      .catch(() => { if (!controller.signal.aborted) setError("Không tải được thông tin cửa hàng để in phiếu."); });
    return () => controller.abort();
  }, [request, revision]);
  const collectCOD = order.payment_method === "COD" && order.payment_status === "pending"
    && ["pending", "processing", "shipping"].includes(order.order_status);
  const formatPrice = (value: number) =>
    `${new Intl.NumberFormat("vi-VN").format(value)} đ`;

  const subtotal =
    order.total_product_amount ??
    order.items.reduce(
      (sum, item) => sum + (item.price_at_buy ?? 0) * item.quantity,
      0,
    );
  const discount = order.discount_amount ?? 0;
  const shippingFee = order.shipping_fee ?? 0;
  const finalAmount = order.final_amount;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="admin-modal-backdrop" onClick={onClose}>
      <div
        className="admin-invoice-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Phiếu đơn hàng"
        aria-modal="true"
      >
        <div className="admin-invoice-actions no-print">
          <button
            type="button"
            className="admin-button print-btn"
            onClick={handlePrint} disabled={!store}
          >
            In phiếu đơn hàng (A4)
          </button>
          <button type="button" className="admin-close-btn" onClick={onClose}>
            ✕ Đóng
          </button>
        </div>

        {error && <p role="alert" className="admin-alert">{error} <button onClick={() => { setError(""); setRevision(v => v + 1); }}>Thử lại</button></p>}
        <div className="admin-invoice-sheet printable-area">
          <header className="invoice-header">
            <div className="invoice-brand">
              <h2>{store?.store_name}</h2>
              <p>{store?.address}</p>
              <small>{[store?.hotline, store?.email].filter(Boolean).join(" · ")}</small>
            </div>
            <div className="invoice-meta">
              <h1>PHIẾU ĐƠN HÀNG</h1>
              <p className="invoice-code">
                Mã đơn: #{order._id.slice(-8).toUpperCase()}
              </p>
              <p>
                Ngày đặt:{" "}
                {new Date(order.created_at).toLocaleString("vi-VN")}
              </p>
              <p>
                PTTT: <strong>{paymentMethodText[order.payment_method]}</strong> ({paymentStatusText[order.payment_status]})
              </p>
            </div>
          </header>

          <hr className="invoice-divider" />

          <section className="invoice-parties">
            <div className="party-box">
              <h3>Thông tin người nhận</h3>
              <p>
                <strong>Họ tên:</strong> {order.receiver_name}
              </p>
              <p>
                <strong>Điện thoại:</strong> {order.receiver_phone}
              </p>
              <p>
                <strong>Địa chỉ:</strong> {order.shipping_address || "Tại quầy / Cửa hàng"}
              </p>
              {order.note && (
                <p>
                  <strong>Ghi chú:</strong> {order.note}
                </p>
              )}
            </div>
            <div className="party-box">
              <h3>Thông tin vận đơn</h3>
              <p>
                <strong>Hình thức:</strong>{" "}
                {order.shipping_method === "Express" ? "Giao hàng hỏa tốc" : order.shipping_method === "Standard" || !order.shipping_method ? "Giao hàng tiêu chuẩn" : order.shipping_method}
              </p>
              <p>
                <strong>Trạng thái đơn:</strong>{" "}
                <span className={`status-tag status-${order.order_status}`}>
                  {orderStatusText[order.order_status]}
                </span>
              </p>
              {order.transaction_id && (
                <p>
                  <strong>Mã GD:</strong> {order.transaction_id}
                </p>
              )}
            </div>
          </section>

          <section className="invoice-items">
            <table className="invoice-table">
              <thead>
                <tr>
                  <th style={{ width: "40px" }}>STT</th>
                  <th>Tên sản phẩm</th>
                  <th>Mã SKU</th>
                  <th>Phân loại</th>
                  <th style={{ textAlign: "right" }}>Số lượng</th>
                  <th style={{ textAlign: "right" }}>Đơn giá</th>
                  <th style={{ textAlign: "right" }}>Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item, index) => {
                  const price = item.price_at_buy ?? 0;
                  const itemTotal = price * item.quantity;
                  return (
                    <tr key={`${item.sku}-${index}`}>
                      <td style={{ textAlign: "center" }}>{index + 1}</td>
                      <td>
                        <strong>{item.product_name}</strong>
                      </td>
                      <td>{item.sku}</td>
                      <td>
                        {item.size} / {item.color}
                      </td>
                      <td style={{ textAlign: "right" }}>{item.quantity}</td>
                      <td style={{ textAlign: "right" }}>
                        {price > 0 ? formatPrice(price) : "—"}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {itemTotal > 0 ? formatPrice(itemTotal) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          <section className="invoice-summary-box">
            <div className="summary-notes"><p>Thu hộ khi giao hàng</p><strong>{formatPrice(collectCOD ? finalAmount : 0)}</strong></div>
            <div className="summary-numbers">
              <div className="summary-row">
                <span>Tạm tính hàng:</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="summary-row discount">
                  <span>Giảm giá (Coupon/Combo):</span>
                  <span>-{formatPrice(discount)}</span>
                </div>
              )}
              <div className="summary-row">
                <span>Phí vận chuyển:</span>
                <span>{shippingFee > 0 ? formatPrice(shippingFee) : "Miễn phí"}</span>
              </div>
              <div className="summary-row total">
                <span>TỔNG THANH TOÁN:</span>
                <strong>{formatPrice(finalAmount)}</strong>
              </div>
            </div>
          </section>

          <footer className="invoice-signatures">
            <div className="sig-block">
              <p>Khách hàng</p>
              <small>(Ký và ghi rõ họ tên)</small>
            </div>
            <div className="sig-block">
              <p>Nhân viên giao nhận</p>
              <small>(Ký và ghi rõ họ tên)</small>
            </div>
            <div className="sig-block">
              <p>{store?.store_name}</p>
              <small>(Thủ kho xuất hàng)</small>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
