"use client";

import Link from "next/link";
import ProductCard from "@/components/product/ProductCard";
import { products } from "@/data/products";
import { useWishlistIds } from "@/lib/storefront-demo";

export default function WishlistPage() {
  const ids = useWishlistIds();
  const savedProducts = products.filter((product) => ids.includes(product.id));

  return (
    <div className="container">
      <div className="account-page-layout">
        <aside className="account-menu">
          <h3>Tài khoản</h3>
          <Link href="/profile">Hồ sơ</Link>
          <Link href="/profile/address">Sổ địa chỉ</Link>
          <Link href="/profile/password">Đổi mật khẩu</Link>
          <Link href="/orders">Đơn hàng của tôi</Link>
          <Link className="active" href="/wishlist">Yêu thích</Link>
        </aside>
        <section className="account-page-content">
          <div className="catalog-heading"><div><div className="breadcrumb"><Link href="/">Trang chủ</Link> / Tài khoản</div><h1>Sản phẩm yêu thích</h1><p>{savedProducts.length} sản phẩm đã lưu</p></div><Link className="pill-button" href="/products">Khám phá sản phẩm</Link></div>
          {savedProducts.length ? <div className="product-grid">{savedProducts.map((product) => <ProductCard key={product.id} product={product} />)}</div> : (
            <div className="empty-state"><h2>Danh sách yêu thích đang trống</h2><p>Lưu sản phẩm bằng cách nhấn biểu tượng trái tim.</p><Link className="pill-button dark" href="/products">Xem sản phẩm</Link></div>
          )}
        </section>
      </div>
    </div>
  );
}
