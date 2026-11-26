"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOutDemo, useDemoAuth } from "@/lib/demo-auth";
import AccountLayout from "@/components/account/AccountLayout";
import styles from "@/components/account/account.module.css";
import { getAccountProfile, type AccountProfile } from "@/lib/account-api";
import { formatShippingAddress, getShippingAddresses } from "@/lib/address-api";

export default function ProfilePage() {
  const { token, isHydrated } = useDemoAuth();

  if (!isHydrated) return <p role="status">Đang kiểm tra đăng nhập...</p>;
  if (!token) {
    return (
      <AccountLayout active="overview" title="Hồ sơ cá nhân">
        <p>Đăng nhập để xem thông tin liên hệ và địa chỉ giao hàng của bạn.</p>
        <Link className={styles.primary} href="/dang-nhap">Đăng nhập</Link>
      </AccountLayout>
    );
  }
  return <ProfileContent key={token} token={token} />;
}

function ProfileContent({ token }: { token: string }) {
  const router = useRouter();
  const [profile, setProfile] = useState<AccountProfile>();
  const [address, setAddress] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([getAccountProfile(token), getShippingAddresses(token)])
      .then(([profile, addresses]) => {
        if (!active) return;
        const primary = addresses.find((item) => item.is_default);
        setAddress(primary ? formatShippingAddress(primary) : "");
        setProfile(profile);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Không thể tải hồ sơ.");
      });
    return () => { active = false; };
  }, [token]);

  function handleLogout() {
    signOutDemo();
    router.push("/");
  }

  return (
    <AccountLayout active="overview" title="Hồ sơ cá nhân" description="Quản lý thông tin liên hệ, địa chỉ và đơn hàng của bạn."
      action={<button className={styles.secondary} type="button" onClick={handleLogout}>Đăng xuất</button>}>
      {error && <p className={styles.message} role="alert">{error}</p>}
      {!profile && !error && <p className={styles.panel} role="status">Đang tải hồ sơ…</p>}
      {profile && (
        <div className={styles.overview}>
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2>Thông tin tài khoản</h2>
              <Link className={styles.jumpLink} href="/profile/edit">Chỉnh sửa</Link>
            </div>
            <div className={styles.identity}>
              <span className={styles.avatar} aria-hidden="true">{(profile.name || profile.email).charAt(0).toLocaleUpperCase("vi")}</span>
              <div>
                <strong>{profile.name}</strong>
                <p>{profile.email}</p>
                {profile.phone && <p>{profile.phone}</p>}
              </div>
            </div>
          </section>
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2>Địa chỉ mặc định</h2>
              <Link className={styles.jumpLink} href="/profile/address">Quản lý</Link>
            </div>
            <p className={styles.overviewAddress}>{address || "Bạn chưa có địa chỉ giao hàng mặc định."}</p>
          </section>
        </div>
      )}
      <nav className={styles.quickLinks} aria-label="Thao tác nhanh">
        <Link className={styles.secondary} href="/orders">Đơn hàng của tôi</Link>
        <Link className={styles.secondary} href="/wishlist">Sản phẩm yêu thích</Link>
      </nav>
    </AccountLayout>
  );
}
