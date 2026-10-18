"use client";

import Link from "next/link";
import FraudWarning from "@/components/layout/FraudWarning";
import OrderSummary from "@/components/cart/OrderSummary";
import ProductCard from "@/components/product/ProductCard";
import { formatVnd, products } from "@/data/products";
import { saveCartItems, useCartItems } from "@/lib/storefront-demo";

import "./cart.css";

export default function CartPage() {
  const cartItems = useCartItems();
  const total = cartItems.reduce((sum, item) => {
    const product = products.find((candidate) => candidate.id === item.productId);
    return sum + (product?.price ?? 0) * item.quantity;
  }, 0);

  function changeQuantity(productId: string, size: string, color: string | undefined, change: number) {
    const nextItems = cartItems
      .map((item) => item.productId === productId && item.size === size && item.color === color
        ? { ...item, quantity: Math.max(0, item.quantity + change) }
        : item)
      .filter((item) => item.quantity > 0);
    saveCartItems(nextItems);
  }

  return (
    <div className="container">
      <FraudWarning />
      <h1 className="page-title">Giỏ hàng</h1>
      {!cartItems.length ? (
        <div className="empty-state cart-empty">
          <h2>Giỏ hàng của bạn đang trống</h2>
          <p>Khám phá sản phẩm mới và chọn món đồ yêu thích nhé.</p>
          <Link className="pill-button dark" href="/products">Tiếp tục mua sắm</Link>
        </div>
      ) : (
      <div className="two-column">
        <section>
          {cartItems.map((item) => {
            const product = products.find((candidate) => candidate.id === item.productId);
            if (!product) return null;
            return (
              <article className="cart-item" key={`${item.productId}-${item.size}-${item.color ?? ""}`}>
                <Link href={`/product/${product.id}`}><img src={product.image} alt={product.name} /></Link>
                <div>
                  <Link href={`/product/${product.id}`}><strong>{product.name}</strong></Link>
                  <p className="product-meta">Màu sắc: {item.color ?? product.color}</p>
                  <p className="product-meta">Kích cỡ: {item.size}</p>
                  <div className="price">{formatVnd(product.price)}</div>
                  <div className="quantity">
                    <button aria-label="Giảm số lượng" onClick={() => changeQuantity(item.productId, item.size, item.color, -1)}>−</button>
                    <span>{item.quantity}</span>
                    <button aria-label="Tăng số lượng" onClick={() => changeQuantity(item.productId, item.size, item.color, 1)}>+</button>
                  </div>
                  <p><button className="text-button" onClick={() => changeQuantity(item.productId, item.size, item.color, -item.quantity)}>Xóa</button></p>
                </div>
                <div className="item-price"><strong>{formatVnd(product.price * item.quantity)}</strong></div>
              </article>
            );
          })}
          <p className="small muted">Đủ điều kiện áp dụng miễn phí vận chuyển theo chính sách cửa hàng.</p>
        </section>
        <OrderSummary total={total} itemCount={cartItems.reduce((sum, item) => sum + item.quantity, 0)} />
      </div>
      )}
      {cartItems.length > 0 && (
        <>
          <section>
            <h2 className="section-title">Có thể bạn sẽ thích</h2>
            <div className="product-grid">{products.slice(0, 3).map(p => <ProductCard key={p.id} product={p} />)}</div>
          </section>
          <p style={{ textAlign: "center", marginTop: 32 }}>
            <Link className="pill-button" href="/products">Tiếp tục mua sắm</Link>
          </p>
        </>
      )}
    </div>
  );
}
