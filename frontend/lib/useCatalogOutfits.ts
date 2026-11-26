"use client";

import { useEffect, useState } from "react";
import { API_BASE_URL, readApiResponse } from "./api";

export type Outfit = {
  _id: string;
  title: string;
  description?: string;
  style?: string;
  occasion?: string;
  gallery?: string[];
  image: string;
  product_ids: string[];
  size_guide_product_ids?: string[];
};

export function useCatalogOutfits() {
  const [outfits, setOutfits] = useState<Outfit[]>();
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_BASE_URL}/catalog/outfits`, { signal: controller.signal, cache: "no-store" })
      .then(readApiResponse<Outfit[]>)
      .then((items) => { if (!controller.signal.aborted) setOutfits(items); })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Không thể tải bộ phối đồ.");
      });
    return () => controller.abort();
  }, []);

  return { outfits, error };
}
