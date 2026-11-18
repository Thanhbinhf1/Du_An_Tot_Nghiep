"use client";

import React from "react";
import type { OrderPaymentStatus } from "@/lib/order-api";

export type OrderItem = {
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
  order_status: "pending" | "processing" | "shipping" | "completed" | "cancelled";
  payment_status: OrderPaymentStatus;
  payment_method: string;
  transaction_id?: string;
  note?: string;
  created_at: string;
  items: OrderItem[];
};

export default function OrderInvoiceModal({
  order,
  onClose,
}: {
  order: FullAdminOrder;
  onClose: () => void;
}) {
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
        aria-modal="true"
      >
        <div className="admin-invoice-actions no-print">
          <button
            type="button"
            className="admin-button print-btn"
            onClick={handlePrint}
          >
            🖨️ In hóa đơn (A4)
          </button>
          <button type="button" className="admin-close-btn" onClick={onClose}>
            ✕ Đóng
          </button>
        </div>

        <div className="admin-invoice-sheet printable-area">
          <header className="invoice-header">
            <div className="invoice-brand">
              <h2>F.STYLE STORE</h2>
              <p>Thời trang hiện đại & Đẳng cấp tối giản</p>
              <small>Số 68 Đường Cầu Giấy, Quận Cầu Giấy, TP. Hà Nội</small>
              <br />
              <small>Hotline: 1900 6868 · Email: support@fstyle.vn</small>
            </div>
            <div className="invoice-meta">
              <h1>HÓA ĐƠN BÁN HÀNG</h1>
              <p className="invoice-code">
                Mã đơn: #{order._id.slice(-8).toUpperCase()}
              </p>
              <p>
                Ngày đặt:{" "}
                {new Date(order.created_at).toLocaleString("vi-VN")}
              </p>
              <p>
                PTTT: <strong>{order.payment_method}</strong> ({order.payment_status})
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
                  {order.order_status.toUpperCase()}
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
            <div className="summary-notes">
              <p>
                * Cảm ơn quý khách đã mua sắm tại <strong>F.Style Store</strong>!
              </p>
              <p>* Quý khách vui lòng kiểm tra sản phẩm trước khi nhận hàng.</p>
              <p>* Hỗ trợ đổi trả miễn phí trong vòng 30 ngày với tem mác nguyên vẹn.</p>
            </div>
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
              <p>F.Style Store</p>
              <small>(Thủ kho xuất hàng)</small>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
