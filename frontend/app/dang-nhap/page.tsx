
"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { signIn } from "@/lib/demo-auth";
import { saveDemoProfileNameIfMissing } from "@/lib/storefront-demo";
import { API_BASE_URL, readApiResponse } from "@/lib/api";
import styles from "../auth.module.css";

export default function DangNhapPage() {
  const router = useRouter();
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
        name?: string;
        role: "customer" | "staff" | "admin";
        token: string;
      }>(response);
      signIn(user.email, user.role, user.token, remember);
      if (user.name) saveDemoProfileNameIfMissing(user.name);
      router.push(user.role === "admin" ? "/admin" : "/profile");
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "Không thể đăng nhập.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <section className={styles.formPanel}>
          <Image
            className={styles.logo}
            src="/logo-vcs.png"
            alt="VCS BAPD"
            width={76}
            height={76}
          />

          <div className={styles.form}>
            <h1 className={styles.title}>Chào mừng bạn đến với BAPD</h1>
            <p className={styles.subtitle}>
              Đăng nhập bằng tài khoản của bạn để tiếp tục
            </p>

            <form onSubmit={handleLogin}>
              <label className={styles.field}>
                <span className={styles.label}>Tài khoản</span>
                <span className={styles.inputWrap}>
                  <input
                    className={styles.input}
                    type="email"
                    name="account"
                    placeholder="Nhập email"
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
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(event) => setRemember(event.target.checked)}
                  />
                  <span>Duy trì đăng nhập</span>
                </label>

                <a className={styles.textLink} href="#quen-mat-khau">
                  Quên mật khẩu
                </a>
              </div>

              <button className={styles.submit} type="submit" disabled={submitting}>
                {submitting ? "Đang đăng nhập..." : "Đăng nhập"}
              </button>
              {loginError && <p className={styles.loginError} role="alert">{loginError}</p>}
            </form>

            <div className={styles.divider}>Hoặc đăng nhập bằng</div>

            <button
              className={styles.google}
              type="button"
              onClick={() => alert("Đây là giao diện minh họa frontend.")}
            >
              <span className={styles.googleMark}>G</span>
              Google
            </button>

            <p className={styles.switch}>
              Chưa có tài khoản?{" "}
              <Link href="/dang-ky">Đăng ký ngay</Link>
            </p>
          </div>
        </section>

        <aside className={styles.imagePanel}>
          <Image
            className={styles.coverImage}
            src="/images/auth/auth-fashion.png"
            alt="Giá treo quần áo với tông màu be trong không gian thời trang"
            fill
            sizes="(max-width: 760px) 0px, 50vw"
          />
          <div className={styles.imageCaption}>
            <strong>Phong cách của riêng bạn</strong>
            <span>
              BAPD — Tối giản trong thiết kế, thoải mái trong từng khoảnh khắc.
            </span>
          </div>
        </aside>
      </div>
    </main>
  );
}
