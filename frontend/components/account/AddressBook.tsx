"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import AddressLocations from "./AddressLocations";
import { useDemoAuth } from "@/lib/demo-auth";
import {
  deleteShippingAddress, emptyShippingAddress, formatShippingAddress, getShippingAddresses, saveShippingAddress, setDefaultShippingAddress,
  type ShippingAddress,
} from "@/lib/address-api";

const fields = [
  ["receiver_name", "Người nhận"],
  ["receiver_phone", "Số điện thoại"],
  ["address_detail", "Số nhà, tên đường"],
] as const;

export default function AddressBook() {
  const { token, isHydrated } = useDemoAuth();
  if (!isHydrated) return <p role="status">Đang kiểm tra đăng nhập...</p>;
  if (!token) return <p>Vui lòng <Link href="/dang-nhap">đăng nhập</Link> để quản lý địa chỉ.</p>;
  return <AddressBookContent key={token} token={token} />;
}

function AddressBookContent({ token }: { token: string }) {
  const [addresses, setAddresses] = useState<ShippingAddress[]>();
  const [form, setForm] = useState(emptyShippingAddress);
  const [editingId, setEditingId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getShippingAddresses(token)
      .then((data) => { if (active) setAddresses(data); })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Không thể tải địa chỉ.");
      });
    return () => { active = false; };
  }, [token]);

  async function mutate(action: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await action();
      setAddresses(await getShippingAddresses(token));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể cập nhật sổ địa chỉ.");
    } finally {
      setBusy(false);
    }
  }

  function resetForm() {
    setEditingId("");
    setForm(emptyShippingAddress);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void mutate(async () => {
      await saveShippingAddress(token, form, editingId || undefined);
      resetForm();
    });
  }

  return (
    <section className="settings-card">
      <h1>Sổ địa chỉ</h1>
      {error && <p role="alert" className="form-error">{error}</p>}
      {!addresses && !error && <p role="status">Đang tải địa chỉ...</p>}
      {addresses?.map((address) => (
        <article className="panel" key={address._id}>
          <strong>{address.receiver_name}</strong> · {address.receiver_phone}
          {address.is_default && <span> · Mặc định</span>}
          <p>{formatShippingAddress(address)}</p>
          <div>
            <button type="button" className="text-button" disabled={busy} onClick={() => {
              const { receiver_name, receiver_phone, province_code, ward_code, address_detail } = address;
              setEditingId(address._id);
              setForm({ receiver_name, receiver_phone, address_detail, province_code: province_code?.toString() ?? "", ward_code: ward_code?.toString() ?? "" });
            }}>Sửa</button>{" "}
            {!address.is_default && (
              <button type="button" className="text-button" disabled={busy}
                onClick={() => void mutate(() => setDefaultShippingAddress(token, address._id))}>Đặt mặc định</button>
            )}{" "}
            <button type="button" className="text-button" disabled={busy} onClick={() => void mutate(async () => {
              await deleteShippingAddress(token, address._id);
              if (editingId === address._id) resetForm();
            })}>Xóa</button>
          </div>
        </article>
      ))}
      <form onSubmit={handleSubmit}>
        <h2>{editingId ? "Chỉnh sửa địa chỉ" : "Thêm địa chỉ"}</h2>
        {fields.map(([field, label]) => (
          <label className="form-field" key={field}>
            {label}
            <input required maxLength={field === "receiver_name" ? 120 : field === "address_detail" ? 250 : 24} type={field === "receiver_phone" ? "tel" : "text"}
              disabled={busy} value={form[field]} onChange={(event) => setForm({ ...form, [field]: event.target.value })} />
          </label>
        ))}
        {editingId && !form.province_code && <p className="small muted">Chọn lại tỉnh/thành và phường/xã theo địa chỉ hiện hành.</p>}
        <AddressLocations province={form.province_code} ward={form.ward_code} disabled={busy}
          onChange={(province_code, ward_code) => setForm({ ...form, province_code, ward_code })} />
        <button className="pill-button dark" type="submit" disabled={busy || !form.province_code || !form.ward_code}>Lưu địa chỉ</button>{" "}
        {editingId && <button className="pill-button" type="button" disabled={busy} onClick={resetForm}>Hủy</button>}
      </form>
    </section>
  );
}
