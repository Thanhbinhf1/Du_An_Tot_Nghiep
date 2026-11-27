import type { ReactNode } from "react";
import Link from "next/link";
import styles from "./account.module.css";

const accountLinks = [
  { id: "overview", href: "/profile", label: "Tổng quan", icon: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" },
  { id: "edit", href: "/profile/edit", label: "Chỉnh sửa hồ sơ", icon: "m16 4 4 4M4 20l4.5-1 11-11a2.8 2.8 0 0 0-4-4l-11 11L4 20Z" },
  { id: "address", href: "/profile/address", label: "Sổ địa chỉ", icon: "M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Zm-5 0a3 3 0 1 0-6 0 3 3 0 0 0 6 0Z" },
  { id: "password", href: "/profile/password", label: "Đổi mật khẩu", icon: "M6 10V8a6 6 0 1 1 12 0v2M4 10h16v11H4zM12 15v2" },
  { id: "orders", href: "/orders", label: "Đơn hàng", icon: "M5 8h14l1 13H4L5 8Zm4 2V6a3 3 0 0 1 6 0v4" },
  { id: "wishlist", href: "/wishlist", label: "Yêu thích", icon: "M20 5a5 5 0 0 0-8 1 5 5 0 0 0-8-1c-5 4 1 10 8 15 7-5 13-11 8-15Z" },
  { id: "reviews", href: "/profile/reviews", label: "Đánh giá của tôi", icon: "m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z" },
] as const;

type AccountSection = (typeof accountLinks)[number]["id"];

export function AccountSidebar({ active }: { active: AccountSection }) {
  const links = <ul className={styles.sidebarLinks}>
        {accountLinks.map(({ id, href, label, icon }) => (
          <li key={id}>
            <Link href={href} aria-current={active === id ? "page" : undefined}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d={icon} />
              </svg>
              {label}
            </Link>
          </li>
        ))}
      </ul>;
  return (
    <nav className={styles.sidebar} aria-label="Tài khoản">
      <div className={styles.desktopLinks}>
        <p className={styles.sidebarTitle}>Tài khoản</p>
        {links}
      </div>
      <details className={styles.mobileLinks} key={active}>
        <summary>Tài khoản <span>{accountLinks.find((link) => link.id === active)?.label}</span></summary>
        {links}
      </details>
    </nav>
  );
}

export default function AccountLayout({ active, title, description, action, children }: {
  active: AccountSection;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={styles.layout}>
      <nav className={styles.breadcrumb} aria-label="Đường dẫn">
        <Link href="/">Trang chủ</Link>
        <span aria-hidden="true">/</span>
        {active === "overview" ? <span aria-current="page">Tài khoản</span> : (
          <>
            <Link href="/profile">Tài khoản</Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page">{title}</span>
          </>
        )}
      </nav>
      <AccountSidebar active={active} />
      <section className={styles.content} aria-labelledby="account-page-title">
        <header className={styles.heading}>
          <div>
            <h1 id="account-page-title">{title}</h1>
            {description && <p>{description}</p>}
          </div>
          {action}
        </header>
        {children}
      </section>
    </div>
  );
}
