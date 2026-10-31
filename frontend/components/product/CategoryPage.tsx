"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ProductCard from "@/components/product/ProductCard";
import { productCategories } from "@/data/categories";
import { API_BASE_URL, readApiResponse, type ApiCategory } from "@/lib/api";
import { useCatalogProducts } from "@/lib/useCatalogProducts";

const hiddenProductCodesByCategory: Record<string, ReadonlySet<string>> = {
  "em-be": new Set(["baby-010", "baby-011", "baby-012"]),
  nam: new Set(["jacket-002"]),
  nu: new Set(["tee-003", "women-005"]),
  "tre-em": new Set(["kids-007", "kids-008", "kids-009"]),
};

export default function CategoryPage({ slug }: { slug: string }) {
  const staticCategory = productCategories.find((item) => item.slug === slug);
  const [category, setCategory] = useState<ApiCategory | null>(null);
  const [categoryLoadError, setCategoryLoadError] = useState("");
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [minimumPrice, setMinimumPrice] = useState("");
  const [maximumPrice, setMaximumPrice] = useState("");
  const [sort, setSort] = useState("featured");
  const { products, error: catalogError } = useCatalogProducts();

  useEffect(() => {
    let active = true;
    fetch(`${API_BASE_URL}/catalog/categories`).then(readApiResponse<ApiCategory[]>).then((categories) => {
      if (!active) return;
      setCategory(categories.find((item) => item.slug === slug) ?? null);
    }).catch((error: unknown) => {
      if (active) {
        setCategory(null);
        setCategoryLoadError(error instanceof Error ? error.message : "Không thể tải danh mục mới nhất từ máy chủ.");
      }
    });
    return () => { active = false; };
  }, [slug]);

  const categoryName = category?.name ?? staticCategory?.name;
  const categoryDescription = category?.description ?? staticCategory?.description;
  const hiddenProductCodes = hiddenProductCodesByCategory[slug];
  const categoryProducts = useMemo(() => products.filter((product) =>
    product.category === categoryName
    && !hiddenProductCodes?.has(product.code.toLowerCase()),
  ), [categoryName, hiddenProductCodes, products]);
  const availableColors = [...new Set(categoryProducts.map((product) => product.color))].sort();
  const availableSizes = [...new Set(categoryProducts.flatMap((product) => product.sizes))].sort((first, second) =>
    first.localeCompare(second, "vi", { numeric: true }),
  );
  const visibleProducts = useMemo(() => {
    const min = minimumPrice === "" ? undefined : Number(minimumPrice);
    const max = maximumPrice === "" ? undefined : Number(maximumPrice);
    const filtered = categoryProducts.filter((product) =>
      (!selectedColors.length || selectedColors.includes(product.color))
      && (!selectedSizes.length || selectedSizes.some((size) => product.sizes.includes(size)))
      && (min === undefined || (Number.isFinite(min) && product.price >= min))
      && (max === undefined || (Number.isFinite(max) && product.price <= max)),
    );

    if (sort === "price-asc") filtered.sort((first, second) => first.price - second.price);
    if (sort === "price-desc") filtered.sort((first, second) => second.price - first.price);
    if (sort === "rating") filtered.sort((first, second) => second.rating - first.rating);
    return filtered;
  }, [categoryProducts, maximumPrice, minimumPrice, selectedColors, selectedSizes, sort]);

  function toggleFilterValue(
    value: string,
    selected: string[],
    setSelected: (values: string[]) => void,
  ) {
    setSelected(selected.includes(value)
      ? selected.filter((item) => item !== value)
      : [...selected, value]);
  }

  function clearFilters() {
    setSelectedColors([]);
    setSelectedSizes([]);
    setMinimumPrice("");
    setMaximumPrice("");
    setSort("featured");
  }

  const hasActiveFilters = selectedColors.length > 0
    || selectedSizes.length > 0
    || minimumPrice !== ""
    || maximumPrice !== ""
    || sort !== "featured";

  return (
    <section className="catalog-page">
      <div className="catalog-heading">
        <div>
          <div className="breadcrumb"><Link href="/">Trang chủ</Link> / {categoryName ?? "Danh mục"}</div>
          <h1>{categoryName ?? "Danh mục"}</h1>
          <p>{categoryDescription ?? ""}</p>
        </div>
      </div>
      {(catalogError || categoryLoadError) && <p className="catalog-result-count" role="status">Đang hiển thị dữ liệu mẫu. {catalogError || categoryLoadError}</p>}
      <div className="category-filter-toolbar" aria-label="Lọc sản phẩm">
        <details className="category-filter">
          <summary>Màu sắc{selectedColors.length > 0 && <span> ({selectedColors.length})</span>}</summary>
          <div className="category-filter-popover">
            {availableColors.map((color) => (
              <label key={color}>
                <input
                  type="checkbox"
                  checked={selectedColors.includes(color)}
                  onChange={() => toggleFilterValue(color, selectedColors, setSelectedColors)}
                />
                {color}
              </label>
            ))}
          </div>
        </details>
        <details className="category-filter">
          <summary>Kích cỡ{selectedSizes.length > 0 && <span> ({selectedSizes.length})</span>}</summary>
          <div className="category-filter-popover">
            {availableSizes.map((size) => (
              <label key={size}>
                <input
                  type="checkbox"
                  checked={selectedSizes.includes(size)}
                  onChange={() => toggleFilterValue(size, selectedSizes, setSelectedSizes)}
                />
                {size}
              </label>
            ))}
          </div>
        </details>
        <details className="category-filter">
          <summary>Giá</summary>
          <div className="category-filter-popover category-price-filter">
            <label>
              Từ
              <input
                type="number"
                min="0"
                value={minimumPrice}
                onChange={(event) => setMinimumPrice(event.target.value)}
                placeholder="0"
              />
            </label>
            <label>
              Đến
              <input
                type="number"
                min="0"
                value={maximumPrice}
                onChange={(event) => setMaximumPrice(event.target.value)}
                placeholder="Không giới hạn"
              />
            </label>
          </div>
        </details>
        <label className="category-sort">
          Sắp xếp
          <select value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="featured">Nổi bật</option>
            <option value="price-asc">Giá: thấp đến cao</option>
            <option value="price-desc">Giá: cao đến thấp</option>
            <option value="rating">Đánh giá cao</option>
          </select>
        </label>
        {hasActiveFilters && (
          <button className="category-filter-reset" type="button" onClick={clearFilters}>
            Xóa bộ lọc
          </button>
        )}
      </div>
      <p className="catalog-result-count">Tìm thấy {visibleProducts.length} sản phẩm</p>
      {visibleProducts.length ? (
        <div className="product-grid">
          {visibleProducts.map((product) => <ProductCard key={product.id} product={product} />)}
        </div>
      ) : (
        <div className="empty-state">
          <h2>{categoryProducts.length ? "Không tìm thấy sản phẩm phù hợp" : "Danh mục đang được cập nhật"}</h2>
          <p>{categoryProducts.length ? "Thử thay đổi hoặc xóa bộ lọc để xem thêm sản phẩm." : "Hiện chưa có sản phẩm trong danh mục này."}</p>
          {categoryProducts.length > 0 && (
            <button className="pill-button" type="button" onClick={clearFilters}>Xóa bộ lọc</button>
          )}
        </div>
      )}
    </section>
  );
}
