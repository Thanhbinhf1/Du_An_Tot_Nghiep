"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useDemoAuth } from "@/lib/demo-auth";
import { productCategories } from "@/data/categories";
import { API_BASE_URL, readApiResponse, type ApiCategory } from "@/lib/api";

export default function Header() {
  const { isLoggedIn, role } = useDemoAuth();
  const [categories, setCategories] = useState<Array<Pick<ApiCategory, "name" | "slug">>>(productCategories.map((category) => ({
    name: category.name,
    slug: category.slug,
  })));

  useEffect(() => {
    let active = true;
    const refreshCategories = () => {
      fetch(`${API_BASE_URL}/catalog/categories`)
        .then(readApiResponse<ApiCategory[]>)
        .then((items) => {
          if (active && items.length) setCategories(items);
        })
        .catch(() => {
          if (active) setCategories(productCategories.map((category) => ({
            name: category.name,
            slug: category.slug,
          })));
        });
    };
    refreshCategories();
    window.addEventListener("bapd-catalog-change", refreshCategories);
    return () => {
      active = false;
      window.removeEventListener("bapd-catalog-change", refreshCategories);
    };
  }, []);

  return (
    <header className="header">
      <div className="warning-bar">
        ⚠ CẢNH GIÁC VỚI LỪA ĐẢO GIAO HÀNG. Chỉ thanh toán tiền mặt khi trực tiếp nhận hàng.
      </div>
      <div className="site-main nav">
        <Link href="/" className="logo" aria-label="Trang chủ">
          <Image src="/logo-vcs.png" alt="VCS" width={64} height={54} />
        </Link>
        <nav className="nav-links" aria-label="Danh mục">
          {categories.map((category) => (
            <Link key={category.slug} href={`/categories/${category.slug}`}>
              {category.name}
            </Link>
          ))}
        </nav>
        <div className="nav-actions">
          {isLoggedIn && role === "admin" && <Link href="/admin" aria-label="Quản trị cửa hàng">Admin</Link>}
          <Link href="/wishlist" aria-label="Yêu thích">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 8.7c0 4.1-8.8 10.1-8.8 10.1S3.2 12.8 3.2 8.7A4.7 4.7 0 0 1 12 6.2a4.7 4.7 0 0 1 8.8 2.5Z" /></svg>
          </Link>
          <Link href="/search" aria-label="Tìm kiếm">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></svg>
          </Link>
          <Link href={isLoggedIn ? "/profile" : "/dang-nhap"} aria-label="Tài khoản">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5" /><path d="M4.8 20c.6-3.5 3.4-5.5 7.2-5.5s6.6 2 7.2 5.5" /></svg>
          </Link>
          <Link href="/cart" aria-label="Giỏ hàng">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2.2 11.1a2 2 0 0 0 2 1.6h8.9a2 2 0 0 0 1.9-1.5L22 8H6" /><circle cx="10" cy="20" r="1" /><circle cx="18" cy="20" r="1" /></svg>
          </Link>
        </div>
      </div>
    </header>
  );
}
