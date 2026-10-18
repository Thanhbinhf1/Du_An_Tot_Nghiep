"use client";

import { useSyncExternalStore } from "react";

export const DEMO_CREDENTIALS = {
  account: "demo@vcsbapd.vn",
  password: "Bapd@123456",
} as const;

const serverSnapshot = JSON.stringify([false, ""]);

function getSnapshot() {
  if (typeof window === "undefined") return serverSnapshot;
  const storage =
    localStorage.getItem("bapd-demo-authenticated") === "true"
      ? localStorage
      : sessionStorage;
  return JSON.stringify([
    storage.getItem("bapd-demo-authenticated") === "true",
    storage.getItem("bapd-demo-account") ?? "",
  ]);
}

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("bapd-demo-auth-change", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("bapd-demo-auth-change", callback);
  };
}

export function useDemoAuth() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => serverSnapshot);
  const [isLoggedIn, account] = JSON.parse(snapshot) as [boolean, string];
  return { isLoggedIn, account };
}

export function signInDemo(account: string, remember: boolean) {
  localStorage.removeItem("bapd-demo-authenticated");
  localStorage.removeItem("bapd-demo-account");
  sessionStorage.removeItem("bapd-demo-authenticated");
  sessionStorage.removeItem("bapd-demo-account");
  const storage = remember ? localStorage : sessionStorage;
  storage.setItem("bapd-demo-authenticated", "true");
  storage.setItem("bapd-demo-account", account.trim());
  window.dispatchEvent(new Event("bapd-demo-auth-change"));
}

export function signOutDemo() {
  localStorage.removeItem("bapd-demo-authenticated");
  localStorage.removeItem("bapd-demo-account");
  sessionStorage.removeItem("bapd-demo-authenticated");
  sessionStorage.removeItem("bapd-demo-account");
  window.dispatchEvent(new Event("bapd-demo-auth-change"));
}
