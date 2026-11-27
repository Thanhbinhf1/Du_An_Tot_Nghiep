"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { changeCatalogFilters } from "@/lib/catalog-query";
import Link from "next/link";
import CategoryTiles from "@/components/product/CategoryTiles";
import ProductCard from "@/components/product/ProductCard";
import CatalogFilterDrawer from "@/components/product/CatalogFilterDrawer";
import { useCatalogProducts } from "@/lib/useCatalogProducts";
import { useCatalogCategories } from "@/lib/useCatalogCategories";
import { STORE_NAME } from "@/lib/store-brand";
import { getAudienceName, getCategoryTree } from "@/lib/catalog-audience";
import { featuredRatingSort } from "@/lib/product-sorting";
import { matchesCatalogFilter } from "@/lib/catalog-filter";

const PAGE_SIZE = 12;

export default function CategoryPage({ slug, audience }: { slug: string; audience?: string }) {
  const { categories, error: categoryLoadError, loading: loadingCategories } = useCatalogCategories();
  const params = useSearchParams();
  const selectedColors = useMemo(() => params.getAll("color"), [params]);
  const selectedSizes = useMemo(() => params.getAll("size"), [params]);
  const selectedBrands = useMemo(() => params.getAll("brand"), [params]);
  const statusParam = params.get("status") ?? "";
  const statusFilter = ["instock", "outofstock", "sale"].includes(statusParam) ? statusParam : "all";
  const minimumPrice = params.get("minPrice") ?? "";
  const maximumPrice = params.get("maxPrice") ?? "";
  const sortParam = params.get("sort") ?? "";
  const sort = ["newest", "price-asc", "price-desc", featuredRatingSort.value].includes(sortParam) ? sortParam : "featured";
  const page = Number(params.get("page"));
  const currentPage = Number.isSafeInteger(page) && page > 0 ? page : 1;
  const { products, error: catalogError, loading } = useCatalogProducts();

  const category = categories?.find((item) => item.slug === slug);
  const isAudience = Boolean(getAudienceName(slug));
  const audienceSlug = isAudience ? slug : audience && getAudienceName(audience) ? audience : "";
  const categoryName = category?.name ?? getAudienceName(slug);
  const categoryDescription = category?.description;
  const subcategories = category ? categories?.filter((item) => item.parent_id === category._id) ?? [] : [];

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
    ...new Set(categoryProducts.map((product) => product.brand ?? STORE_NAME).filter(Boolean)),
  ].sort();

  const visibleProducts = useMemo(() => {
    const min = minimumPrice === "" ? undefined : Number(minimumPrice);
    const max = maximumPrice === "" ? undefined : Number(maximumPrice);
    const filtered = categoryProducts.filter((product) => {
      const matchesBrand = !selectedBrands.length || selectedBrands.includes(product.brand ?? STORE_NAME);
      return matchesBrand && matchesCatalogFilter(product, {
        sizes: selectedSizes, colors: selectedColors, min: min ?? 0, max: max ?? Infinity, status: statusFilter,
      });
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
    if (sort === featuredRatingSort.value) filtered.sort(featuredRatingSort.compare);
    return filtered;
  }, [categoryProducts, maximumPrice, minimumPrice, selectedBrands, selectedColors, selectedSizes, sort, statusFilter]);

  function toggleFilterValue(key: string, value: string, selected: string[]) {
    changeCatalogFilters({ [key]: selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value] });
  }

  function clearFilters() {
    changeCatalogFilters({ color: "", size: "", brand: "", status: "", minPrice: "", maxPrice: "", sort: "" });
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
          {categoryDescription && <p>{categoryDescription}</p>}
        </div>
      </div>
      {subcategories.length > 0 && (
        <nav className="catalog-subcategories" aria-label="Danh mục con">
          <CategoryTiles categories={subcategories} audience={audienceSlug || undefined} />
        </nav>
      )}
      {(catalogError || categoryLoadError) && (
        <p className="catalog-result-count" role="alert">
          {catalogError || categoryLoadError}
        </p>
      )}
      {(loading || loadingCategories) && <p role="status">Đang tải danh mục...</p>}
      {categories && !categoryName && !categoryLoadError && <p>Không tìm thấy danh mục.</p>}
      <div className="category-results">
      {categoryProducts.length > 0 && <div className="store-catalog-controls">
        <p className="catalog-result-count" aria-live="polite">Kết quả: {visibleProducts.length} sản phẩm</p>
        <label className="store-catalog-sort">
          Sắp xếp theo
          <select
            value={sort}
            onChange={(event) => changeCatalogFilters({ sort: event.target.value === "featured" ? "" : event.target.value })}
          >
            <option value="featured">Nổi bật</option>
            <option value="newest">Mới nhất</option>
            <option value={featuredRatingSort.value}>{featuredRatingSort.label}</option>
            <option value="price-asc">Giá: thấp đến cao</option>
            <option value="price-desc">Giá: cao đến thấp</option>
          </select>
        </label>
        <CatalogFilterDrawer active={hasActiveFilters} count={visibleProducts.length} onReset={clearFilters}>
          <div className="catalog-toolbar category-filter-panel">
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
                      onChange={() => toggleFilterValue("color", color, selectedColors)}
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
                      onChange={() => toggleFilterValue("size", size, selectedSizes)}
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
                      onChange={() => toggleFilterValue("brand", brand, selectedBrands)}
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
                    onChange={(event) => changeCatalogFilters({ minPrice: event.target.value }, true)}
                    placeholder="0"
                  />
                </label>
                <label>
                  Đến
                  <input
                    type="number"
                    min="0"
                    value={maximumPrice}
                    onChange={(event) => changeCatalogFilters({ maxPrice: event.target.value }, true)}
                    placeholder="Không giới hạn"
                  />
                </label>
              </div>
            </details>
            <label className="category-sort">
              Trạng thái
              <select
                value={statusFilter}
                onChange={(event) => changeCatalogFilters({ status: event.target.value === "all" ? "" : event.target.value })}
              >
                <option value="all">Tất cả</option>
                <option value="instock">Còn hàng</option>
                <option value="outofstock">Hết hàng</option>
                <option value="sale">Đang giảm giá</option>
              </select>
            </label>
          </div>
        </CatalogFilterDrawer>
      </div>}
      {categoryName && !loading && !catalogError && categoryProducts.length === 0 && (
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
                onClick={() => changeCatalogFilters({ page: safePage > 2 ? String(safePage - 1) : "" })}
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
                    onClick={() => changeCatalogFilters({ page: pageNumber > 1 ? String(pageNumber) : "" })}
                  >
                    {pageNumber}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="pagination-btn"
                disabled={safePage >= totalPages}
                onClick={() => changeCatalogFilters({ page: String(safePage + 1) })}
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
      </div>
    </section>
  );
}
