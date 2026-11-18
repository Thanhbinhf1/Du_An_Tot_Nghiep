"use client";

import { useEffect, useState } from "react";
import { API_BASE_URL, readApiResponse, type ApiCategory } from "./api";

export function useCatalogCategories() {
  const [result, setResult] = useState<{ categories?: ApiCategory[]; error: string }>();

  useEffect(() => {
    let controller: AbortController;
    function refresh() {
      controller?.abort();
      controller = new AbortController();
      const { signal } = controller;
      fetch(`${API_BASE_URL}/catalog/categories`, { signal, cache: "no-store" })
        .then(readApiResponse<ApiCategory[]>)
        .then((categories) => {
          if (!signal.aborted) setResult({ categories, error: "" });
        })
        .catch((cause: unknown) => {
          if (!signal.aborted) {
            setResult((previous) => ({
              categories: previous?.categories,
              error: cause instanceof Error ? cause.message : "Không thể tải danh mục.",
            }));
          }
        });
    }
    refresh();
    window.addEventListener("fstyle-catalog-change", refresh);
    return () => {
      controller.abort();
      window.removeEventListener("fstyle-catalog-change", refresh);
    };
  }, []);

  return { categories: result?.categories, error: result?.error ?? "", loading: !result };
}
