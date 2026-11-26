"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { API_BASE_URL, readApiResponse } from "@/lib/api";
import { signIn } from "@/lib/demo-auth";
import styles from "../auth.module.css";
import GoogleSignIn from "@/components/account/GoogleSignIn";
import AuthShell from "@/components/account/AuthShell";

export default function DangKyPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    const form = new FormData(event.currentTarget);
    if (form.get("password") !== form.get("confirmPassword")) {
      setError("Mật khẩu xác nhận chưa khớp.");
      setSubmitting(false);
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("fullName"),
          email: form.get("emailOrPhone"),
          password: form.get("password"),
        }),
      });
      const user = await readApiResponse<{
        email: string;
        role: "customer" | "staff" | "admin";
        token: string;
      }>(response);
      signIn(user.email, user.role, user.token, true);
      router.push("/profile");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể tạo tài khoản.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell>
      <h1 className={styles.title}>Tạo tài khoản</h1>
      <p className={styles.subtitle}>
        Lưu sản phẩm yêu thích và theo dõi đơn hàng với tài khoản VSC_BAPD.
      </p>

      <form onSubmit={handleRegister}>
        <label className={styles.field}>
          <span className={styles.label}>Họ và tên</span>
          <span className={styles.inputWrap}>
            <input
              className={styles.input}
              type="text"
              name="fullName"
              placeholder="Nhập họ và tên của bạn"
              autoComplete="name"
              required
            />
          </span>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Địa chỉ Email</span>
          <span className={styles.inputWrap}>
            <input
              className={styles.input}
              type="email"
              name="emailOrPhone"
              placeholder="Nhập địa chỉ email"
              autoComplete="email"
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
              placeholder="Tạo mật khẩu (tối thiểu 8 ký tự)"
              autoComplete="new-password"
              minLength={8}
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

        <label className={styles.field}>
          <span className={styles.label}>Xác nhận mật khẩu</span>
          <span className={styles.inputWrap}>
            <input
              className={styles.input}
              type={showConfirmPassword ? "text" : "password"}
              name="confirmPassword"
              placeholder="Nhập lại mật khẩu vừa tạo"
              autoComplete="new-password"
              minLength={8}
              required
            />
            <button
              className={styles.eye}
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              aria-label={showConfirmPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
            >
              {showConfirmPassword ? "Ẩn" : "Hiện"}
            </button>
          </span>
        </label>

        <div className={styles.terms}>
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(event) => setAcceptedTerms(event.target.checked)}
              required
            />
            <span>
              Tôi đồng ý với{" "}
              <Link className={styles.textLink} href="/terms">
                Điều khoản sử dụng
              </Link>{" "}
              và{" "}
              <Link className={styles.textLink} href="/privacy">
                Chính sách bảo mật
              </Link>{" "}
              của VSC_BAPD.
            </span>
          </label>
        </div>

        <button className={styles.submit} type="submit" disabled={submitting}>
          {submitting ? "Đang tạo tài khoản..." : "Đăng ký tài khoản"}
        </button>
        {error && <p className={styles.loginError} role="alert">{error}</p>}
      </form>

      <GoogleSignIn signUp acceptedTerms={acceptedTerms} />

      <p className={styles.switch}>
        Đã có tài khoản? <Link href="/dang-nhap">Đăng nhập ngay</Link>
      </p>
    </AuthShell>
  );
}
