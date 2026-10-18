"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useDemoAuth } from "@/lib/demo-auth";
import { saveDemoAddress, saveDemoProfileName, useDemoAddress, useDemoProfileName } from "@/lib/storefront-demo";

export function ProfileEditForm() {
  const { account } = useDemoAuth();
  const initialName = useDemoProfileName();
  return <ProfileEditFormFields key={`${account}:${initialName}`} account={account} initialName={initialName} />;
}

function ProfileEditFormFields({ account, initialName }: { account: string; initialName: string }) {
  const [name, setName] = useState(initialName);
  const [saved, setSaved] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    saveDemoProfileName(name.trim());
    setSaved(true);
  }

  return (
    <form className="settings-card" onSubmit={handleSubmit}>
      <h1>Chỉnh sửa hồ sơ</h1>
      <p className="muted">Thông tin được lưu trên trình duyệt của bạn.</p>
      <label className="form-field">Họ và tên<input value={name} onChange={(event) => { setName(event.target.value); setSaved(false); }} required /></label>
      <label className="form-field">Email hoặc số điện thoại<input value={account} readOnly /></label>
      <button className="pill-button dark" type="submit">Lưu thay đổi</button>
      {saved && <p className="settings-success" role="status">Đã lưu hồ sơ demo.</p>}
    </form>
  );
}

export function AddressSettings() {
  const savedAddress = useDemoAddress();
  return <AddressSettingsForm key={JSON.stringify(savedAddress)} initialAddress={savedAddress} />;
}

function AddressSettingsForm({ initialAddress }: { initialAddress: { name?: string; phone?: string; address?: string } }) {
  const [name, setName] = useState(initialAddress.name ?? "");
  const [phone, setPhone] = useState(initialAddress.phone ?? "");
  const [address, setAddress] = useState(initialAddress.address ?? "");
  const [saved, setSaved] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    saveDemoAddress({ name: name.trim(), phone: phone.trim(), address: address.trim() });
    setSaved(true);
  }

  return (
    <form className="settings-card" onSubmit={handleSubmit}>
      <h1>Sổ địa chỉ</h1>
      <p className="muted">Lưu địa chỉ để dùng nhanh trong lần thanh toán tiếp theo.</p>
      <label className="form-field">Người nhận<input value={name} onChange={(event) => setName(event.target.value)} required /></label>
      <label className="form-field">Số điện thoại<input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} required /></label>
      <label className="form-field">Địa chỉ<input value={address} onChange={(event) => setAddress(event.target.value)} required /></label>
      <button className="pill-button dark" type="submit">Lưu địa chỉ</button>
      {saved && <p className="settings-success" role="status">Đã lưu địa chỉ demo.</p>}
    </form>
  );
}

export function PasswordSettings() {
  const [saved, setSaved] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirmation) {
      setError("Mật khẩu mới nhập lại chưa khớp.");
      setSaved(false);
      return;
    }
    setError("");
    setSaved(true);
  }

  return (
    <form className="settings-card" onSubmit={handleSubmit}>
      <h1>Thay đổi mật khẩu</h1>
      <p className="muted">Đây là biểu mẫu minh họa; mật khẩu chưa được gửi hay lưu.</p>
      <label className="form-field">Mật khẩu hiện tại<input type="password" minLength={8} required /></label>
      <label className="form-field">Mật khẩu mới<input type="password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
      <label className="form-field">Nhập lại mật khẩu mới<input type="password" minLength={8} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required /></label>
      <button className="pill-button dark" type="submit">Cập nhật mật khẩu</button>
      {error && <p className="form-error" role="alert">{error}</p>}
      {saved && <p className="settings-success" role="status">Đã kiểm tra biểu mẫu demo. Chức năng đổi mật khẩu thật cần backend.</p>}
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
