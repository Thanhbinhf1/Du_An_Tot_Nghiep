"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ProductCard from "@/components/product/ProductCard";
import { API_BASE_URL, readApiResponse, type ApiBrand } from "@/lib/api";
import { useCatalogCategories } from "@/lib/useCatalogCategories";
import { useCatalogProducts } from "@/lib/useCatalogProducts";

const PAGE_SIZE = 12;

const quickTypeChips = [
  { label: "Tất cả", value: "" },
  { label: "Áo thun", value: "Áo thun" },
  { label: "Áo sơ mi", value: "Áo sơ mi" },
  { label: "Quần", value: "Quần" },
  { label: "Váy", value: "Váy" },
  { label: "Áo khoác", value: "Áo khoác" },
  { label: "Phụ kiện", value: "Phụ kiện" },
];

const priceRanges = [
  { id: "all", label: "Tất cả mức giá", min: 0, max: Infinity },
  { id: "under-300", label: "Dưới 300.000đ", min: 0, max: 300_000 },
  { id: "300-500", label: "300.000đ – 500.000đ", min: 300_000, max: 500_000 },
  { id: "500-1000", label: "500.000đ – 1.000.000đ", min: 500_000, max: 1_000_000 },
  { id: "above-1000", label: "Trên 1.000.000đ", min: 1_000_000, max: Infinity },
];

export default function ProductListing({
  initialCategory = "",
  initialQuery = "",
  initialSort = "featured",
  initialStatus = "all",
  searchMode = false,
}: {
  initialCategory?: string;
  initialQuery?: string;
  initialSort?: string;
  initialStatus?: string;
  searchMode?: boolean;
}) {
  const [category, setCategory] = useState(initialCategory);
  const [query, setQuery] = useState(initialQuery);
  const [sort, setSort] = useState(initialSort);
  const [maxPrice, setMaxPrice] = useState<number>();
  const [priceRangeId, setPriceRangeId] = useState("all");
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("");
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [currentPage, setCurrentPage] = useState(1);

  const { products: catalogProducts, error: catalogError, loading } = useCatalogProducts();
  const { categories: catalogCategories = [], error: categoryLoadError } = useCatalogCategories();
  const [catalogBrands, setCatalogBrands] = useState<ApiBrand[]>([]);

  const priceLimit = catalogProducts.reduce(
    (limit, product) => Math.max(limit, Math.ceil(product.price / 50_000) * 50_000),
    2_000_000,
  );

  useEffect(() => {
    let active = true;
    fetch(`${API_BASE_URL}/brands`)
      .then(readApiResponse<ApiBrand[]>)
      .then((apiBrands) => {
        if (!active) return;
        if (Array.isArray(apiBrands)) setCatalogBrands(apiBrands);
      })
      .catch(() => {
        // Fallback to brands extracted from products
      });

    return () => {
      active = false;
    };
  }, []);

  const availableSizes = useMemo(() => {
    const dynamicSizes = catalogProducts.flatMap((product) => product.sizes);
    return [...new Set(dynamicSizes.filter(Boolean))];
  }, [catalogProducts]);

  const availableColors = useMemo(() => {
    const colors = catalogProducts.flatMap((product) =>
      product.variants?.length
        ? product.variants.map((variant) => variant.color)
        : product.color
          ? product.color.split(",").map((item) => item.trim())
          : [],
    );
    return [...new Set(colors.filter(Boolean))].sort((a, b) => a.localeCompare(b, "vi"));
  }, [catalogProducts]);

  const availableBrands = useMemo(() => {
    const fromApi = catalogBrands.map((brand) => brand.name);
    const fromProducts = catalogProducts.map((product) => product.brand ?? "").filter(Boolean);
    return [...new Set(["F.Style", ...fromApi, ...fromProducts].filter(Boolean))];
  }, [catalogBrands, catalogProducts]);

  const visibleProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("vi");
    const activeRange = priceRanges.find((range) => range.id === priceRangeId) ?? priceRanges[0];

    const filtered = catalogProducts.filter((product) => {
      const matchesQuery =
        !normalizedQuery ||
        `${product.name} ${product.category} ${product.color} ${product.code} ${product.brand ?? ""}`
          .toLocaleLowerCase("vi")
          .includes(normalizedQuery);

      const matchesCategory =
        !category ||
        category === "Tất cả" ||
        product.category.toLocaleLowerCase("vi") === category.toLocaleLowerCase("vi") ||
        product.name.toLocaleLowerCase("vi").includes(category.toLocaleLowerCase("vi"));

      const matchesMaxPrice = maxPrice === undefined || product.price <= maxPrice;
      const matchesPriceRange = product.price >= activeRange.min && product.price <= activeRange.max;

      const matchesVariant = (!selectedSize && !selectedColor) || product.variants?.some(
        (variant) => (!selectedSize || variant.size === selectedSize) &&
          (!selectedColor || variant.color === selectedColor),
      );

      const matchesBrand =
        !selectedBrand ||
        (product.brand ?? "F.Style").toLocaleLowerCase("vi") === selectedBrand.toLocaleLowerCase("vi");

      const isOutOfStock = product.variants?.length === 0 || product.inStock === false;
      const isOnSale =
        Boolean(product.discountPercent && product.discountPercent > 0) ||
        Boolean(product.originalPrice && product.originalPrice > product.price);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "featured" && product.isFeatured) ||
        (statusFilter === "instock" && !isOutOfStock) ||
        (statusFilter === "outofstock" && isOutOfStock) ||
        (statusFilter === "sale" && isOnSale);

      return (
        matchesQuery &&
        matchesCategory &&
        matchesMaxPrice &&
        matchesPriceRange &&
        matchesVariant &&
        matchesBrand &&
        matchesStatus
      );
    });

    if (sort === "price-asc") filtered.sort((a, b) => a.price - b.price);
    if (sort === "price-desc") filtered.sort((a, b) => b.price - a.price);
    if (sort === "newest") {
      filtered.sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      });
    }

    return filtered;
  }, [
    catalogProducts,
    category,
    maxPrice,
    priceRangeId,
    query,
    selectedBrand,
    selectedColor,
    selectedSize,
    sort,
    statusFilter,
  ]);

  const totalPages = Math.max(1, Math.ceil(visibleProducts.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedProducts = visibleProducts.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function resetAllFilters() {
    setQuery("");
    setCategory("");
    setMaxPrice(undefined);
    setPriceRangeId("all");
    setSelectedSize("");
    setSelectedColor("");
    setSelectedBrand("");
    setStatusFilter("all");
    setSort("featured");
    setCurrentPage(1);
  }

  const hasActiveFilters =
    Boolean(query) ||
    Boolean(category) ||
    maxPrice !== undefined ||
    priceRangeId !== "all" ||
    Boolean(selectedSize) ||
    Boolean(selectedColor) ||
    Boolean(selectedBrand) ||
    statusFilter !== "all";

  return (
    <section className="catalog-page">
      <div className="catalog-heading">
        <div>
          <div className="breadcrumb">
            <Link href="/">Trang chủ</Link> / {searchMode ? "Tìm kiếm" : "Sản phẩm"}
          </div>
          <h1>
            {searchMode
              ? "Tìm kiếm sản phẩm"
              : category && category !== "Tất cả"
                ? category
                : "Tất cả sản phẩm"}
          </h1>
        </div>
        <form className="catalog-search" action="/search">
          <label className="sr-only" htmlFor="catalog-query">
            Từ khóa tìm kiếm
          </label>
          <input
            id="catalog-query"
            name="q"
            value={query}
            onChange={(event) => { setQuery(event.target.value); setCurrentPage(1); }}
            placeholder="Bạn đang tìm áo thun, sơ mi, váy...?"
          />
          <button type="submit" aria-label="Tìm kiếm">
            Tìm
          </button>
        </form>
      </div>

      {/* Thanh chọn nhanh loại trang phục: Áo thun, Áo sơ mi, Quần, Váy, Áo khoác, Phụ kiện */}
      <div className="catalog-type-chips" role="group" aria-label="Lọc nhanh danh mục">
        {quickTypeChips.map((chip) => {
          const active = query.toLocaleLowerCase("vi") === chip.value.toLocaleLowerCase("vi") && (!chip.value ? !category : true);
          return (
            <button
              key={chip.label}
              type="button"
              className={`type-chip${active ? " active" : ""}`}
              onClick={() => {
                if (!chip.value) {
                  setQuery("");
                  setCategory("");
                } else {
                  setQuery(chip.value);
                }
                setCurrentPage(1);
              }}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      <div className="store-catalog-controls">
        <p className="catalog-result-count" role="status">
          {catalogError ? "" : loading ? "Đang tải sản phẩm…" : `${visibleProducts.length} sản phẩm`}
        </p>
        <label className="store-catalog-sort">
          Sắp xếp
          <select value={sort} onChange={(event) => { setSort(event.target.value); setCurrentPage(1); }}>
            <option value="featured">Nổi bật</option>
            <option value="newest">Mới nhất</option>
            <option value="price-asc">Giá thấp đến cao</option>
            <option value="price-desc">Giá cao đến thấp</option>
          </select>
        </label>
        <details className="store-catalog-filters">
          <summary>
            <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden="true">
              <path d="M3 6h11m4 0h3M3 12h4m4 0h10M3 18h11m4 0h3" /><circle cx="16" cy="6" r="2" /><circle cx="9" cy="12" r="2" /><circle cx="16" cy="18" r="2" />
            </svg>
            Bộ lọc
          </summary>
          <div className="catalog-toolbar catalog-toolbar-expanded">
            <label>
              Danh mục
              <select value={category} onChange={(event) => { setCategory(event.target.value); setCurrentPage(1); }}>
                <option value="">Tất cả sản phẩm</option>
                {catalogCategories.map((item) => (
                  <option key={item.slug} value={item.name}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Khoảng giá
              <select value={priceRangeId} onChange={(event) => { setPriceRangeId(event.target.value); setCurrentPage(1); }}>
                {priceRanges.map((range) => (
                  <option key={range.id} value={range.id}>
                    {range.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Kích cỡ (Size)
              <select value={selectedSize} onChange={(event) => { setSelectedSize(event.target.value); setCurrentPage(1); }}>
                <option value="">Tất cả kích cỡ</option>
                {availableSizes.map((size) => (
                  <option key={size} value={size}>
                    Size {size}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Màu sắc
              <select value={selectedColor} onChange={(event) => { setSelectedColor(event.target.value); setCurrentPage(1); }}>
                <option value="">Tất cả màu sắc</option>
                {availableColors.map((color) => (
                  <option key={color} value={color}>
                    {color}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Thương hiệu
              <select value={selectedBrand} onChange={(event) => { setSelectedBrand(event.target.value); setCurrentPage(1); }}>
                <option value="">Tất cả thương hiệu</option>
                {availableBrands.map((brand) => (
                  <option key={brand} value={brand}>
                    {brand}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Trạng thái
              <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setCurrentPage(1); }}>
                <option value="all">Tất cả trạng thái</option>
                <option value="featured">Nổi bật</option>
                <option value="instock">Còn hàng</option>
                <option value="outofstock">Hết hàng</option>
                <option value="sale">Đang giảm giá</option>
              </select>
            </label>

            <label>
              Giá tối đa: {maxPrice === undefined ? "Không giới hạn" : `${new Intl.NumberFormat("vi-VN").format(maxPrice)} VND`}
              <input
                type="range"
                min="0"
                max={priceLimit}
                step="50000"
                value={maxPrice ?? priceLimit}
                onChange={(event) => { setMaxPrice(Number(event.target.value)); setCurrentPage(1); }}
              />
            </label>
          </div>
        </details>
      </div>

      {hasActiveFilters && (
        <div className="catalog-active-filters">
          <button type="button" className="category-filter-reset" onClick={resetAllFilters}>
            Xóa tất cả bộ lọc ×
          </button>
        </div>
      )}

      {(catalogError || categoryLoadError) && (
        <p className="catalog-result-count" role="alert">
          {catalogError || categoryLoadError}
        </p>
      )}

      {paginatedProducts.length ? (
        <>
          <div className="product-grid">
            {paginatedProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          {/* Phân trang */}
          {totalPages > 1 && (
            <nav className="catalog-pagination" aria-label="Phân trang danh sách sản phẩm">
              <button
                type="button"
                className="pagination-btn"
                disabled={safePage <= 1}
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              >
                ← Trang trước
              </button>
              <div className="pagination-pages">
                {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
                  <button
                    key={pageNumber}
                    type="button"
                    className={`pagination-page${pageNumber === safePage ? " active" : ""}`}
                    aria-current={pageNumber === safePage ? "page" : undefined}
                    onClick={() => setCurrentPage(pageNumber)}
                  >
                    {pageNumber}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="pagination-btn"
                disabled={safePage >= totalPages}
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              >
                Trang sau →
              </button>
            </nav>
          )}
        </>
      ) : (
        !loading &&
        !catalogError && (
          <div className="empty-state">
            <h2>Chưa tìm thấy sản phẩm phù hợp</h2>
            <p>Thử từ khóa hoặc bộ lọc khác nhé.</p>
            <button className="pill-button" type="button" onClick={resetAllFilters}>
              Xóa bộ lọc
            </button>
          </div>
        )
      )}
    </section>
  );
}
