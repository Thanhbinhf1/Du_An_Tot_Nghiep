"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOutDemo, useDemoAuth } from "@/lib/demo-auth";
import { AccountSidebar } from "@/components/account/ProfileSettings";
import { useDemoAddress, useDemoProfileName } from "@/lib/storefront-demo";

export default function ProfilePage() {
  const router = useRouter();
  const { isLoggedIn, account } = useDemoAuth();
  const name = useDemoProfileName();
  const address = useDemoAddress();

  function handleLogout() {
    signOutDemo();
    router.push("/");
  }

  if (!isLoggedIn) {
    return (
      <section className="profile-page profile-logged-out">
        <h1>Đăng nhập để xem hồ sơ</h1>
        <p>Tài khoản của bạn chưa đăng nhập trên thiết bị này.</p>
        <Link className="profile-login-link" href="/dang-nhap">Đăng nhập</Link>
      </section>
    );
  }

  return (
    <div className="container account-page-layout profile-overview-page">
      <AccountSidebar active="overview" />
      <section className="account-page-content">
        <div className="profile-heading profile-overview-heading">
          <div><span className="profile-eyebrow">KHÔNG GIAN CỦA BẠN</span><h1>Xin chào, {name || "bạn"}!</h1><p>Quản lý thông tin và xem nhanh hoạt động mua sắm của bạn.</p></div>
          <button className="profile-logout" type="button" onClick={handleLogout}>Đăng xuất</button>
        </div>
        <div className="profile-card profile-overview-card">
          <div className="profile-avatar" aria-hidden="true">{(name || account).charAt(0).toUpperCase() || "A"}</div>
          <div className="profile-details">
            <div className="profile-details-heading"><div><span>THÔNG TIN CÁ NHÂN</span><h2>Thông tin tài khoản</h2></div><Link href="/profile/edit">Chỉnh sửa</Link></div>
            <dl><div><dt>Họ và tên</dt><dd>{name || "Chưa cập nhật"}</dd></div><div><dt>Email hoặc số điện thoại</dt><dd>{account || "Chưa cập nhật"}</dd></div><div><dt>Địa chỉ mặc định</dt><dd>{address.address || "Chưa cập nhật"}</dd></div><div><dt>Trạng thái</dt><dd><span className="profile-status">Đang đăng nhập</span></dd></div></dl>
            <p className="profile-demo-note">Đây là thông tin demo được lưu trên trình duyệt, chưa kết nối xác thực backend.</p>
          </div>
        </div>
        <div className="profile-shortcuts">
          <Link href="/profile/edit"><span aria-hidden="true">✎</span><strong>Chỉnh sửa hồ sơ</strong><small>Cập nhật tên hiển thị</small></Link>
          <Link href="/profile/address"><span aria-hidden="true">⌖</span><strong>Sổ địa chỉ</strong><small>Quản lý địa chỉ giao hàng</small></Link>
          <Link href="/orders"><span aria-hidden="true">▤</span><strong>Đơn hàng của tôi</strong><small>Xem và theo dõi đơn hàng</small></Link>
          <Link href="/wishlist"><span aria-hidden="true">♡</span><strong>Sản phẩm yêu thích</strong><small>Xem danh sách bạn đã lưu</small></Link>
        </div>
      </section>
    </div>
  );
}
