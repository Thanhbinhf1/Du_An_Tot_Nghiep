"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { changeCatalogFilters as changeFilters } from "@/lib/catalog-query";
import { useSearchParams } from "next/navigation";
import ProductCard from "@/components/product/ProductCard";
import CatalogFilterDrawer from "@/components/product/CatalogFilterDrawer";
import { API_BASE_URL, readApiResponse, type ApiBrand } from "@/lib/api";
import { STORE_NAME } from "@/lib/store-brand";
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

export default function ProductListing({ searchMode = false }: { searchMode?: boolean }) {
  const params = useSearchParams();
  const category = params.get("category") ?? "";
  const query = params.get("q") ?? "";
  const sortParam = params.get("sort") ?? "";
  const sort = ["newest", "price-asc", "price-desc"].includes(sortParam) ? sortParam : "featured";
  const maxPriceParam = params.get("maxPrice");
  const maxPrice = maxPriceParam && /^\d+$/.test(maxPriceParam) && Number.isSafeInteger(Number(maxPriceParam))
    ? Number(maxPriceParam) : undefined;
  const priceRangeId = priceRanges.find(({ id }) => id === params.get("price"))?.id ?? "all";
  const selectedSize = params.get("size") ?? "";
  const selectedColor = params.get("color") ?? "";
  const selectedBrand = params.get("brand") ?? "";
  const statusParam = params.get("status") ?? "";
  const statusFilter = ["sale", "instock", "outofstock", "featured"].includes(statusParam)
    ? statusParam : params.get("featured") === "true" ? "featured" : "all";
  const pageParam = Number(params.get("page"));
  const currentPage = Number.isSafeInteger(pageParam) && pageParam > 0 ? pageParam : 1;

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
    return [...new Set([STORE_NAME, ...fromApi, ...fromProducts].filter(Boolean))];
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
        (product.brand ?? STORE_NAME).toLocaleLowerCase("vi") === selectedBrand.toLocaleLowerCase("vi");

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
    changeFilters({ q: "", category: "", maxPrice: "", price: "", size: "", color: "", brand: "", status: "", sort: "" });
  }

  function changePage(page: number) {
    changeFilters({ page: page > 1 ? String(page) : "" });
  }

  const hasActiveFilters =
    Boolean(query) ||
    Boolean(category) ||
    maxPrice !== undefined ||
    priceRangeId !== "all" ||
    Boolean(selectedSize) ||
    Boolean(selectedColor) ||
    Boolean(selectedBrand) ||
    statusFilter !== "all" ||
    sort !== "featured";

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
            onChange={(event) => changeFilters({ q: event.target.value }, true)}
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
              aria-pressed={active}
              onClick={() => changeFilters(chip.value ? { q: chip.value } : { q: "", category: "" })}
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
          <select value={sort} onChange={(event) => changeFilters({ sort: event.target.value === "featured" ? "" : event.target.value })}>
            <option value="featured">Nổi bật</option>
            <option value="newest">Mới nhất</option>
            <option value="price-asc">Giá thấp đến cao</option>
            <option value="price-desc">Giá cao đến thấp</option>
          </select>
        </label>
        <CatalogFilterDrawer active={hasActiveFilters} count={loading ? undefined : visibleProducts.length} onReset={resetAllFilters}>
          <div className="catalog-toolbar catalog-toolbar-expanded">
            <label>
              Danh mục
              <select value={category} onChange={(event) => changeFilters({ category: event.target.value })}>
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
              <select value={priceRangeId} onChange={(event) => changeFilters({ price: event.target.value === "all" ? "" : event.target.value })}>
                {priceRanges.map((range) => (
                  <option key={range.id} value={range.id}>
                    {range.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Kích cỡ (Size)
              <select value={selectedSize} onChange={(event) => changeFilters({ size: event.target.value })}>
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
              <select value={selectedColor} onChange={(event) => changeFilters({ color: event.target.value })}>
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
              <select value={selectedBrand} onChange={(event) => changeFilters({ brand: event.target.value })}>
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
              <select value={statusFilter} onChange={(event) => changeFilters({ status: event.target.value === "all" ? "" : event.target.value })}>
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
                onChange={(event) => changeFilters({ maxPrice: event.target.value }, true)}
              />
            </label>
          </div>
        </CatalogFilterDrawer>
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
                onClick={() => changePage(Math.max(1, safePage - 1))}
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
                    onClick={() => changePage(pageNumber)}
                  >
                    {pageNumber}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="pagination-btn"
                disabled={safePage >= totalPages}
                onClick={() => changePage(Math.min(totalPages, safePage + 1))}
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
