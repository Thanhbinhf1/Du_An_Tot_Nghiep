"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { signOutDemo, useDemoAuth } from "@/lib/demo-auth";
import { changeAccountPassword, getAccountProfile, updateAccountName } from "@/lib/account-api";
import { useRouter } from "next/navigation";
import AccountLayout from "./AccountLayout";
import styles from "./account.module.css";

export function ProfileEditForm() {
  const { token, isHydrated } = useDemoAuth();
  return (
    <AccountLayout active="edit" title="Chỉnh sửa hồ sơ" description="Cập nhật thông tin liên hệ của bạn.">
      {!isHydrated ? <p className={styles.panel} role="status">Đang kiểm tra đăng nhập…</p> : token ? (
        <ProfileEditFields key={token} token={token} />
      ) : <p className={styles.panel}>Vui lòng <Link className={styles.jumpLink} href="/dang-nhap">đăng nhập</Link> để chỉnh sửa hồ sơ.</p>}
    </AccountLayout>
  );
}

function ProfileEditFields({ token }: { token: string }) {
  const [name, setName] = useState<string>();
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getAccountProfile(token)
      .then((profile) => {
        if (!active) return;
        setName(profile.name);
        setEmail(profile.email);
        setPhone(profile.phone ?? "");
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Không thể tải hồ sơ.");
      });
    return () => { active = false; };
  }, [token]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name?.trim() || saving) return;
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const profile = await updateAccountName(token, name, phone);
      setName(profile.name);
      setPhone(profile.phone ?? "");
      window.dispatchEvent(new Event("bapd-profile-updated"));
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể lưu hồ sơ.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {error && <p className={styles.message} role="alert">{error}</p>}
      {saved && <p className={styles.success} role="status">Đã lưu hồ sơ.</p>}
      {!error && name === undefined && <p className={styles.panel} role="status">Đang tải hồ sơ…</p>}
      {name !== undefined && (
        <form className={styles.panel} onSubmit={handleSubmit}>
          <div className={styles.formGrid}>
            <label>
              Họ và tên
              <input required maxLength={120} autoComplete="name" value={name} disabled={saving}
                onChange={(event) => { setName(event.target.value); setSaved(false); }} />
            </label>
            <label>
              Email
              <input type="email" value={email} readOnly />
            </label>
            <label>
              Số điện thoại
              <input type="tel" value={phone} maxLength={24} autoComplete="tel" disabled={saving}
                onChange={(event) => { setPhone(event.target.value); setSaved(false); }} />
            </label>
          </div>
          <div className={styles.formActions}>
            <button className={styles.primary} type="submit" disabled={!name.trim() || saving}>
              {saving ? "Đang lưu…" : "Lưu thay đổi"}
            </button>
          </div>
        </form>
      )}
    </>
  );
}

export function PasswordSettings() {
  const { token, isHydrated } = useDemoAuth();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const form = new FormData(event.currentTarget);
    const password = String(form.get("newPassword") ?? "");
    const confirmation = form.get("confirmation");
    if (password !== confirmation) {
      setError("Mật khẩu mới nhập lại chưa khớp.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      await changeAccountPassword(token, String(form.get("currentPassword") ?? ""), password);
      signOutDemo();
      router.replace("/dang-nhap?passwordChanged=1");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể đổi mật khẩu.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AccountLayout active="password" title="Đổi mật khẩu" description="Sau khi đổi mật khẩu, bạn cần đăng nhập lại trên các thiết bị.">
      {!isHydrated ? <p className={styles.panel} role="status">Đang kiểm tra đăng nhập…</p> : token ? (
        <>
          {error && <p className={styles.message} role="alert">{error}</p>}
          <form className={styles.panel} onSubmit={handleSubmit}>
            <div className={styles.formGrid}>
              <label className={styles.wideField}>
                Mật khẩu hiện tại
                <input name="currentPassword" type="password" autoComplete="current-password" required />
              </label>
              <label>
                Mật khẩu mới
                <input name="newPassword" type="password" autoComplete="new-password" minLength={8} maxLength={72} required />
              </label>
              <label>
                Nhập lại mật khẩu mới
                <input name="confirmation" type="password" autoComplete="new-password" minLength={8} maxLength={72} required />
              </label>
            </div>
            <div className={styles.formActions}>
              <button className={styles.primary} type="submit" disabled={saving}>
                {saving ? "Đang cập nhật…" : "Cập nhật mật khẩu"}
              </button>
            </div>
          </form>
        </>
      ) : <p className={styles.panel}>Vui lòng <Link className={styles.jumpLink} href="/dang-nhap">đăng nhập</Link> để đổi mật khẩu.</p>}
    </AccountLayout>
  );
}
