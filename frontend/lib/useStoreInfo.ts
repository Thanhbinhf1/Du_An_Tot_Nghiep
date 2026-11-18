"use client";

import { useEffect, useState } from "react";
import { API_BASE_URL, readApiResponse } from "./api";

type StoreInfo = { store_name: string; tagline: string; hotline: string; email: string; address: string };

export function useStoreInfo() {
  const [info, setInfo] = useState<StoreInfo>();

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_BASE_URL}/catalog/store-info`, { signal: controller.signal, cache: "no-store" })
      .then(readApiResponse<StoreInfo>)
      .then((data) => { if (!controller.signal.aborted) setInfo(data); })
      .catch(() => { /* The page can render with the store brand while the API is unavailable. */ });
    return () => controller.abort();
  }, []);

  return info;
}
