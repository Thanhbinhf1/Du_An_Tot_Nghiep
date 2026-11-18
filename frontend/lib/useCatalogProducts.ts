"use client";

import { useEffect, useState } from "react";
import { API_BASE_URL, mapApiProduct, readApiEnvelope, type ApiProduct } from "@/lib/api";
import type { Product } from "@/types/product";

export function useCatalogProducts() {
  const [result, setResult] = useState<{ products: Product[]; error: string }>();

  useEffect(() => {
    const controller = new AbortController();

    async function loadProducts() {
      const products: Product[] = [];
      let page = 1;
      let totalPages: number;
      do {
        const response = await fetch(`${API_BASE_URL}/products?view=storefront&limit=100&page=${page}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        const { data: items, pagination } = await readApiEnvelope<ApiProduct[]>(response);
        products.push(...items.map(mapApiProduct));
        totalPages = pagination?.totalPages ?? 1;
        page += 1;
      } while (page <= totalPages);
      if (!controller.signal.aborted) setResult({ products, error: "" });
    }

    void loadProducts().catch((cause: unknown) => {
      if (!controller.signal.aborted) {
        setResult({ products: [], error: cause instanceof Error ? cause.message : "Không thể tải sản phẩm." });
      }
    });
    return () => controller.abort();
  }, []);

  return { products: result?.products ?? [], error: result?.error ?? "", loading: !result };
}
