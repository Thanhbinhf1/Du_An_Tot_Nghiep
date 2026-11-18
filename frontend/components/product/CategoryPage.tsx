"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import ProductCard from "@/components/product/ProductCard";
import { useCatalogProducts } from "@/lib/useCatalogProducts";
import { useCatalogCategories } from "@/lib/useCatalogCategories";
import { getAudienceName, getCategoryTree } from "@/lib/catalog-audience";

const PAGE_SIZE = 12;

export default function CategoryPage({ slug, audience }: { slug: string; audience?: string }) {
  const { categories, error: categoryLoadError, loading: loadingCategories } = useCatalogCategories();
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [minimumPrice, setMinimumPrice] = useState("");
  const [maximumPrice, setMaximumPrice] = useState("");
  const [sort, setSort] = useState("featured");
  const [currentPage, setCurrentPage] = useState(1);
  const { products, error: catalogError, loading } = useCatalogProducts();

  const category = categories?.find((item) => item.slug === slug);
  const isAudience = Boolean(getAudienceName(slug));
  const audienceSlug = audience && getAudienceName(audience) ? audience : isAudience ? slug : "";
  const categoryName = category?.name ?? getAudienceName(slug);
  const categoryDescription = category?.description;

  const categoryProducts = useMemo(() => {
    if (!categories || (!category && !isAudience)) return [];
    const audienceRoot = categories.find((item) => item.slug === audienceSlug);
    const audienceTree = getCategoryTree(categories, audienceRoot ? [audienceRoot._id] : []);
    const categoryTree = getCategoryTree(categories, category ? [category._id] : []);
    return products.filter((product) => {
      if (!product.categoryId || (!isAudience && !categoryTree.has(product.categoryId))) return false;
      return !audienceSlug || audienceTree.has(product.categoryId) || product.audiences?.includes(audienceSlug);
    });
  }, [audienceSlug, categories, category, isAudience, products]);

  const availableColors = [
    ...new Set(categoryProducts.flatMap((product) => product.variants?.map((variant) => variant.color) ?? [])),
  ].sort();
  const availableSizes = [...new Set(categoryProducts.flatMap((product) => product.sizes))].sort((first, second) =>
    first.localeCompare(second, "vi", { numeric: true }),
  );
  const availableBrands = [
    ...new Set(categoryProducts.map((product) => product.brand ?? "F.Style").filter(Boolean)),
  ].sort();

  const visibleProducts = useMemo(() => {
    const min = minimumPrice === "" ? undefined : Number(minimumPrice);
    const max = maximumPrice === "" ? undefined : Number(maximumPrice);
    const filtered = categoryProducts.filter((product) => {
      const matchesColorAndSize =
        (!selectedColors.length && !selectedSizes.length) ||
        product.variants?.some(
          (variant) =>
            (!selectedColors.length || selectedColors.includes(variant.color)) &&
            (!selectedSizes.length || selectedSizes.includes(variant.size)),
        );
      const matchesBrand = !selectedBrands.length || selectedBrands.includes(product.brand ?? "F.Style");
      const isOutOfStock = product.variants?.length === 0 || product.inStock === false;
      const isOnSale =
        Boolean(product.discountPercent && product.discountPercent > 0) ||
        Boolean(product.originalPrice && product.originalPrice > product.price);
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "instock" && !isOutOfStock) ||
        (statusFilter === "outofstock" && isOutOfStock) ||
        (statusFilter === "sale" && isOnSale);

      return (
        matchesColorAndSize &&
        matchesBrand &&
        matchesStatus &&
        (min === undefined || (Number.isFinite(min) && product.price >= min)) &&
        (max === undefined || (Number.isFinite(max) && product.price <= max))
      );
    });

    if (sort === "price-asc") filtered.sort((first, second) => first.price - second.price);
    if (sort === "price-desc") filtered.sort((first, second) => second.price - first.price);
    if (sort === "newest") {
      filtered.sort((first, second) => {
        const timeA = first.createdAt ? new Date(first.createdAt).getTime() : 0;
        const timeB = second.createdAt ? new Date(second.createdAt).getTime() : 0;
        return timeB - timeA;
      });
    }
    if (sort === "bestseller") {
      filtered.sort(
        (first, second) =>
          Number(Boolean(second.isFeatured)) - Number(Boolean(first.isFeatured)) || second.rating - first.rating,
      );
    }
    return filtered;
  }, [categoryProducts, maximumPrice, minimumPrice, selectedBrands, selectedColors, selectedSizes, sort, statusFilter]);

  function toggleFilterValue(value: string, selected: string[], setSelected: (values: string[]) => void) {
    setSelected(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]);
    setCurrentPage(1);
  }

  function clearFilters() {
    setSelectedColors([]);
    setSelectedSizes([]);
    setSelectedBrands([]);
    setStatusFilter("all");
    setMinimumPrice("");
    setMaximumPrice("");
    setSort("featured");
    setCurrentPage(1);
  }

  const hasActiveFilters =
    selectedColors.length > 0 ||
    selectedSizes.length > 0 ||
    selectedBrands.length > 0 ||
    statusFilter !== "all" ||
    minimumPrice !== "" ||
    maximumPrice !== "" ||
    sort !== "featured";

  const totalPages = Math.max(1, Math.ceil(visibleProducts.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedProducts = visibleProducts.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <section className="catalog-page">
      <div className="catalog-heading">
        <div>
          <div className="breadcrumb">
            <Link href="/">Trang chủ</Link> / {categoryName ?? "Danh mục"}
          </div>
          <h1>{categoryName ?? "Danh mục"}</h1>
          <p>{categoryDescription ?? ""}</p>
        </div>
      </div>
      {(catalogError || categoryLoadError) && (
        <p className="catalog-result-count" role="alert">
          {catalogError || categoryLoadError}
        </p>
      )}
      {(loading || loadingCategories) && <p role="status">Đang tải danh mục...</p>}
      {categories && !categoryName && !categoryLoadError && <p>Không tìm thấy danh mục.</p>}
      {categoryProducts.length > 0 && <div className="category-filter-toolbar" aria-label="Lọc sản phẩm">
        <details className="category-filter">
          <summary>
            Màu sắc{selectedColors.length > 0 && <span> ({selectedColors.length})</span>}
          </summary>
          <div className="category-filter-popover">
            {!availableColors.length && <span>Chưa có màu sắc.</span>}
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
          <summary>
            Kích cỡ{selectedSizes.length > 0 && <span> ({selectedSizes.length})</span>}
          </summary>
          <div className="category-filter-popover">
            {!availableSizes.length && <span>Chưa có kích cỡ.</span>}
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
          <summary>
            Thương hiệu{selectedBrands.length > 0 && <span> ({selectedBrands.length})</span>}
          </summary>
          <div className="category-filter-popover">
            {!availableBrands.length && <span>Chưa có thương hiệu.</span>}
            {availableBrands.map((brand) => (
              <label key={brand}>
                <input
                  type="checkbox"
                  checked={selectedBrands.includes(brand)}
                  onChange={() => toggleFilterValue(brand, selectedBrands, setSelectedBrands)}
                />
                {brand}
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
                onChange={(event) => {
                  setMinimumPrice(event.target.value);
                  setCurrentPage(1);
                }}
                placeholder="0"
              />
            </label>
            <label>
              Đến
              <input
                type="number"
                min="0"
                value={maximumPrice}
                onChange={(event) => {
                  setMaximumPrice(event.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Không giới hạn"
              />
            </label>
          </div>
        </details>
        <label className="category-sort">
          Trạng thái
          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="all">Tất cả</option>
            <option value="instock">Còn hàng</option>
            <option value="outofstock">Hết hàng</option>
            <option value="sale">Đang giảm giá</option>
          </select>
        </label>
        <label className="category-sort">
          Sắp xếp
          <select
            value={sort}
            onChange={(event) => {
              setSort(event.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="featured">Nổi bật</option>
            <option value="newest">Mới nhất</option>
            <option value="bestseller">Bán chạy</option>
            <option value="price-asc">Giá: thấp đến cao</option>
            <option value="price-desc">Giá: cao đến thấp</option>
          </select>
        </label>
        {hasActiveFilters && (
          <button className="category-filter-reset" type="button" onClick={clearFilters}>
            Xóa bộ lọc
          </button>
        )}
      </div>}
      {categoryName && !loading && !catalogError && (
        <p className="catalog-result-count">Tìm thấy {visibleProducts.length} sản phẩm</p>
      )}
      {paginatedProducts.length ? (
        <>
          <div className="product-grid">
            {paginatedProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
          {totalPages > 1 && (
            <nav className="catalog-pagination" aria-label="Phân trang danh mục">
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
        category &&
        !loading &&
        !catalogError && (
          <div className="empty-state">
            <h2>
              {categoryProducts.length ? "Không tìm thấy sản phẩm phù hợp" : "Danh mục đang được cập nhật"}
            </h2>
            <p>
              {categoryProducts.length
                ? "Thử thay đổi hoặc xóa bộ lọc để xem thêm sản phẩm."
                : "Hiện chưa có sản phẩm trong danh mục này."}
            </p>
            {categoryProducts.length > 0 && (
              <button className="pill-button" type="button" onClick={clearFilters}>
                Xóa bộ lọc
              </button>
            )}
          </div>
        )
      )}
    </section>
  );
}
