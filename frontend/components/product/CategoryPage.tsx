"use client";

import { useEffect, useState } from "react";
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
  const categoryProducts = products.filter((product) =>
    product.category === categoryName
    && !hiddenProductCodes?.has(product.code.toLowerCase()),
  );

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
      <p className="catalog-result-count">Tìm thấy {categoryProducts.length} sản phẩm</p>
      {categoryProducts.length ? (
        <div className="product-grid">
          {categoryProducts.map((product) => <ProductCard key={product.id} product={product} />)}
        </div>
      ) : (
        <div className="empty-state">
          <h2>Danh mục đang được cập nhật</h2>
          <p>Hiện chưa có sản phẩm trong danh mục này.</p>
        </div>
      )}
    </section>
  );
}
