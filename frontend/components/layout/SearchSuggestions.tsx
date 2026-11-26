"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { API_BASE_URL, readApiResponse, type ApiCategory, type ApiProduct } from "@/lib/api";

type Suggestion = Pick<ApiProduct, "_id" | "name">;

export default function SearchSuggestions({ query, categories, onNavigate }: {
  query: string;
  categories: ApiCategory[];
  onNavigate: () => void;
}) {
  const keyword = query.trim();
  const [result, setResult] = useState<{ keyword: string; products?: Suggestion[]; failed?: boolean }>();

  useEffect(() => {
    if (keyword.length < 2) return;
    const controller = new AbortController();
    const delay = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({ keyword, limit: "5" });
        const response = await fetch(`${API_BASE_URL}/products?${params}`, { signal: controller.signal });
        const products = await readApiResponse<Suggestion[]>(response);
        if (!controller.signal.aborted) setResult({ keyword, products });
      } catch {
        if (!controller.signal.aborted) setResult({ keyword, failed: true });
      }
    }, 250);
    return () => { window.clearTimeout(delay); controller.abort(); };
  }, [keyword]);

  if (keyword.length < 2) return null;
  const current = result?.keyword === keyword ? result : undefined;
  const normalized = keyword.toLocaleLowerCase("vi");
  const matchingCategories = categories.filter(({ name }) => name.toLocaleLowerCase("vi").includes(normalized)).slice(0, 3);

  return (
    <div id="header-search-results" className="header-search-results" aria-label="Gợi ý tìm kiếm">
      {!current && <p role="status">Đang tìm sản phẩm…</p>}
      {current?.failed && <p role="status">Gợi ý đang gián đoạn. Nhấn Enter để mở trang tìm kiếm.</p>}
      {current?.products?.length === 0 && <p role="status">Chưa tìm thấy sản phẩm theo tên này.</p>}
      {current?.products && current.products.length > 0 && (
        <ul aria-label="Sản phẩm gợi ý">
          {current.products.map(({ _id, name }) => <li key={_id}><Link href={`/product/${_id}`} onClick={onNavigate}>{name}</Link></li>)}
        </ul>
      )}
      {matchingCategories.length > 0 && (
        <ul aria-label="Danh mục liên quan">
          {matchingCategories.map(({ _id, name, slug }) => <li key={_id}><Link href={`/categories/${slug}`} onClick={onNavigate}>{name}</Link></li>)}
        </ul>
      )}
      <Link className="header-search-all" href={`/search?${new URLSearchParams({ q: keyword })}`} onClick={onNavigate}>Xem kết quả tìm kiếm</Link>
    </div>
  );
}
