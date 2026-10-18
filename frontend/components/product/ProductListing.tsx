"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import ProductCard from "@/components/product/ProductCard";
import { products } from "@/data/products";

const categories = [
  "Áo khoác", "Áo thun", "Áo sơ mi", "Quần dài", "Đồ mặc nhà", "Phụ kiện",
  "Trang phục nữ", "Trang phục nam", "Trẻ em", "LifeWear", "UT graphic", "Bộ sưu tập",
];

export default function ProductListing({
  initialCategory = "",
  initialQuery = "",
  searchMode = false,
}: {
  initialCategory?: string;
  initialQuery?: string;
  searchMode?: boolean;
}) {
  const [category, setCategory] = useState(initialCategory);
  const [query, setQuery] = useState(initialQuery);
  const [sort, setSort] = useState("featured");
  const [maxPrice, setMaxPrice] = useState(2_000_000);

  const visibleProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("vi");
    const filtered = products.filter((product) => {
      const matchesQuery =
        !normalizedQuery ||
        `${product.name} ${product.category} ${product.color} ${product.code}`
          .toLocaleLowerCase("vi")
          .includes(normalizedQuery);
      const matchesCategory =
        !category ||
        category === "Tất cả" ||
        category === "Bộ sưu tập" ||
        category === "LifeWear" ||
        category === "UT graphic" ||
        product.category.toLocaleLowerCase("vi").includes(category.toLocaleLowerCase("vi")) ||
        category.toLocaleLowerCase("vi").includes(product.category.toLocaleLowerCase("vi"));
      return matchesQuery && matchesCategory && product.price <= maxPrice;
    });

    if (sort === "price-asc") filtered.sort((a, b) => a.price - b.price);
    if (sort === "price-desc") filtered.sort((a, b) => b.price - a.price);
    if (sort === "rating") filtered.sort((a, b) => b.rating - a.rating);
    return filtered;
  }, [category, maxPrice, query, sort]);

  return (
    <section className="catalog-page">
      <div className="catalog-heading">
        <div>
          <div className="breadcrumb"><Link href="/">Trang chủ</Link> / {searchMode ? "Tìm kiếm" : "Sản phẩm"}</div>
          <h1>{searchMode ? "Tìm kiếm sản phẩm" : category && category !== "Tất cả" ? category : "Tất cả sản phẩm"}</h1>
          <p>Dễ dàng tìm sản phẩm phù hợp với phong cách của bạn.</p>
        </div>
        <form className="catalog-search" action="/search">
          <label className="sr-only" htmlFor="catalog-query">Từ khóa tìm kiếm</label>
          <input id="catalog-query" name="q" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Bạn đang tìm gì?" />
          <button type="submit" aria-label="Tìm kiếm">Tìm</button>
        </form>
      </div>

      <div className="catalog-toolbar">
        <label>
          Danh mục
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="">Tất cả sản phẩm</option>
            {categories.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label>
          Giá tối đa: {new Intl.NumberFormat("vi-VN").format(maxPrice)} VND
          <input type="range" min="300000" max="2000000" step="50000" value={maxPrice} onChange={(event) => setMaxPrice(Number(event.target.value))} />
        </label>
        <label>
          Sắp xếp
          <select value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="featured">Nổi bật</option>
            <option value="price-asc">Giá: thấp đến cao</option>
            <option value="price-desc">Giá: cao đến thấp</option>
            <option value="rating">Đánh giá cao</option>
          </select>
        </label>
      </div>

      <p className="catalog-result-count">Tìm thấy {visibleProducts.length} sản phẩm</p>
      {visibleProducts.length ? (
        <div className="product-grid">
          {visibleProducts.map((product) => <ProductCard key={product.id} product={product} />)}
        </div>
      ) : (
        <div className="empty-state">
          <h2>Chưa tìm thấy sản phẩm phù hợp</h2>
          <p>Thử từ khóa hoặc bộ lọc khác nhé.</p>
          <button className="pill-button" type="button" onClick={() => { setQuery(""); setCategory(""); setMaxPrice(2_000_000); }}>
            Xóa bộ lọc
          </button>
        </div>
      )}
    </section>
  );
}
