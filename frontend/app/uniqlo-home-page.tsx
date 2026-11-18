"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import ProductCard from "@/components/product/ProductCard";
import CategoryTiles from "@/components/product/CategoryTiles";
import { resolveProductImage } from "@/lib/api";
import { getAudienceName } from "@/lib/catalog-audience";
import { useCatalogCategories } from "@/lib/useCatalogCategories";
import { useCatalogProducts } from "@/lib/useCatalogProducts";
import { useCatalogOutfits } from "@/lib/useCatalogOutfits";
import type { Product } from "@/types/product";
import "./home.css";

function Collection({
  id, title, href, products, loading, emptyText,
}: {
  id: string;
  title: string;
  href: string;
  products: Product[];
  loading: boolean;
  emptyText: string;
}) {
  const rail = useRef<HTMLDivElement>(null);
  const [scrollState, setScrollState] = useState({ previous: false, next: false });
  const hasProducts = products.length > 0;

  useEffect(() => {
    const element = rail.current;
    if (!element) return;
    const measure = () => setScrollState({
      previous: element.scrollLeft > 4,
      next: element.scrollWidth - element.clientWidth - element.scrollLeft > 4,
    });
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    element.addEventListener("scroll", measure, { passive: true });
    return () => {
      observer.disconnect();
      element.removeEventListener("scroll", measure);
    };
  }, [hasProducts, loading, products.length]);

  function scrollProducts(direction: number) {
    const element = rail.current;
    if (element) element.scrollBy({ left: direction * element.clientWidth * .75 });
  }

  return (
    <section className="home-section" id={id} aria-labelledby={`${id}-title`} aria-busy={loading}>
      <div className="home-section-heading">
        <h2 id={`${id}-title`}>{title}</h2>
        <div className="home-section-controls">
          <Link className="home-text-link" href={href}>Xem tất cả <span aria-hidden="true">↗</span></Link>
          {(scrollState.previous || scrollState.next) && <div className="rail-buttons">
            <button type="button" disabled={!scrollState.previous} onClick={() => scrollProducts(-1)} aria-label={`Xem ${title.toLocaleLowerCase("vi")} trước`}>‹</button>
            <button type="button" disabled={!scrollState.next} onClick={() => scrollProducts(1)} aria-label={`Xem thêm ${title.toLocaleLowerCase("vi")}`}>›</button>
          </div>}
        </div>
      </div>
      {loading ? (
        <div className="product-grid" aria-hidden="true">
          {Array.from({ length: 4 }, (_, index) => (
            <div className="skeleton-card" key={index}>
              <div className="skeleton-box skeleton-image" />
              <div className="skeleton-box skeleton-line short" />
              <div className="skeleton-box skeleton-line" />
            </div>
          ))}
        </div>
      ) : products.length ? (
        <div className="product-grid home-product-rail" ref={rail} aria-label={title}>
          {products.map((product) => <ProductCard key={product.id} product={product} />)}
        </div>
      ) : <p className="home-empty">{emptyText}</p>}
    </section>
  );
}

export default function HomePage() {
  const { products, error: productError, loading } = useCatalogProducts();
  const { outfits, error: outfitError } = useCatalogOutfits();
  const { categories = [], loading: loadingCategories, error: categoryError } = useCatalogCategories();
  const categoryPhotos = new Map<string, string>();
  for (const product of products) {
    if (product.categoryId && product.image && !categoryPhotos.has(product.categoryId)) {
      categoryPhotos.set(product.categoryId, product.image);
    }
  }
  const collections = categories.filter((category) =>
    !getAudienceName(category.slug) && (category.audiences?.length || categoryPhotos.has(category._id)),
  ).slice(0, 12);
  const newArrivals = products.filter((product) => product.inStock).sort((first, second) =>
    Date.parse(second.createdAt ?? "1970-01-01") - Date.parse(first.createdAt ?? "1970-01-01"),
  ).slice(0, 10);
  const featuredProducts = products.filter((item) => item.isFeatured).slice(0, 10);
  const saleProducts = products.filter((item) => (item.originalPrice ?? 0) > item.price).slice(0, 10);
  const productIds = new Set(products.filter((product) => product.inStock).map((product) => product.id));
  const publishedOutfits = outfits?.filter((outfit) => outfit.product_ids.some((id) => productIds.has(id))) ?? [];

  return (
    <div className="home-page">
      <section className="editorial-hero" aria-labelledby="home-title">
        <div className="editorial-image">
          <Image src="/images/banner/fstyle-city-walk.webp" alt="" fill preload sizes="100vw" />
        </div>
        <div className="editorial-copy">
          <h1 id="home-title">Phong cách<br />theo cách bạn.</h1>
          <p>Khám phá trang phục dễ mặc, dễ phối cho mỗi ngày.</p>
          <div className="editorial-actions">
            <Link className="pill-button editorial-cta" href="/products">Khám phá bộ sưu tập <span aria-hidden="true">↗</span></Link>
            <Link className="home-text-link" href="/products?status=sale">Xem ưu đãi <span aria-hidden="true">↗</span></Link>
          </div>
        </div>
      </section>

      <section className="home-section home-shopping" aria-labelledby="home-category-title">
        <div className="home-section-heading">
          <h2 id="home-category-title">Tìm theo danh mục</h2>
        </div>
        {categoryError && <p role="status" className="home-empty">{categoryError}</p>}
        {loadingCategories && <p role="status" className="home-empty">Đang tải danh mục…</p>}
        <CategoryTiles categories={collections} photos={categoryPhotos} />
        <Link className="pill-button home-categories-all" href="/products">Xem tất cả sản phẩm</Link>
      </section>

      {productError ? <p role="alert" className="home-empty">{productError}</p> : <>
        <Collection id="san-pham-moi" title="Sản phẩm mới" href="/products?sort=newest"
          products={newArrivals} loading={loading} emptyText="Chưa có sản phẩm mới." />
        <Collection id="ban-chay" title="Sản phẩm nổi bật" href="/products?featured=true"
          products={featuredProducts} loading={loading} emptyText="Chưa có sản phẩm nổi bật." />
        <Collection id="khuyen-mai" title="Đang ưu đãi" href="/products?status=sale"
          products={saleProducts} loading={loading} emptyText="Chưa có sản phẩm được giảm giá." />
      </>}

      <section className="home-section home-lookbook" id="outfit" aria-labelledby="home-lookbook-title">
        <div className="home-lookbook-intro">
          <div>
            <h2 id="home-lookbook-title">Mix & Match</h2>
            <p>Thử cách phối mới từ những món đồ bạn yêu thích.</p>
          </div>
          <Link href="/outfit" className="pill-button">Xem bộ phối <span aria-hidden="true">↗</span></Link>
        </div>
        {outfitError && <p role="alert" className="home-empty">{outfitError}</p>}
        {outfits && !loading && !publishedOutfits.length && <p className="home-empty">Xem các gợi ý phối từ sản phẩm đang bán.</p>}
        {!!publishedOutfits.length && (
          <div className="home-outfit-grid">
            {publishedOutfits.slice(0, 3).map((outfit) => (
              <Link className="home-outfit-card" href={`/outfit?bo-phoi=${encodeURIComponent(outfit._id)}`} key={outfit._id}>
                {/* eslint-disable-next-line @next/next/no-img-element -- outfit images can come from the backend */}
                <img src={resolveProductImage(outfit.image)} alt="" loading="lazy" />
                <div>
                  <h3>{outfit.title} <span aria-hidden="true">↗</span></h3>
                  {outfit.description && <p>{outfit.description}</p>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
