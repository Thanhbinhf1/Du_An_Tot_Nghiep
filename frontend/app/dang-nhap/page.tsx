"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "@/lib/demo-auth";
import { API_BASE_URL, readApiResponse } from "@/lib/api";
import styles from "../auth.module.css";
import GoogleSignIn from "@/components/account/GoogleSignIn";
import AuthShell from "@/components/account/AuthShell";

export default function DangNhapPage() {
  return <Suspense><LoginForm /></Suspense>;
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const returnTo = params.get("returnTo") ?? "";
  const reviewDestination = /^\/product\/[a-f\d]{24}#product-reviews$/i.test(returnTo) ? returnTo : undefined;
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setLoginError("");
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: account, password }),
      });
      const user = await readApiResponse<{
        email: string;
        role: "customer" | "staff" | "admin";
        token: string;
      }>(response);
      signIn(user.email, user.role, user.token, remember);
      router.replace(reviewDestination ?? (user.role === "customer" ? "/profile" : "/admin"));
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "Không thể đăng nhập.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell>
      <h1 className={styles.title}>Đăng nhập</h1>
      <p className={styles.subtitle}>
        Đăng nhập để theo dõi đơn hàng, lưu sản phẩm yêu thích và nhận ưu đãi độc quyền.
      </p>
      {params.get("passwordChanged") === "1" && (
        <p role="status" style={{ color: "#267844", fontSize: 13, marginBottom: 12 }}>
          ✓ Đã đổi mật khẩu thành công. Hãy đăng nhập bằng mật khẩu mới của bạn.
        </p>
      )}

      <form onSubmit={handleLogin}>
        <label className={styles.field}>
          <span className={styles.label}>Email tài khoản</span>
          <span className={styles.inputWrap}>
            <input
              className={styles.input}
              type="email"
              name="account"
              placeholder="Nhập địa chỉ email của bạn"
              autoComplete="username"
              value={account}
              onChange={(event) => setAccount(event.target.value)}
              required
            />
          </span>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Mật khẩu</span>
          <span className={styles.inputWrap}>
            <input
              className={styles.input}
              type={showPassword ? "text" : "password"}
              name="password"
              placeholder="Nhập mật khẩu"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <button
              className={styles.eye}
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
            >
              {showPassword ? "Ẩn" : "Hiện"}
            </button>
          </span>
        </label>

        <div className={styles.options}>
          <label className={styles.check}>
            <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
            <span>Duy trì đăng nhập</span>
          </label>
          <Link className={styles.textLink} href="/contact">Quên mật khẩu?</Link>
        </div>

        <button className={styles.submit} type="submit" disabled={submitting}>
          {submitting ? "Đang đăng nhập..." : "Đăng nhập"}
        </button>
        {loginError && <p className={styles.loginError} role="alert">{loginError}</p>}
      </form>

      <GoogleSignIn remember={remember} redirectTo={reviewDestination} />
      <p className={styles.switch}>
        Chưa có tài khoản? <Link href="/dang-ky">Đăng ký ngay</Link>
      </p>
    </AuthShell>
  );
}
