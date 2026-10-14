
"use client";

import { useState } from "react";
import Link from "next/link";
import styles from "../auth.module.css";

export default function DangKyPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <section className={styles.formPanel}>
          <Link className={styles.back} href="/dang-nhap">
            ← Quay lại đăng nhập
          </Link>

          <img
            className={styles.logo}
            src="/logo-vcs.png"
            alt="VCS BAPD"
          />

          <div className={styles.form}>
            <h1 className={styles.title}>Tạo tài khoản</h1>
            <p className={styles.subtitle}>
              Bắt đầu hành trình thời trang của bạn cùng BAPD.
            </p>

            <form onSubmit={(event) => event.preventDefault()}>
              <label className={styles.field}>
                <span className={styles.label}>Họ và tên</span>
                <span className={styles.inputWrap}>
                  <input
                    className={styles.input}
                    type="text"
                    name="fullName"
                    placeholder="Nhập họ và tên"
                    autoComplete="name"
                    required
                  />
                </span>
              </label>

              <label className={styles.field}>
                <span className={styles.label}>
                  Email hoặc số điện thoại
                </span>
                <span className={styles.inputWrap}>
                  <input
                    className={styles.input}
                    type="text"
                    name="emailOrPhone"
                    placeholder="Nhập email hoặc số điện thoại"
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
                    placeholder="Tạo mật khẩu"
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
                    placeholder="Nhập lại mật khẩu"
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                  <button
                    className={styles.eye}
                    type="button"
                    onClick={() =>
                      setShowConfirmPassword(!showConfirmPassword)
                    }
                    aria-label={
                      showConfirmPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"
                    }
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
                    onChange={(event) =>
                      setAcceptedTerms(event.target.checked)
                    }
                    required
                  />
                  <span>
                    Tôi đồng ý với{" "}
                    <a className={styles.textLink} href="#dieu-khoan">
                      Điều khoản sử dụng
                    </a>{" "}
                    và{" "}
                    <a className={styles.textLink} href="#bao-mat">
                      Chính sách bảo mật
                    </a>{" "}
                    của BAPD.
                  </span>
                </label>
              </div>

              <button className={styles.submit} type="submit">
                Đăng ký
              </button>
            </form>

            <div className={styles.divider}>Hoặc đăng ký bằng</div>

            <button
              className={styles.google}
              type="button"
              onClick={() => alert("Đây là giao diện minh họa frontend.")}
            >
              <span className={styles.googleMark}>G</span>
              Google
            </button>

            <p className={styles.switch}>
              Đã có tài khoản?{" "}
              <Link href="/dang-nhap">Đăng nhập</Link>
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
            <strong>Chào mừng đến với BAPD</strong>
            <span>
              Khám phá phong cách phù hợp với bạn và những điều giản dị mỗi ngày.
            </span>
          </div>
        </aside>
      </div>
    </main>
  );
}
