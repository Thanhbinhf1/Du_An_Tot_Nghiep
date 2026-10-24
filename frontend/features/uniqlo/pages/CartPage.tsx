"use client";

import { useState } from "react";
import Link from "next/link";
import OrderSummary from "@/components/cart/OrderSummary";
import ProductCard from "@/components/product/ProductCard";
import { formatVnd, products } from "@/data/products";


export default function CartPage() {
  const [quantity, setQuantity] = useState(1);
  const product = products[1];
  const total = product.price * quantity;

  return (
    <div className="container">
      <h1 className="page-title">Giỏ hàng</h1>
      <div className="two-column">
        <section>
          <article className="cart-item">
            <img src={product.image} alt={product.name} />
            <div>
              <strong>{product.name}</strong>
              <p className="product-meta">Màu sắc: {product.color}</p>
              <p className="product-meta">Kích cỡ: Nam M</p>
              <div className="price">{formatVnd(product.price)}</div>
              <div className="quantity">
                <button aria-label="Giảm số lượng" onClick={() => setQuantity(q => Math.max(1, q - 1))}>−</button>
                <span>{quantity}</span>
                <button aria-label="Tăng số lượng" onClick={() => setQuantity(q => q + 1)}>+</button>
              </div>
              <p><button className="text-button" onClick={() => setQuantity(1)}>Xóa / đặt lại</button></p>
            </div>
            <div className="item-price"><strong>{formatVnd(total)}</strong></div>
          </article>
          <p className="small muted">Đủ điều kiện áp dụng miễn phí vận chuyển theo chính sách cửa hàng.</p>
        </section>
        <OrderSummary total={total} />
      </div>
      <section>
        <h2 className="section-title">Có thể bạn sẽ thích</h2>
        <div className="product-grid">{products.slice(0, 3).map(p => <ProductCard key={p.id} product={p} />)}</div>
      </section>
      <p style={{ textAlign: "center", marginTop: 32 }}>
        <Link className="pill-button" href="/wishlist">Tiếp tục mua sắm</Link>
      </p>
    </div>
  );
}
