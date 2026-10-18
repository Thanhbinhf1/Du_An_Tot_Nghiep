"use client";

import { useSyncExternalStore } from "react";

const serverSnapshot = JSON.stringify([false, "", "customer", ""]);
export type AccountRole = "customer" | "staff" | "admin";

function getSnapshot() {
  if (typeof window === "undefined") return serverSnapshot;
  const storage =
    localStorage.getItem("bapd-demo-authenticated") === "true"
      ? localStorage
      : sessionStorage;
  return JSON.stringify([
    storage.getItem("bapd-demo-authenticated") === "true",
    storage.getItem("bapd-demo-account") ?? "",
    storage.getItem("bapd-demo-role") ?? "customer",
    storage.getItem("bapd-demo-token") ?? "",
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
  const [isLoggedIn, account, role, token] = JSON.parse(snapshot) as [
    boolean,
    string,
    AccountRole,
    string,
  ];
  const isHydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  return { isLoggedIn, account, role, token, isHydrated };
}

export function signIn(account: string, role: AccountRole, token: string, remember: boolean) {
  localStorage.removeItem("bapd-demo-authenticated");
  localStorage.removeItem("bapd-demo-account");
  localStorage.removeItem("bapd-demo-role");
  localStorage.removeItem("bapd-demo-token");
  sessionStorage.removeItem("bapd-demo-authenticated");
  sessionStorage.removeItem("bapd-demo-account");
  sessionStorage.removeItem("bapd-demo-role");
  sessionStorage.removeItem("bapd-demo-token");
  const storage = remember ? localStorage : sessionStorage;
  storage.setItem("bapd-demo-authenticated", "true");
  storage.setItem("bapd-demo-account", account.trim());
  storage.setItem("bapd-demo-role", role);
  storage.setItem("bapd-demo-token", token);
  window.dispatchEvent(new Event("bapd-demo-auth-change"));
}

export function signOutDemo() {
  localStorage.removeItem("bapd-demo-authenticated");
  localStorage.removeItem("bapd-demo-account");
  localStorage.removeItem("bapd-demo-role");
  localStorage.removeItem("bapd-demo-token");
  sessionStorage.removeItem("bapd-demo-authenticated");
  sessionStorage.removeItem("bapd-demo-account");
  sessionStorage.removeItem("bapd-demo-role");
  sessionStorage.removeItem("bapd-demo-token");
  window.dispatchEvent(new Event("bapd-demo-auth-change"));
}
