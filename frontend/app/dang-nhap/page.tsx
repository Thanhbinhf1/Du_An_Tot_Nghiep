
"use client";

import { useState } from "react";
import Link from "next/link";
import styles from "../auth.module.css";

export default function DangNhapPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <section className={styles.formPanel}>
          <img
            className={styles.logo}
            src="/logo-vcs.png"
            alt="VCS BAPD"
          />

          <div className={styles.form}>
            <h1 className={styles.title}>Chào mừng bạn đến với BAPD</h1>
            <p className={styles.subtitle}>
              Vui lòng nhập thông tin của bạn
            </p>

            <form onSubmit={(event) => event.preventDefault()}>
              <label className={styles.field}>
                <span className={styles.label}>Tài khoản</span>
                <span className={styles.inputWrap}>
                  <input
                    className={styles.input}
                    type="text"
                    name="account"
                    placeholder="Nhập email hoặc số điện thoại"
                    autoComplete="username"
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

              <button className={styles.submit} type="submit">
                Đăng nhập
              </button>
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
              Bạn chưa có tài khoản?{" "}
              <Link href="/dang-ky">Đăng ký ngay</Link>
            </p>
          </div>
        </section>

        <aside className={styles.imagePanel}>
          <img
            className={styles.coverImage}
            src="/images/auth/auth-fashion.png"
            alt="Giá treo quần áo với tông màu be trong không gian thời trang"
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
