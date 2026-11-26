"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import AccountLayout from "./AccountLayout";
import AddressLocations from "./AddressLocations";
import styles from "./account.module.css";
import { useDemoAuth } from "@/lib/demo-auth";
import {
  deleteShippingAddress, emptyShippingAddress, formatShippingAddress, getShippingAddresses, saveShippingAddress, setDefaultShippingAddress,
  type ShippingAddress, type ShippingAddressInput,
} from "@/lib/address-api";

const fields = [
  ["receiver_name", "Người nhận"],
  ["receiver_phone", "Số điện thoại"],
  ["address_detail", "Số nhà, tên đường"],
] as const;

export default function AddressBook() {
  const { token, isHydrated } = useDemoAuth();
  if (!isHydrated || !token) {
    return (
      <AccountLayout active="address" title="Sổ địa chỉ">
        {!isHydrated ? <p className={styles.panel} role="status">Đang kiểm tra đăng nhập…</p>
          : <p className={styles.panel}>Vui lòng <Link className={styles.jumpLink} href="/dang-nhap">đăng nhập</Link> để quản lý địa chỉ.</p>}
      </AccountLayout>
    );
  }
  return <AddressBookContent key={token} token={token} />;
}

function AddressBookContent({ token }: { token: string }) {
  const [addresses, setAddresses] = useState<ShippingAddress[]>();
  const [editor, setEditor] = useState<{ id: string; values: ShippingAddressInput } | null>(null);
  const editorHeading = useRef<HTMLHeadingElement>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const editingId = editor?.id;

  useEffect(() => {
    let active = true;
    getShippingAddresses(token)
      .then((data) => { if (active) setAddresses(data); })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Không thể tải địa chỉ.");
      });
    return () => { active = false; };
  }, [token]);

  useEffect(() => {
    if (editingId === undefined) return;
    editorHeading.current?.focus();
  }, [editingId]);

  useEffect(() => {
    if (editingId !== undefined || busy || !restoreFocus.current) return;
    restoreFocus.current = false;
    addButton.current?.focus();
  }, [editingId, busy]);

  async function mutate(action: () => Promise<unknown>, message: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    setStatus("");
    try {
      await action();
      setAddresses(await getShippingAddresses(token));
      setStatus(message);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể cập nhật sổ địa chỉ.");
    } finally {
      setBusy(false);
    }
  }

  function openEditor(address?: ShippingAddress) {
    setError("");
    setStatus("");
    if (!address) {
      setEditor({ id: "", values: emptyShippingAddress });
      return;
    }
    const { receiver_name, receiver_phone, address_detail, province_code, ward_code } = address;
    setEditor({
      id: address._id,
      values: { receiver_name, receiver_phone, address_detail, province_code: province_code?.toString() ?? "", ward_code: ward_code?.toString() ?? "" },
    });
  }

  function updateFields(values: Partial<ShippingAddressInput>) {
    setEditor((current) => current && { ...current, values: { ...current.values, ...values } });
  }

  function closeEditor() {
    restoreFocus.current = true;
    setEditor(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor) return;
    void mutate(async () => {
      await saveShippingAddress(token, editor.values, editor.id || undefined);
      closeEditor();
    }, editor.id ? "Đã cập nhật địa chỉ." : "Đã thêm địa chỉ.");
  }

  const form = editor?.values;

  return (
    <AccountLayout active="address" title="Sổ địa chỉ" description="Lưu địa chỉ nhận hàng và chọn địa chỉ mặc định khi đặt hàng."
      action={!editor && <button ref={addButton} type="button" className={styles.primary} disabled={busy || !addresses} onClick={() => openEditor()}>Thêm địa chỉ</button>}>
      {error && <p className={styles.message} role="alert">{error}</p>}
      {status && <p className={styles.success} role="status">{status}</p>}
      {form && (
        <form className={`${styles.panel} ${styles.addressEditor}`} onSubmit={handleSubmit} aria-labelledby="address-editor-title">
          <h2 id="address-editor-title" ref={editorHeading} tabIndex={-1}>{editingId ? "Chỉnh sửa địa chỉ" : "Địa chỉ mới"}</h2>
          <div className={styles.formGrid}>
            {fields.map(([field, label]) => (
              <label key={field} className={field === "address_detail" ? styles.wideField : undefined}>
                {label}
                <input required maxLength={field === "receiver_name" ? 120 : field === "address_detail" ? 250 : 24}
                  type={field === "receiver_phone" ? "tel" : "text"}
                  autoComplete={field === "receiver_phone" ? "tel" : field === "receiver_name" ? "name" : "street-address"}
                  disabled={busy} value={form[field]} onChange={(event) => updateFields({ [field]: event.target.value })} />
              </label>
            ))}
            {editingId && !form.province_code && <p className="small muted">Chọn lại tỉnh/thành và phường/xã theo địa chỉ hiện hành.</p>}
            <AddressLocations province={form.province_code} ward={form.ward_code} disabled={busy}
              onChange={(province_code, ward_code) => updateFields({ province_code, ward_code })} />
          </div>
          <div className={styles.formActions}>
            <button type="button" className={styles.secondary} disabled={busy} onClick={closeEditor}>Hủy</button>
            <button className={styles.primary} type="submit" disabled={busy || !form.province_code || !form.ward_code}>
              {busy ? "Đang lưu…" : "Lưu địa chỉ"}
            </button>
          </div>
        </form>
      )}
      {!addresses && !error && <p className={styles.panel} role="status">Đang tải địa chỉ…</p>}
      {!form && addresses?.length === 0 && (
        <div className={`${styles.panel} ${styles.empty}`}>
          <h2>Chưa có địa chỉ nhận hàng</h2>
          <p>Thêm địa chỉ để dùng khi đặt hàng.</p>
        </div>
      )}
      {!form && !!addresses?.length && (
        <div className={styles.addressList}>
          {addresses.map((address) => (
            <article className={`${styles.panel} ${styles.addressCard}`} data-default={address.is_default} key={address._id}>
              <div className={styles.addressCardHeader}>
                <div className={styles.recipient}>
                  <strong>{address.receiver_name}</strong>
                  <p>{address.receiver_phone}</p>
                </div>
                {address.is_default && <span className={styles.badge}>Mặc định</span>}
              </div>
              <address>{formatShippingAddress(address)}</address>
              <div className={styles.addressActions}>
                <button type="button" className={styles.secondary} disabled={busy || editingId === address._id}
                  onClick={() => openEditor(address)}>Sửa</button>
                {!address.is_default && (
                  <button type="button" className={styles.secondary} disabled={busy}
                    onClick={() => void mutate(() => setDefaultShippingAddress(token, address._id), "Đã đổi địa chỉ mặc định.")}>Đặt mặc định</button>
                )}
                <button type="button" className={styles.danger} disabled={busy} onClick={() => {
                  if (window.confirm(`Xóa địa chỉ của ${address.receiver_name} tại ${formatShippingAddress(address)}?`)) {
                    void mutate(() => deleteShippingAddress(token, address._id), "Đã xóa địa chỉ.");
                  }
                }}>Xóa</button>
              </div>
            </article>
          ))}
        </div>
      )}
    </AccountLayout>
  );
}
