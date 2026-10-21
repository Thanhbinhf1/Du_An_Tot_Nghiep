"use client";

import { useEffect, useState } from "react";
import { products as sampleProducts } from "@/data/products";
import { API_BASE_URL, mapApiProduct, readApiResponse, type ApiProduct } from "@/lib/api";
import type { Product } from "@/types/product";

export function useCatalogProducts() {
  const [products, setProducts] = useState<Product[]>(sampleProducts);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch(`${API_BASE_URL}/catalog/products`)
      .then(readApiResponse<ApiProduct[]>)
      .then((result) => {
        if (!active) return;
        const catalogProducts = result.map(mapApiProduct);
        const localShowcaseProducts = sampleProducts.filter((product) =>
          product.id.includes("-featured-"),
        );
        setProducts([...catalogProducts, ...localShowcaseProducts]);
        setError("");
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Không thể tải sản phẩm.");
      });
    return () => { active = false; };
  }, []);

  return { products, error };
}
