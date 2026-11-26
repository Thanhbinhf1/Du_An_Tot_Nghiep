"use client";

import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { getAccountProfile } from "@/lib/account-api";
import { signOutDemo } from "@/lib/demo-auth";

export function useAccountSession(token: string) {
  const [profile, setProfile] = useState<{ token: string; name: string }>();
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    let revision = 0;
    async function refresh() {
      const request = ++revision;
      try {
        const data = await getAccountProfile(token, controller.signal);
        if (controller.signal.aborted || request !== revision) return;
        setProfile({ token, name: data.name });
        setNotice("");
      } catch (error) {
        if (controller.signal.aborted || request !== revision || !(error instanceof ApiError)) return;
        if (error.status === 401 || error.status === 403) {
          // A slow request for the old account must never clear a newer login.
          const active = localStorage.getItem("bapd-demo-authenticated") === "true" ? localStorage : sessionStorage;
          if (active.getItem("bapd-demo-token") !== token) return;
          setNotice(error.message);
          signOutDemo();
        }
      }
    }
    void refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener("bapd-profile-updated", refresh);
    let timer: number | undefined;
    try {
      const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
      const delay = Number(payload.exp) * 1000 - Date.now();
      if (Number.isFinite(delay) && delay > 0 && delay < 2147483000) {
        timer = window.setTimeout(refresh, delay + 250);
      }
    } catch { /* The server validates opaque and malformed sessions. */ }
    return () => {
      controller.abort();
      window.clearTimeout(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("bapd-profile-updated", refresh);
    };
  }, [token]);

  return { name: profile?.token === token ? profile.name : "", notice: token ? "" : notice };
}
