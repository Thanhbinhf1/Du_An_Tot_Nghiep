"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthShell from "@/components/account/AuthShell";
import { API_BASE_URL, readApiResponse } from "@/lib/api";
import { signOutDemo } from "@/lib/demo-auth";
import styles from "../auth.module.css";

type ResetRequest = {
  request_id: string;
  expires_in: number;
  resend_after: number;
  message: string;
};

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [request, setRequest] = useState<ResetRequest>();
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((value) => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  async function sendCode(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (busy || secondsLeft > 0) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const result = await readApiResponse<ResetRequest>(response);
      setEmail(email.trim().toLowerCase());
      setRequest(result);
      setCode("");
      setSecondsLeft(result.resend_after);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Chưa thể gửi mã xác minh. Vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !request) return;
    setError("");
    if (password !== confirmation) {
      setError("Mật khẩu xác nhận chưa khớp.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, request_id: request.request_id, code, newPassword: password }),
      });
      await readApiResponse<{ updated: boolean }>(response);
      signOutDemo();
      router.replace("/dang-nhap?passwordChanged=1");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Chưa thể đặt lại mật khẩu. Vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell>
      <h1 className={styles.title}>{request ? "Đặt mật khẩu mới" : "Quên mật khẩu?"}</h1>
      <p className={styles.subtitle}>
        {request
          ? `Nhập mã gồm 6 chữ số được gửi đến ${email}. Mã có hiệu lực trong ${Math.floor(request.expires_in / 60)} phút.`
          : "Nhập email đã đăng ký để nhận mã xác minh và lấy lại quyền truy cập tài khoản."}
      </p>
      {!request ? (
        <form onSubmit={sendCode}>
          <label className={styles.field}>
            <span className={styles.label}>Email tài khoản</span>
            <span className={styles.inputWrap}>
              <input className={styles.input} type="email" name="email" autoComplete="email" required maxLength={254}
                placeholder="Nhập email đã đăng ký" value={email} onChange={(event) => setEmail(event.target.value)} disabled={busy} />
            </span>
          </label>
          <button className={styles.submit} type="submit" disabled={busy}>{busy ? "Đang gửi yêu cầu..." : "Gửi mã xác minh"}</button>
        </form>
      ) : (
        <form onSubmit={resetPassword}>
          <p className={styles.resetNotice} role="status">{request.message}</p>
          <label className={styles.field}>
            <span className={styles.label}>Mã xác minh</span>
            <span className={styles.inputWrap}>
              <input className={`${styles.input} ${styles.otpInput}`} type="text" name="code" inputMode="numeric"
                autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required
                placeholder="000000" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} />
            </span>
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Mật khẩu mới</span>
            <span className={styles.inputWrap}>
              <input className={styles.input} type={showPassword ? "text" : "password"} name="newPassword" aria-label="Mật khẩu mới" autoComplete="new-password"
                minLength={8} required placeholder="Ít nhất 8 ký tự" value={password} onChange={(event) => setPassword(event.target.value)} />
              <button className={styles.eye} type="button" onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}>{showPassword ? "Ẩn" : "Hiện"}</button>
            </span>
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Nhập lại mật khẩu mới</span>
            <span className={styles.inputWrap}>
              <input className={styles.input} type={showPassword ? "text" : "password"} name="confirmPassword" autoComplete="new-password"
                minLength={8} required placeholder="Nhập lại mật khẩu mới" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
            </span>
          </label>
          <button className={styles.submit} type="submit" disabled={busy}>{busy ? "Đang xử lý..." : "Đặt lại mật khẩu"}</button>
          <div className={styles.resetActions}>
            <button className={styles.textLink} type="button" disabled={busy || secondsLeft > 0} onClick={() => void sendCode()}>
              {secondsLeft > 0 ? `Gửi lại mã sau ${secondsLeft}s` : "Gửi lại mã"}
            </button>
            <button className={styles.textLink} type="button" disabled={busy} onClick={() => {
              setRequest(undefined); setCode(""); setPassword(""); setConfirmation(""); setSecondsLeft(0); setError("");
            }}>Dùng email khác</button>
          </div>
        </form>
      )}
      {error && <p className={styles.loginError} role="alert">{error}</p>}
      <p className={styles.resetHelp}>Bạn vẫn có thể dùng Google để đăng nhập tài khoản đã liên kết sau khi đặt lại mật khẩu.</p>
      <p className={styles.resetHelp}>Cần hỗ trợ hoặc mất quyền truy cập email? <Link className={styles.textLink} href="/contact?topic=tai-khoan">Liên hệ cửa hàng</Link></p>
      <p className={styles.switch}><Link href="/dang-nhap">Quay lại đăng nhập</Link></p>
    </AuthShell>
  );
}
