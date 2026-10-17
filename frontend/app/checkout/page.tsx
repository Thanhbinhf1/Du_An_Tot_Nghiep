"use client";

import { useState } from "react";
import FraudWarning from "@/components/layout/FraudWarning";
import OrderSummary from "@/components/cart/OrderSummary";
import { products } from "@/data/products";

import "./checkout.css";

export default function CheckoutPage() {
  const [delivery, setDelivery] = useState<"address" | "pickup">("address");
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [continued, setContinued] = useState(false);
  const total = products[1].price;

  return (
    <div className="container">
      <FraudWarning />
      <h1 className="page-title">Thanh toán</h1>
      <p className="small">Đủ điều kiện áp dụng miễn phí vận chuyển.</p>
      <div className="two-column">
        <section>
          <h2 className="section-title">1. Tùy chọn giao hàng</h2>
          <div className="checkout-methods">
            <button className={`method ${delivery === "address" ? "selected" : ""}`} onClick={() => setDelivery("address")}>
              <strong>Giao đến địa chỉ</strong><br /><span className="small">Phí vận chuyển: Miễn phí</span>
            </button>
            <button className={`method ${delivery === "pickup" ? "selected" : ""}`} onClick={() => setDelivery("pickup")}>
              <strong>Click & Collect</strong><br /><span className="small">Phí vận chuyển: Miễn phí</span>
            </button>
          </div>
          <h2 className="section-title">{delivery === "address" ? "Địa chỉ giao hàng" : "Chọn cửa hàng nhận hàng"}</h2>
          {delivery === "address" ? (
            <div className="address-card">
              <label><input type="radio" name="address" defaultChecked /> Thanh Nguyen (Địa chỉ thành viên)</label>
              <p> Xã Vĩnh Lộc<br />Phường Trà Câu, Tỉnh Quảng Ngãi<br />Thành phố Hồ Chí Minh<br />0867446106</p>
              <button className="text-button" onClick={() => setShowAddressForm(v => !v)}>Chỉnh sửa địa chỉ thành viên</button>
              {showAddressForm && (
                <div>
                  <label className="form-field">Họ tên<input defaultValue="Thanh Nguyen" /></label>
                  <label className="form-field">Địa chỉ<input placeholder="Nhập địa chỉ giao hàng" /></label>
                  <label className="form-field">Số điện thoại<input placeholder="Nhập số điện thoại" /></label>
                </div>
              )}
              <p><button className="pill-button" onClick={() => setShowAddressForm(true)}>Đăng ký địa chỉ mới</button></p>
            </div>
          ) : (
            <label className="form-field">Cửa hàng nhận hàng<select defaultValue=""><option value="" disabled>Chọn cửa hàng</option><option>UNIQLO Đồng Khởi</option><option>UNIQLO Vincom</option></select></label>
          )}
          <button className="pill-button dark" onClick={() => setContinued(true)}>Tiếp tục</button>
          {continued && <p className="small">Đã lưu lựa chọn giao hàng demo. Bước tiếp theo cần API Backend.</p>}
          <h2 className="section-title" style={{ color: continued ? "#111" : "#aaa" }}>2. Phương thức thanh toán</h2>
          <p className="small muted">Vui lòng hoàn thành bước giao hàng trước khi chọn phương thức thanh toán.</p>
          {continued && <div className="panel"><label><input type="radio" name="payment" defaultChecked /> Thanh toán khi nhận hàng</label></div>}
          <p className="small">♙ Thông tin cá nhân được bảo vệ khi truyền tải bằng kết nối an toàn.</p>
        </section>
        <OrderSummary total={total} checkout />
      </div>
    </div>
  );
}
