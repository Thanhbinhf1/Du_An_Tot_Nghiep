"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import CategoryTiles from "@/components/product/CategoryTiles";
import { getAudienceName } from "@/lib/catalog-audience";
import { API_BASE_URL, readApiResponse, type ApiCategory, type ApiProduct } from "@/lib/api";

type Suggestion = Pick<ApiProduct, "_id" | "name">;

export default function SearchSuggestions({ query, categories, onNavigate, onClose }: {
  query: string;
  categories: ApiCategory[];
  onNavigate: () => void;
  onClose?: () => void;
}) {
  const keyword = query.trim();
  const [result, setResult] = useState<{ keyword: string; products?: Suggestion[]; failed?: boolean }>();

  useEffect(() => {
    if (keyword.length < 2) return;
    const controller = new AbortController();
    const delay = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({ keyword, limit: "6" });
        const response = await fetch(`${API_BASE_URL}/products?${params}`, { signal: controller.signal });
        const products = await readApiResponse<Suggestion[]>(response);
        if (!controller.signal.aborted) setResult({ keyword, products });
      } catch {
        if (!controller.signal.aborted) setResult({ keyword, failed: true });
      }
    }, 250);
    return () => { window.clearTimeout(delay); controller.abort(); };
  }, [keyword]);

  const visualCategories = categories.filter((c) => !getAudienceName(c.slug)).slice(0, 12);

  if (keyword.length < 2) {
    return (
      <div id="header-search-results" className="header-search-overlay" aria-label="Tìm kiếm theo danh mục">
        <div className="search-overlay-inner">
          <div className="search-overlay-top">
            <span className="search-overlay-label">Danh mục phổ biến</span>
            {onClose && (
              <button type="button" className="search-overlay-close" onClick={onClose} aria-label="Đóng tìm kiếm">
                ×
              </button>
            )}
          </div>
          {visualCategories.length > 0 && (
            <CategoryTiles categories={visualCategories} onNavigate={onNavigate} />
          )}
        </div>
      </div>
    );
  }

  const current = result?.keyword === keyword ? result : undefined;
  const normalized = keyword.toLocaleLowerCase("vi");
  const matchingCategories = categories.filter(({ name }) => name.toLocaleLowerCase("vi").includes(normalized)).slice(0, 6);

  return (
    <div id="header-search-results" className="header-search-overlay" aria-label="Gợi ý tìm kiếm">
      <div className="search-overlay-inner">
        <div className="search-overlay-top">
          <span className="search-overlay-label">Kết quả gợi ý cho &ldquo;{keyword}&rdquo;</span>
          {onClose && (
            <button type="button" className="search-overlay-close" onClick={onClose} aria-label="Đóng tìm kiếm">
              ×
            </button>
          )}
        </div>
        {!current && <p className="search-overlay-status" role="status">Đang tìm sản phẩm…</p>}
        {current?.failed && <p className="search-overlay-status" role="status">Gợi ý đang gián đoạn. Nhấn Enter để mở trang tìm kiếm.</p>}
        {current?.products?.length === 0 && <p className="search-overlay-status" role="status">Chưa tìm thấy sản phẩm theo từ khóa này.</p>}
        {current?.products && current.products.length > 0 && (
          <ul className="search-suggestion-list" aria-label="Sản phẩm gợi ý">
            {current.products.map(({ _id, name }) => (
              <li key={_id}>
                <Link href={`/product/${_id}`} onClick={onNavigate}>{name}</Link>
              </li>
            ))}
          </ul>
        )}
        {matchingCategories.length > 0 && (
          <div className="search-overlay-cats">
            <span className="search-overlay-label">Danh mục liên quan</span>
            <CategoryTiles categories={matchingCategories} onNavigate={onNavigate} />
          </div>
        )}
        <Link className="header-search-all" href={`/search?${new URLSearchParams({ q: keyword })}`} onClick={onNavigate}>
          Xem tất cả kết quả cho &ldquo;{keyword}&rdquo; →
        </Link>
      </div>
    </div>
  );
}
