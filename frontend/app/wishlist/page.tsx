"use client";

import Link from "next/link";
import ProductCard from "@/components/product/ProductCard";
import { AccountSidebar } from "@/components/account/AccountLayout";
import { useCatalogProducts } from "@/lib/useCatalogProducts";
import { useWishlist } from "@/lib/wishlist";
import { useDemoAuth } from "@/lib/demo-auth";

export default function WishlistPage() {
  const { ids, loading, error } = useWishlist();
  const { products, loading: catalogLoading, error: catalogError } = useCatalogProducts();
  const { token, isHydrated } = useDemoAuth();
  const savedProducts = products.filter((product) => ids.includes(product.id));

  return (
    <div className="container wishlist-page">
      <div className="account-page-layout">
        <AccountSidebar active="wishlist" />
        <section className="account-page-content">
          <div className="catalog-heading"><div><div className="breadcrumb"><Link href="/">Trang chủ</Link> / Tài khoản</div><h1>Sản phẩm yêu thích</h1><p>{savedProducts.length} sản phẩm đã lưu</p></div><Link className="pill-button" href="/products">Khám phá sản phẩm</Link></div>
          {isHydrated && !token && <p><Link href="/dang-nhap">Đăng nhập</Link> để lưu yêu thích trên nhiều thiết bị.</p>}
          {(error || catalogError) && <p role="alert">{error || catalogError}</p>}
          {!error && !catalogError && (loading || catalogLoading) && <p role="status">Đang tải sản phẩm yêu thích...</p>}
          {savedProducts.length ? <div className="product-grid">{savedProducts.map((product) => <ProductCard key={product.id} product={product} />)}</div> : !loading && !catalogLoading && !error && !catalogError && (
            <div className="empty-state"><h2>Danh sách yêu thích đang trống</h2><p>Lưu sản phẩm bằng cách nhấn biểu tượng trái tim.</p><Link className="pill-button dark" href="/products">Xem sản phẩm</Link></div>
          )}
        </section>
      </div>
    </div>
  );
}
