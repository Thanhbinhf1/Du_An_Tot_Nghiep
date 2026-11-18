"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { API_BASE_URL, authenticatedHeaders, readApiResponse } from "@/lib/api";
import { getDemoAccountStorageKey, useDemoAuth } from "@/lib/demo-auth";
import { toggleWishlist, useWishlistIds } from "@/lib/storefront-demo";

type Wishlist = {
  ids: string[];
  loading: boolean;
  busy: boolean;
  error: string;
  toggle: (id: string) => Promise<void>;
};
const WishlistContext = createContext<Wishlist | null>(null);

export function useWishlist() {
  const value = useContext(WishlistContext);
  if (!value) throw new Error("Thiếu WishlistProvider.");
  return value;
}

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { token, account, isHydrated } = useDemoAuth();
  const guestIds = useWishlistIds();
  const [saved, setSaved] = useState<{ token: string; ids: string[] }>();
  const [failure, setFailure] = useState<{ token: string; message: string }>();
  const [busyToken, setBusyToken] = useState("");
  const activeRequest = useRef<AbortController | null>(null);
  const changing = useRef("");
  const revision = useRef(0);
  const ids = saved?.token === token ? saved.ids : undefined;
  const error = failure?.token === token ? failure.message : "";

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    activeRequest.current = controller;
    const headers = authenticatedHeaders(token);
    const localKey = getDemoAccountStorageKey(account, "bapd-wishlist");
    let importing = false;
    let imported = false;
    async function refresh(importLegacy: boolean) {
      if (changing.current === token || importing) return;
      importing = importLegacy;
      const current = ++revision.current;
      try {
        if (importLegacy) {
          let legacy: unknown;
          try { legacy = JSON.parse(localStorage.getItem(localKey) ?? "[]"); } catch { legacy = []; }
          if (Array.isArray(legacy)) {
            const ids = [...new Set(legacy.filter((id): id is string => typeof id === "string" && /^[a-f0-9]{24}$/i.test(id)))];
            for (let offset = 0; offset < ids.length; offset += 100) {
              const response = await fetch(`${API_BASE_URL}/wishlist/import`, {
                method: "POST", signal: controller.signal, headers: { ...headers, "Content-Type": "application/json" },
                body: JSON.stringify({ productIds: ids.slice(offset, offset + 100) }),
              });
              await readApiResponse<string[]>(response);
            }
            if (ids.length && !controller.signal.aborted) localStorage.removeItem(localKey);
          }
          imported = true;
        }
        const response = await fetch(`${API_BASE_URL}/wishlist`, { headers, signal: controller.signal, cache: "no-store" });
        const data = await readApiResponse<string[]>(response);
        if (current === revision.current && !controller.signal.aborted) {
          setSaved({ token, ids: data });
          setFailure(undefined);
        }
      } catch (cause) {
        if (current === revision.current && !controller.signal.aborted) {
          setFailure({ token, message: cause instanceof Error ? cause.message : "Không thể tải sản phẩm yêu thích." });
        }
      } finally {
        importing = false;
      }
    }
    void refresh(true);
    const onFocus = () => { void refresh(!imported); };
    window.addEventListener("focus", onFocus);
    return () => {
      controller.abort();
      if (activeRequest.current === controller) activeRequest.current = null;
      window.removeEventListener("focus", onFocus);
    };
  }, [account, token]);

  async function toggle(id: string) {
    if (!token) { toggleWishlist(id); return; }
    const controller = activeRequest.current;
    if (changing.current === token || !ids || !controller) return;
    changing.current = token;
    revision.current += 1;
    setBusyToken(token);
    setFailure(undefined);
    try {
      const response = await fetch(`${API_BASE_URL}/wishlist/${encodeURIComponent(id)}`, {
        method: ids.includes(id) ? "DELETE" : "PUT", headers: authenticatedHeaders(token), signal: controller.signal,
      });
      const data = await readApiResponse<string[]>(response);
      if (!controller.signal.aborted) setSaved({ token, ids: data });
    } catch (cause) {
      if (!controller.signal.aborted) {
        setFailure({ token, message: cause instanceof Error ? cause.message : "Không thể cập nhật yêu thích." });
      }
    } finally {
      if (changing.current === token) changing.current = "";
      setBusyToken((current) => current === token ? "" : current);
    }
  }

  return <WishlistContext.Provider value={{
    ids: token ? ids ?? [] : guestIds,
    loading: !isHydrated || Boolean(token && !ids),
    busy: Boolean(token && busyToken === token),
    error,
    toggle,
  }}>{children}</WishlistContext.Provider>;
}
