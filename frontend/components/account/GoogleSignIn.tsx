"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { API_BASE_URL, readApiResponse } from "@/lib/api";
import { signIn, type AccountRole } from "@/lib/demo-auth";
import styles from "@/app/auth.module.css";

type GoogleIdentity = {
  initialize: (options: { client_id: string; callback: (result: { credential: string }) => void }) => void;
  renderButton: (element: HTMLElement, options: { theme: string; size: string; text: string; locale: string; width: number }) => void;
};

export default function GoogleSignIn({ remember = true, acceptedTerms = true, signUp = false, redirectTo }: {
  remember?: boolean;
  acceptedTerms?: boolean;
  signUp?: boolean;
  redirectTo?: string;
}) {
  const router = useRouter();
  const target = useRef<HTMLDivElement>(null);
  const [clientId, setClientId] = useState<string | null>();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_BASE_URL}/auth/google`, { signal: controller.signal, cache: "no-store" })
      .then(readApiResponse<{ clientId: string | null }>)
      .then(({ clientId }) => { if (!controller.signal.aborted) setClientId(clientId); })
      .catch(() => {
        if (!controller.signal.aborted) {
          setClientId(null);
          setError("Không thể kiểm tra cấu hình Google.");
        }
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const element = target.current;
    const google = (window as Window & { google?: { accounts: { id: GoogleIdentity } } }).google;
    if (!clientId || !ready || !acceptedTerms || !element || !google) return;
    let active = true;
    google.accounts.id.initialize({
      client_id: clientId,
      callback: async ({ credential }) => {
        if (!active) return;
        setBusy(true);
        setError("");
        try {
          const response = await fetch(`${API_BASE_URL}/auth/google`, {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ credential }),
          });
          const user = await readApiResponse<{ email: string; role: AccountRole; token: string }>(response);
          if (!active) return;
          signIn(user.email, user.role, user.token, remember);
          router.replace(redirectTo ?? (user.role === "customer" ? "/profile" : "/admin"));
        } catch (cause) {
          if (active) setError(cause instanceof Error ? cause.message : "Đăng nhập Google thất bại.");
        } finally {
          if (active) setBusy(false);
        }
      },
    });
    google.accounts.id.renderButton(element, {
      theme: "outline", size: "large", text: signUp ? "signup_with" : "continue_with", locale: "vi", width: Math.min(340, element.clientWidth || 280),
    });
    return () => { active = false; element.replaceChildren(); };
  }, [acceptedTerms, clientId, ready, redirectTo, remember, router, signUp]);

  return (
    <div>
      <div className={styles.divider}>Hoặc</div>
      {clientId && <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive"
        onReady={() => setReady(true)} onError={() => setError("Không thể tải đăng nhập Google.")} />}
      {clientId && ready && acceptedTerms
        ? <div className={styles.googleMount} ref={target} aria-busy={busy} />
        : <button type="button" className={styles.google} disabled>{signUp ? "Đăng ký bằng Google" : "Tiếp tục với Google"}</button>}
      {clientId === null && !error && <p className="small muted">Google chưa được cấu hình cho cửa hàng.</p>}
      {clientId && !acceptedTerms && <p className="small muted">Đồng ý điều khoản để đăng ký với Google.</p>}
      {busy && <p role="status">Đang xác minh tài khoản Google…</p>}
      {error && <p role="alert" className={styles.loginError}>{error}</p>}
    </div>
  );
}
