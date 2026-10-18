"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import FraudWarning from "@/components/layout/FraudWarning";
import OrderSummary from "@/components/cart/OrderSummary";
import { formatVnd } from "@/data/products";
import { createDemoOrder, saveDemoAddress, useCartItems, useDemoAddress } from "@/lib/storefront-demo";
import { useCatalogProducts } from "@/lib/useCatalogProducts";

import "./checkout.css";

export default function CheckoutPage() {
  const savedAddress = useDemoAddress();
  return <CheckoutContent key={JSON.stringify(savedAddress)} initialAddress={savedAddress} />;
}

function CheckoutContent({
  initialAddress,
}: {
  initialAddress: { name?: string; phone?: string; address?: string };
}) {
  const router = useRouter();
  const cartItems = useCartItems();
  const { products } = useCatalogProducts();
  const [delivery, setDelivery] = useState<"address" | "pickup">("address");
  const [name, setName] = useState(initialAddress.name ?? "");
  const [phone, setPhone] = useState(initialAddress.phone ?? "");
  const [address, setAddress] = useState(initialAddress.address ?? "");
  const [store, setStore] = useState("");
  const total = cartItems.reduce((sum, item) => {
    const product = products.find((candidate) => candidate.id === item.productId);
    return sum + (product?.price ?? 0) * item.quantity;
  }, 0);

  function placeOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (delivery === "address") saveDemoAddress({ name, phone, address });
    const order = createDemoOrder(
      products,
      { name: delivery === "address" ? name : "Nhận tại cửa hàng", phone, address: delivery === "address" ? address : store },
      delivery === "address" ? "Giao đến địa chỉ" : "Nhận tại cửa hàng",
    );
    if (order) router.push(`/order-confirmation?id=${encodeURIComponent(order.id)}`);
  }

  if (!cartItems.length) {
    return (
      <div className="container checkout-empty">
        <h1 className="page-title">Chưa có sản phẩm để thanh toán</h1>
        <p className="muted">Thêm sản phẩm vào giỏ hàng trước khi tiếp tục.</p>
        <Link className="pill-button dark" href="/products">Khám phá sản phẩm</Link>
      </div>
    );
  }

  return (
    <div className="container checkout-page">
      <FraudWarning />
      <div className="checkout-title">
        <div><div className="breadcrumb"><Link href="/cart">Giỏ hàng</Link> / Thanh toán</div><h1 className="page-title">Thanh toán</h1></div>
        <Link href="/cart">← Quay lại giỏ hàng</Link>
      </div>
      <p className="small">Đơn hàng đủ điều kiện miễn phí vận chuyển.</p>
      <div className="two-column">
        <form className="checkout-form" onSubmit={placeOrder}>
          <h2 className="section-title">1. Tùy chọn giao hàng</h2>
          <div className="checkout-methods">
            <button type="button" className={`method ${delivery === "address" ? "selected" : ""}`} onClick={() => setDelivery("address")}>
              <strong>Giao đến địa chỉ</strong><br /><span className="small">Miễn phí vận chuyển</span>
            </button>
            <button type="button" className={`method ${delivery === "pickup" ? "selected" : ""}`} onClick={() => setDelivery("pickup")}>
              <strong>Nhận tại cửa hàng</strong><br /><span className="small">Click & Collect miễn phí</span>
            </button>
          </div>
          {delivery === "address" ? (
            <div className="checkout-fields">
              <h2 className="section-title">Thông tin giao hàng</h2>
              <label className="form-field">Họ và tên<input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required /></label>
              <label className="form-field">Số điện thoại<input value={phone} onChange={(event) => setPhone(event.target.value)} type="tel" autoComplete="tel" required /></label>
              <label className="form-field">Địa chỉ nhận hàng<textarea value={address} onChange={(event) => setAddress(event.target.value)} autoComplete="street-address" required rows={3} /></label>
            </div>
          ) : (
            <label className="form-field">Cửa hàng nhận hàng<select value={store} onChange={(event) => setStore(event.target.value)} required><option value="" disabled>Chọn cửa hàng</option><option>VCS BAPD quận 12</option><option>VCS BAPD quận gò vấp</option><option>VCS BAPD AEON MALL</option></select></label>
          )}
          <h2 className="section-title">2. Phương thức thanh toán</h2>
          <div className="panel"><label><input type="radio" name="payment" defaultChecked /> Thanh toán khi nhận hàng (COD)</label></div>
          <p className="small muted">Đây là đơn hàng minh họa; chưa gửi yêu cầu tới hệ thống thanh toán.</p>
          <button className="pill-button dark place-order-button" type="submit">Đặt hàng · {formatVnd(total)}</button>
        </form>
        <aside>
          <OrderSummary total={total} checkout itemCount={cartItems.reduce((sum, item) => sum + item.quantity, 0)} />
          <div className="checkout-items">
            <h2>Sản phẩm trong đơn hàng</h2>
            {cartItems.map((item) => {
              const product = products.find((candidate) => candidate.id === item.productId);
              if (!product) return null;
              return <div className="checkout-item" key={`${item.productId}-${item.size}-${item.color ?? ""}`}><span>{product.name} · {item.color ?? product.color} · {item.size} × {item.quantity}</span><strong>{formatVnd(product.price * item.quantity)}</strong></div>;
            })}
          </div>
        </aside>
      </div>
    </div>
  );
}
