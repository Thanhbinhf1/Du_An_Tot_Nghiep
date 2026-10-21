"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useDemoAuth } from "@/lib/demo-auth";
import { productCategories } from "@/data/categories";
import { API_BASE_URL, readApiResponse, type ApiCategory } from "@/lib/api";

const categoryOrder = ["nam", "nu", "tre-em", "em-be"];
const orderCategories = (items: Array<Pick<ApiCategory, "name" | "slug">>) =>
  [...items].sort((first, second) =>
    categoryOrder.indexOf(first.slug) - categoryOrder.indexOf(second.slug),
  );

const categoryMenus: Record<string, Array<{ title: string; items: string[] }>> = {
  nam: [
    { title: "Áo", items: ["Áo thun", "Áo sơ mi", "Áo polo", "Áo len", "Áo khoác"] },
    { title: "Quần", items: ["Quần jeans", "Quần dài", "Quần short", "Đồ mặc nhà"] },
  ],
  nu: [
    { title: "Áo", items: ["Áo thun", "Áo sơ mi", "Áo len", "Áo khoác"] },
    { title: "Thời trang nữ", items: ["Váy", "Quần dài", "Quần short", "Đồ mặc nhà", "Đồ lót"] },
  ],
  "tre-em": [
    { title: "Quần áo", items: ["Áo thun", "Áo sơ mi", "Áo khoác", "Áo len"] },
    { title: "Trang phục", items: ["Quần dài", "Quần short", "Đồ mặc nhà", "Đồ mặc ngoài"] },
  ],
  "em-be": [
    { title: "Quần áo em bé", items: ["Áo em bé", "Quần em bé", "Bộ đồ em bé", "Đồ liền thân"] },
    { title: "Đồ dùng", items: ["Đồ mặc nhà", "Đồ giữ ấm", "Phụ kiện em bé"] },
  ],
};

export default function Header() {
  const { isLoggedIn, role } = useDemoAuth();
  const [openMenu, setOpenMenu] = useState("");
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
          if (active && items.length) setCategories(orderCategories(items));
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
          {categories.map((category) => {
            const menu = categoryMenus[category.slug];
            const menuId = `category-menu-${category.slug}`;
            return (
              <div
                className="nav-category"
                key={category.slug}
                onMouseEnter={() => {
                  if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
                    setOpenMenu(category.slug);
                  }
                }}
                onMouseLeave={() => {
                  if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
                    setOpenMenu("");
                  }
                }}
                onFocus={(event) => {
                  if (event.target instanceof HTMLElement && event.target.matches(":focus-visible")) {
                    setOpenMenu(category.slug);
                  }
                }}
                onBlur={(event) => {
                  if (!(event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget))) {
                    setOpenMenu("");
                  }
                }}
              >
                <button
                  className="nav-category-trigger"
                  type="button"
                  aria-expanded={openMenu === category.slug}
                  aria-haspopup="true"
                  aria-controls={menuId}
                  onClick={() => {
                    if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
                    setOpenMenu((current) => current === category.slug ? "" : category.slug);
                  }}
                >
                  {category.name}
                  <span className="nav-category-chevron" aria-hidden="true">⌄</span>
                </button>
                {menu && (
                  <div
                    className={`nav-mega-menu${openMenu === category.slug ? " open" : ""}`}
                    id={menuId}
                  >
                    <div className="nav-mega-intro">
                      <span>KHÁM PHÁ</span>
                      <strong>{category.name}</strong>
                      <Link href={`/categories/${category.slug}`} onClick={() => setOpenMenu("")}>
                        Xem tất cả sản phẩm <span aria-hidden="true">→</span>
                      </Link>
                    </div>
                    <div className="nav-mega-groups">
                      {menu.map((group) => (
                        <div className="nav-mega-group" key={group.title}>
                          <h2>{group.title}</h2>
                          {group.items.map((item) => {
                            const query = new URLSearchParams({ category: category.name, q: item });
                            return (
                              <Link
                                href={`/products?${query.toString()}`}
                                key={item}
                                onClick={() => setOpenMenu("")}
                              >
                                {item}
                              </Link>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
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
