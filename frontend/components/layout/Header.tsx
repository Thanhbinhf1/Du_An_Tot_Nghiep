"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useDemoAuth } from "@/lib/demo-auth";
import { useCartItems } from "@/lib/storefront-demo";
import { productCategories } from "@/data/categories";
import { API_BASE_URL, readApiResponse, type ApiCategory } from "@/lib/api";

const categoryOrder = ["nam", "nu", "tre-em", "em-be"];
const orderCategories = (items: Array<Pick<ApiCategory, "name" | "slug">>) =>
  [...items].sort((first, second) =>
    categoryOrder.indexOf(first.slug) - categoryOrder.indexOf(second.slug),
  );

type CategoryMenuItem = { name: string; image: string };

const categoryMenus: Record<string, CategoryMenuItem[]> = {
  nam: [
    { name: "Áo khoác", image: "/images/categories/1.jpg" },
    { name: "Áo thun", image: "/images/categories/nam4.jpg" },
    { name: "Áo sơ mi", image: "/images/categories/2.jpg" },
    { name: "Áo polo", image: "/images/polo-brown.jpg" },
    { name: "Áo len", image: "/images/categories/nam1.webp" },
    { name: "Áo nỉ", image: "/images/categories/nam3.webp" },
    { name: "Quần jeans", image: "/images/categories/5.webp" },
    { name: "Đồ mặc nhà", image: "/images/categories/7.jpg" },
    { name: "Phụ kiện", image: "/images/categories/9.jpg" },
  ],
  nu: [
    { name: "Áo khoác", image: "/images/categories/nu3.webp" },
    { name: "Áo kiểu", image: "/images/categories/nu1.jpg" },
    { name: "Áo thun", image: "/images/categories/nu2.jpg" },
    { name: "Áo len", image: "/images/categories/nu4.jpg" },
    { name: "Quần", image: "/images/categories/5.webp" },
    { name: "Chân váy & đầm", image: "/images/categories/nu3.webp" },
    { name: "Đồ mặc nhà", image: "/images/categories/7.jpg" },
    { name: "Đồ mặc trong", image: "/images/categories/6.jpg" },
    { name: "Phụ kiện", image: "/images/categories/9.jpg" },
  ],
  "tre-em": [
    { name: "Áo thun", image: "/images/categories/treem4.webp" },
    { name: "Áo khoác", image: "/images/categories/treem3.webp" },
    { name: "Áo nỉ", image: "/images/categories/treem3.webp" },
    { name: "Quần", image: "/images/categories/5.webp" },
    { name: "Bộ đồ", image: "/images/categories/treem2.jpg" },
    { name: "Đồ mặc nhà", image: "/images/categories/treem1.jpg" },
  ],
  "em-be": [
    { name: "Áo em bé", image: "/images/categories/embe2.webp" },
    { name: "Quần em bé", image: "/images/categories/embe3.webp" },
    { name: "Bộ đồ em bé", image: "/images/categories/embe1.jpg" },
    { name: "Đồ liền thân", image: "/images/categories/embe4.webp" },
    { name: "Đồ mặc nhà", image: "/images/categories/embe1.jpg" },
    { name: "Đồ giữ ấm", image: "/images/categories/embe3.webp" },
  ],
};

export default function Header() {
  const { isLoggedIn, role } = useDemoAuth();
  const cartItems = useCartItems();
  const cartItemCount = cartItems.reduce((total, item) => total + item.quantity, 0);
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
                </button>
                {menu && (
                  <div
                    className={`nav-mega-menu${openMenu === category.slug ? " open" : ""}`}
                    id={menuId}
                  >
                    <div className="nav-mega-intro">
                      <strong>KHÁM PHÁ {category.name}</strong>
                      <Link href={`/categories/${category.slug}`} onClick={() => setOpenMenu("")}>
                        Xem tất cả sản phẩm <span aria-hidden="true">→</span>
                      </Link>
                    </div>
                    <div className="nav-mega-items">
                      {menu.map((item) => {
                        const query = new URLSearchParams({ category: category.name, q: item.name });
                        return (
                          <Link
                            className="nav-mega-item"
                            href={`/products?${query.toString()}`}
                            key={item.name}
                            onClick={() => setOpenMenu("")}
                          >
                            <Image src={item.image} alt="" width={180} height={140} />
                            <span>{item.name}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </nav>
        <div className="nav-actions">
          {isLoggedIn && role === "admin" && <Link href="/admin" aria-label="Quản trị cửa hàng">Admin</Link>}
          <form className="header-search" action="/search" role="search">
            <label className="sr-only" htmlFor="header-search-query">Tìm kiếm sản phẩm</label>
            <input
              id="header-search-query"
              type="search"
              name="q"
              placeholder="Bạn đang tìm sản phẩm gì?"
            />
            <button type="submit" aria-label="Tìm kiếm">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="10.8" cy="10.8" r="6.8" />
                <path d="m16 16 4.5 4.5" />
              </svg>
            </button>
          </form>
          <Link href="/wishlist" aria-label="Yêu thích">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 8.7c0 4.1-8.8 10.1-8.8 10.1S3.2 12.8 3.2 8.7A4.7 4.7 0 0 1 12 6.2a4.7 4.7 0 0 1 8.8 2.5Z" /></svg>
          </Link>
          <Link href={isLoggedIn ? "/profile" : "/dang-nhap"} aria-label="Tài khoản">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5" /><path d="M4.8 20c.6-3.5 3.4-5.5 7.2-5.5s6.6 2 7.2 5.5" /></svg>
          </Link>
          <Link href="/cart" aria-label={cartItemCount > 0 ? `Giỏ hàng, ${cartItemCount} sản phẩm` : "Giỏ hàng"}>
            <span className="header-cart-icon">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2.2 11.1a2 2 0 0 0 2 1.6h8.9a2 2 0 0 0 1.9-1.5L22 8H6" /><circle cx="10" cy="20" r="1" /><circle cx="18" cy="20" r="1" /></svg>
              {cartItemCount > 0 && <span className="header-cart-count" aria-hidden="true">{cartItemCount}</span>}
            </span>
          </Link>
        </div>
      </div>
    </header>
  );
}
