"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { signOutDemo, useDemoAuth } from "@/lib/demo-auth";
import { changeAccountPassword, getAccountProfile, updateAccountName } from "@/lib/account-api";
import { useRouter } from "next/navigation";

export function ProfileEditForm() {
  const { token, account, isHydrated } = useDemoAuth();
  if (!isHydrated) return <p role="status">Đang kiểm tra đăng nhập...</p>;
  if (!token) return <p>Vui lòng <Link href="/dang-nhap">đăng nhập</Link> để chỉnh sửa hồ sơ.</p>;
  return <ProfileEditFields key={token} token={token} email={account} />;
}

function ProfileEditFields({ token, email }: { token: string; email: string }) {
  const [name, setName] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getAccountProfile(token)
      .then((profile) => { if (active) setName(profile.name); })
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
      const profile = await updateAccountName(token, name);
      setName(profile.name);
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể lưu hồ sơ.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="settings-card" onSubmit={handleSubmit}>
      <h1>Chỉnh sửa hồ sơ</h1>
      <label className="form-field">Họ và tên<input required maxLength={120} value={name ?? ""} disabled={name === undefined || saving} onChange={(event) => { setName(event.target.value); setSaved(false); }} /></label>
      <label className="form-field">Email<input value={email} readOnly /></label>
      <button className="pill-button dark" type="submit" disabled={name === undefined || saving}>Lưu thay đổi</button>
      {error && <p className="form-error" role="alert">{error}</p>}
      {saved && <p className="settings-success" role="status">Đã lưu hồ sơ.</p>}
    </form>
  );
}

export function PasswordSettings() {
  const { token, isHydrated } = useDemoAuth();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!isHydrated) return <p role="status">Đang kiểm tra đăng nhập...</p>;
  if (!token) return <p>Vui lòng <Link href="/dang-nhap">đăng nhập</Link> để đổi mật khẩu.</p>;

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
    <form className="settings-card" onSubmit={handleSubmit}>
      <h1>Thay đổi mật khẩu</h1>
      <p className="muted">Sau khi đổi mật khẩu, bạn cần đăng nhập lại trên các thiết bị.</p>
      <label className="form-field">Mật khẩu hiện tại<input name="currentPassword" type="password" autoComplete="current-password" required /></label>
      <label className="form-field">Mật khẩu mới<input name="newPassword" type="password" autoComplete="new-password" minLength={8} maxLength={72} required /></label>
      <label className="form-field">Nhập lại mật khẩu mới<input name="confirmation" type="password" autoComplete="new-password" minLength={8} maxLength={72} required /></label>
      <button className="pill-button dark" type="submit" disabled={saving}>{saving ? "Đang cập nhật..." : "Cập nhật mật khẩu"}</button>
      {error && <p className="form-error" role="alert">{error}</p>}
    </form>
  );
}

export function AccountSidebar({ active }: { active: string }) {
  const links = [
    ["/profile", "Tổng quan", "overview"],
    ["/profile/edit", "Chỉnh sửa hồ sơ", "edit"],
    ["/profile/address", "Sổ địa chỉ", "address"],
    ["/profile/password", "Đổi mật khẩu", "password"],
    ["/orders", "Đơn hàng", "orders"],
    ["/wishlist", "Yêu thích", "wishlist"],
  ];
  return <aside className="account-menu"><h3>Tài khoản</h3>{links.map(([href, label, id]) => <Link className={active === id ? "active" : ""} href={href} key={id}>{label}</Link>)}</aside>;
}
