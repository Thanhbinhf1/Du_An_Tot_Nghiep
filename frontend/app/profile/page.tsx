"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOutDemo, useDemoAuth } from "@/lib/demo-auth";
import { AccountSidebar } from "@/components/account/ProfileSettings";
import { getAccountProfile, type AccountProfile } from "@/lib/account-api";
import { formatShippingAddress, getShippingAddresses } from "@/lib/address-api";

export default function ProfilePage() {
  const { token, isHydrated } = useDemoAuth();

  if (!isHydrated) return <p role="status">Đang kiểm tra đăng nhập...</p>;
  if (!token) {
    return (
      <section className="profile-page profile-logged-out">
        <h1>Đăng nhập để xem hồ sơ</h1>
        <p>Tài khoản của bạn chưa đăng nhập trên thiết bị này.</p>
        <Link className="profile-login-link" href="/dang-nhap">Đăng nhập</Link>
      </section>
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
    <div className="container account-page-layout">
      <AccountSidebar active="overview" />
      <section className="account-page-content">
        <div className="profile-heading">
          <div><span className="profile-eyebrow">TÀI KHOẢN CỦA BẠN</span><h1>Hồ sơ cá nhân</h1><p>Quản lý thông tin tài khoản và trải nghiệm mua sắm.</p></div>
          <button className="profile-logout" type="button" onClick={handleLogout}>Đăng xuất</button>
        </div>
        {error && <p role="alert">{error}</p>}
        {!profile && !error && <p role="status">Đang tải hồ sơ...</p>}
        {profile && <div className="profile-card">
          <div className="profile-avatar" aria-hidden="true">{(profile.name || profile.email).charAt(0).toUpperCase()}</div>
          <div className="profile-details">
            <h2>Thông tin tài khoản</h2>
            <dl><div><dt>Họ và tên</dt><dd>{profile.name}</dd></div><div><dt>Email</dt><dd>{profile.email}</dd></div><div><dt>Địa chỉ mặc định</dt><dd>{address || "Chưa cập nhật"}</dd></div><div><dt>Trạng thái</dt><dd><span className="profile-status">Đang đăng nhập</span></dd></div></dl>
          </div>
        </div>}
        <div className="profile-shortcuts">
          <Link href="/profile/edit"><span>✎</span><strong>Chỉnh sửa hồ sơ</strong><small>Cập nhật tên hiển thị</small></Link>
          <Link href="/profile/address"><span>⌖</span><strong>Sổ địa chỉ</strong><small>Quản lý địa chỉ giao hàng</small></Link>
          <Link href="/orders"><span>▤</span><strong>Đơn hàng của tôi</strong><small>Xem và theo dõi đơn hàng</small></Link>
          <Link href="/wishlist"><span>♡</span><strong>Sản phẩm yêu thích</strong><small>Xem danh sách bạn đã lưu</small></Link>
        </div>
      </section>
    </div>
  );
}
