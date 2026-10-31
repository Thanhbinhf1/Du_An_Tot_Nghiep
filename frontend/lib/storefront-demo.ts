"use client";

import { useSyncExternalStore } from "react";
import type { Product } from "@/types/product";
import {
  getCurrentDemoAccountStorageKey,
  getDemoAccountStorageKey,
  isDemoAuthenticated,
  useDemoAuth,
} from "@/lib/demo-auth";

export type CartItem = { productId: string; size: string; color?: string; quantity: number };
export type DeliveryAddress = {
  name: string;
  phone: string;
  address: string;
};
export type DemoOrder = {
  id: string;
  createdAt: string;
  status: "Đang xử lý" | "Đang giao" | "Đã giao";
  items: CartItem[];
  total: number;
  address: DeliveryAddress;
  delivery: string;
};

const emptyArray = "[]";

function notify() {
  window.dispatchEvent(new Event("bapd-storefront-change"));
}

function readStorage(key: string, account?: string) {
  return typeof window === "undefined"
    ? emptyArray
    : localStorage.getItem(
        account === undefined
          ? getCurrentDemoAccountStorageKey(key)
          : getDemoAccountStorageKey(account, key),
      ) ?? emptyArray;
}

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("bapd-storefront-change", callback);
  window.addEventListener("bapd-demo-auth-change", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("bapd-storefront-change", callback);
    window.removeEventListener("bapd-demo-auth-change", callback);
  };
}

export function useCartItems() {
  const { account, isLoggedIn } = useDemoAuth();
  const snapshot = useSyncExternalStore(
    subscribe,
    () => isLoggedIn && account ? readStorage("bapd-cart", account) : emptyArray,
    () => emptyArray,
  );
  return JSON.parse(snapshot) as CartItem[];
}

export function readCartItems() {
  if (!isDemoAuthenticated()) return [];
  return JSON.parse(readStorage("bapd-cart")) as CartItem[];
}

export function saveCartItems(items: CartItem[]) {
  if (!isDemoAuthenticated()) return false;
  localStorage.setItem(getCurrentDemoAccountStorageKey("bapd-cart"), JSON.stringify(items));
  notify();
  return true;
}

export function addCartItem(productId: string, size: string, color: string, quantity = 1) {
  if (!isDemoAuthenticated()) return false;
  const items = readCartItems();
  const existing = items.find(
    (item) => item.productId === productId && item.size === size && item.color === color,
  );
  if (existing) existing.quantity += quantity;
  else items.push({ productId, size, color, quantity });
  saveCartItems(items);
  return true;
}

export function useWishlistIds() {
  const { account } = useDemoAuth();
  const snapshot = useSyncExternalStore(
    subscribe,
    () => readStorage("bapd-wishlist", account),
    () => emptyArray,
  );
  return JSON.parse(snapshot) as string[];
}

export function toggleWishlist(productId: string) {
  const ids = JSON.parse(readStorage("bapd-wishlist")) as string[];
  const next = ids.includes(productId)
    ? ids.filter((id) => id !== productId)
    : [...ids, productId];
  localStorage.setItem(getCurrentDemoAccountStorageKey("bapd-wishlist"), JSON.stringify(next));
  notify();
}

export function useDemoOrders() {
  const { account } = useDemoAuth();
  const snapshot = useSyncExternalStore(
    subscribe,
    () => readStorage("bapd-orders", account),
    () => emptyArray,
  );
  return JSON.parse(snapshot) as DemoOrder[];
}

export function useDemoAddress() {
  const { account } = useDemoAuth();
  const snapshot = useSyncExternalStore(
    subscribe,
    () => typeof window === "undefined"
      ? "{}"
      : localStorage.getItem(getDemoAccountStorageKey(account, "bapd-address")) ?? "{}",
    () => "{}",
  );
  return JSON.parse(snapshot) as DeliveryAddress;
}

export function saveDemoAddress(address: DeliveryAddress) {
  localStorage.setItem(getCurrentDemoAccountStorageKey("bapd-address"), JSON.stringify(address));
  notify();
}

export function saveDemoProfileName(name: string) {
  localStorage.setItem(getCurrentDemoAccountStorageKey("bapd-profile-name"), name);
  notify();
}

export function saveDemoProfileNameIfMissing(name: string) {
  const key = getCurrentDemoAccountStorageKey("bapd-profile-name");
  if (localStorage.getItem(key)) return;
  localStorage.setItem(key, name);
  notify();
}

export function useDemoProfileName() {
  const { account } = useDemoAuth();
  return useSyncExternalStore(
    subscribe,
    () => typeof window === "undefined"
      ? ""
      : localStorage.getItem(getDemoAccountStorageKey(account, "bapd-profile-name")) ?? "",
    () => "",
  );
}

export function createDemoOrder(
  products: Product[],
  address: DeliveryAddress,
  delivery: string,
) {
  const items = readCartItems();
  if (!items.length) return null;
  const total = items.reduce((sum, item) => {
    const product = products.find((candidate) => candidate.id === item.productId);
    return sum + (product?.price ?? 0) * item.quantity;
  }, 0);
  const orders = JSON.parse(readStorage("bapd-orders")) as DemoOrder[];
  const order: DemoOrder = {
    id: `BAPD-${Date.now().toString().slice(-8)}`,
    createdAt: new Date().toISOString(),
    status: "Đang xử lý",
    items,
    total,
    address,
    delivery,
  };
  localStorage.setItem(getCurrentDemoAccountStorageKey("bapd-orders"), JSON.stringify([order, ...orders]));
  localStorage.setItem(getCurrentDemoAccountStorageKey("bapd-cart"), emptyArray);
  notify();
  return order;
}
