"use client";

import { useSyncExternalStore } from "react";
import type { Product } from "@/types/product";

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

function readStorage(key: string) {
  return typeof window === "undefined"
    ? emptyArray
    : localStorage.getItem(key) ?? emptyArray;
}

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("bapd-storefront-change", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("bapd-storefront-change", callback);
  };
}

export function useCartItems() {
  const snapshot = useSyncExternalStore(
    subscribe,
    () => readStorage("bapd-cart"),
    () => emptyArray,
  );
  return JSON.parse(snapshot) as CartItem[];
}

export function readCartItems() {
  return JSON.parse(readStorage("bapd-cart")) as CartItem[];
}

export function saveCartItems(items: CartItem[]) {
  localStorage.setItem("bapd-cart", JSON.stringify(items));
  notify();
}

export function addCartItem(productId: string, size: string, color: string) {
  const items = readCartItems();
  const existing = items.find(
    (item) => item.productId === productId && item.size === size && item.color === color,
  );
  if (existing) existing.quantity += 1;
  else items.push({ productId, size, color, quantity: 1 });
  saveCartItems(items);
}

export function useWishlistIds() {
  const snapshot = useSyncExternalStore(
    subscribe,
    () => readStorage("bapd-wishlist"),
    () => emptyArray,
  );
  return JSON.parse(snapshot) as string[];
}

export function toggleWishlist(productId: string) {
  const ids = JSON.parse(readStorage("bapd-wishlist")) as string[];
  const next = ids.includes(productId)
    ? ids.filter((id) => id !== productId)
    : [...ids, productId];
  localStorage.setItem("bapd-wishlist", JSON.stringify(next));
  notify();
}

export function useDemoOrders() {
  const snapshot = useSyncExternalStore(
    subscribe,
    () => readStorage("bapd-orders"),
    () => emptyArray,
  );
  return JSON.parse(snapshot) as DemoOrder[];
}

export function useDemoAddress() {
  const snapshot = useSyncExternalStore(
    subscribe,
    () => typeof window === "undefined" ? "{}" : localStorage.getItem("bapd-address") ?? "{}",
    () => "{}",
  );
  return JSON.parse(snapshot) as DeliveryAddress;
}

export function saveDemoAddress(address: DeliveryAddress) {
  localStorage.setItem("bapd-address", JSON.stringify(address));
}

export function saveDemoProfileName(name: string) {
  localStorage.setItem("bapd-profile-name", name);
}

export function useDemoProfileName() {
  return useSyncExternalStore(
    subscribe,
    () => typeof window === "undefined" ? "" : localStorage.getItem("bapd-profile-name") ?? "",
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
  localStorage.setItem("bapd-orders", JSON.stringify([order, ...orders]));
  localStorage.setItem("bapd-cart", emptyArray);
  return order;
}
