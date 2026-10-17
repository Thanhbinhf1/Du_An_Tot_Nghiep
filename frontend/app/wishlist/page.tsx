"use client";

import { useState } from "react";
import Link from "next/link";
import ProductCard from "@/components/product/ProductCard";
import { products } from "@/data/products";

import "./wishlist.css";

export default function WishlistPage() {
  const [tab, setTab] = useState<"products" | "style">("products");
  return (
    <div className="container">
      <div className="wishlist-layout">
        <aside className="account-menu">
          <h3>Tư cách thành viên</h3>
          <a href="#history">Lịch sử mua hàng</a><a href="#coupons">Phiếu giảm giá</a>
          <Link href="/wishlist">Yêu thích</Link><a href="#reviews">Đánh giá đã đăng</a>
          <a href="#online">Khảo sát dịch vụ đặt hàng online</a>
          <h3>Cài đặt hồ sơ</h3>
          <a href="#profile">Hồ sơ</a><a href="#address">Sổ địa chỉ</a><a href="#password">Thay đổi mật khẩu</a>
        </aside>
        <section>
          <h1 className="page-title">Yêu thích</h1>
          <div className="tabs">
            <button className={`tab ${tab === "products" ? "active" : ""}`} onClick={() => setTab("products")}>Sản phẩm</button>
            <button className={`tab ${tab === "style" ? "active" : ""}`} onClick={() => setTab("style")}>Phong cách</button>
          </div>
          {tab === "products" ? (
            <>
              <p className="small">Kết quả: 1 sản phẩm</p>
              <div className="product-grid">{products.slice(0, 1).map(p => <ProductCard key={p.id} product={p} />)}</div>
              <div style={{ marginTop: 36 }}>
                <h2 className="section-title">Đã xem gần đây</h2>
                <div className="product-grid">{products.slice(1).map(p => <ProductCard key={p.id} product={p} />)}</div>
              </div>
            </>
          ) : <div className="empty-state">Bạn chưa lưu phong cách nào.</div>}
        </section>
      </div>
    </div>
  );
}
