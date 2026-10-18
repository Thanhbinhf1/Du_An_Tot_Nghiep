
"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { DEMO_CREDENTIALS, signInDemo } from "@/lib/demo-auth";
import styles from "../auth.module.css";

export default function DangNhapPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      account.trim().toLowerCase() !== DEMO_CREDENTIALS.account ||
      password !== DEMO_CREDENTIALS.password
    ) {
      setLoginError("Thông tin đăng nhập chưa chính xác. Hãy dùng tài khoản demo bên dưới.");
      return;
    }
    setLoginError("");
    signInDemo(DEMO_CREDENTIALS.account, remember);
    router.push("/profile");
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
              Đăng nhập bằng tài khoản demo để tiếp tục
            </p>

            <form onSubmit={handleLogin}>
              <label className={styles.field}>
                <span className={styles.label}>Tài khoản</span>
                <span className={styles.inputWrap}>
                  <input
                    className={styles.input}
                    type="text"
                    name="account"
                    placeholder="Nhập email hoặc số điện thoại"
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

              <button className={styles.submit} type="submit">
                Đăng nhập
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
              Chưa có tài khoản thật? Đăng ký sẽ hoạt động khi kết nối backend.{" "}
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
