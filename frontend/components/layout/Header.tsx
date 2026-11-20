"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import CategoryTiles from "@/components/product/CategoryTiles";
import { getAudienceCategories } from "@/lib/catalog-audience";
import { useCatalogCategories } from "@/lib/useCatalogCategories";
import { useDemoAuth } from "@/lib/demo-auth";
import {
  cartChangedEvent,
  cartToastEvent,
  getBackendCart,
  type CartToastDetail,
} from "@/lib/cart-api";
import type { ApiCategory } from "@/lib/api";

const defaultRootCategories: ApiCategory[] = [
  { _id: "default-nu", name: "Nữ", slug: "nu", parent_id: null },
  { _id: "default-nam", name: "Nam", slug: "nam", parent_id: null },
  { _id: "default-tre-em", name: "Trẻ em", slug: "tre-em", parent_id: null },
  { _id: "default-em-be", name: "Em bé", slug: "em-be", parent_id: null },
];

export default function Header() {
  const pathname = usePathname();
  const { isLoggedIn, role, token } = useDemoAuth();
  const { categories = [] } = useCatalogCategories();
  const [cartCount, setCartCount] = useState({ token: "", count: 0 });
  const cartItemCount = cartCount.token === token ? cartCount.count : 0;
  const [openMenu, setOpenMenu] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const mobileToggle = useRef<HTMLButtonElement>(null);
  const header = useRef<HTMLElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 12);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const handleToast = (event: Event) => {
      const custom = event as CustomEvent<CartToastDetail>;
      setToastMessage(custom.detail?.message || "Đã thêm sản phẩm vào giỏ hàng!");
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => setToastMessage(""), 4000);
    };
    window.addEventListener(cartToastEvent, handleToast);
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      window.removeEventListener(cartToastEvent, handleToast);
    };
  }, []);

  useEffect(() => {
    if (!token) return;
    let active = true;
    let request = 0;
    function refreshCart() {
      const current = ++request;
      getBackendCart(token)
        .then((cart) => {
          if (active && current === request) setCartCount({ token, count: cart.total_quantity });
        })
        .catch(() => {
          if (active && current === request) setCartCount({ token, count: 0 });
        });
    }
    refreshCart();
    window.addEventListener(cartChangedEvent, refreshCart);
    return () => {
      active = false;
      window.removeEventListener(cartChangedEvent, refreshCart);
    };
  }, [token]);

  useEffect(() => {
    if (!openMenu && !mobileMenuOpen) return;
    function closeOutside(event: PointerEvent) {
      if (event.target instanceof Node && !header.current?.contains(event.target)) closeMenus();
    }
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [mobileMenuOpen, openMenu]);

  function closeMenus() {
    setOpenMenu("");
    setMobileMenuOpen(false);
  }

  const rootCategories = defaultRootCategories.map((fallback) =>
    categories.find((item) => !item.parent_id && item.slug === fallback.slug) ?? fallback,
  );
  const home = pathname === "/";
  const overlay = home && !scrolled && !openMenu && !mobileMenuOpen;

  return (
    <header ref={header} className={`header storefront-header${home ? " header-home" : ""}${overlay ? " header-overlay" : ""}${scrolled ? " header-scrolled" : ""}`}>
      <div className="nav site-nav">
        <Link href="/" className="logo" aria-label="Trang chủ F.Style" onClick={closeMenus}>
          <Image src="/logo-vsc.png" alt="VSC_BAPD" width={54} height={54} />
        </Link>

        <nav
          id="store-navigation"
          className={`nav-links${mobileMenuOpen ? " mobile-open" : ""}`}
          aria-label="Danh mục"
          onKeyDown={(event) => {
            if (event.key !== "Escape") return;
            if (openMenu) {
              event.currentTarget.querySelector<HTMLButtonElement>('button[aria-expanded="true"]')?.focus();
              setOpenMenu("");
            } else if (mobileMenuOpen) {
              setMobileMenuOpen(false);
              mobileToggle.current?.focus();
            }
          }}
        >
          {rootCategories.map((category) => {
            const audienceCategories = getAudienceCategories(categories, category);
            const menu = category.slug === "nam"
              ? audienceCategories.filter((item) => item.slug !== "chan-vay" && item.slug !== "vay")
              : audienceCategories;
            if (!menu.length) {
              return (
                <Link
                  className="nav-category-trigger"
                  href={`/categories/${category.slug}`}
                  key={category._id}
                  onClick={closeMenus}
                >
                  {category.name}
                </Link>
              );
            }
            const menuId = `category-menu-${category.slug}`;
            return (
              <div
                className="nav-category"
                key={category.slug}
                onMouseEnter={() => {
                  if (window.matchMedia("(min-width: 1041px) and (hover: hover) and (pointer: fine)").matches) {
                    setOpenMenu(category.slug);
                    setMobileMenuOpen(false);
                  }
                }}
                onMouseLeave={() => {
                  if (window.matchMedia("(min-width: 1041px) and (hover: hover) and (pointer: fine)").matches) {
                    setOpenMenu("");
                  }
                }}
                onBlur={(event) => {
                  if (!(event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget))) {
                    setOpenMenu((current) => current === category.slug ? "" : current);
                  }
                }}
              >
                <button
                  className="nav-category-trigger"
                  type="button"
                  aria-expanded={openMenu === category.slug}
                  aria-controls={menuId}
                  onClick={(event) => {
                    const desktopPointer = event.detail > 0 && window.matchMedia("(min-width: 1041px) and (hover: hover) and (pointer: fine)").matches;
                    setOpenMenu((current) => (!desktopPointer && current === category.slug ? "" : category.slug));
                  }}
                >
                  {category.name}
                  <span className="nav-dropdown-caret" aria-hidden="true">▾</span>
                </button>
                <div
                  className={`nav-mega-menu${openMenu === category.slug ? " open" : ""}`}
                  id={menuId}
                >
                  <div className="nav-mega-content">
                    <div className="nav-mega-intro">
                      <strong>Danh mục {category.name.toLocaleLowerCase("vi")}</strong>
                      <button type="button" className="nav-mega-close" aria-label="Đóng danh mục" onClick={(event) => {
                        event.currentTarget.closest(".nav-category")?.querySelector("button")?.focus();
                        setOpenMenu("");
                      }}>×</button>
                    </div>
                    <CategoryTiles categories={menu} audience={category.slug} onNavigate={closeMenus} />
                    <Link href={`/categories/${category.slug}`} className="pill-button nav-mega-all" onClick={closeMenus}>
                      Xem tất cả thời trang {category.name.toLocaleLowerCase("vi")}
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}

          <div className="nav-extra">
            <Link href="/products" onClick={closeMenus}>Cửa hàng</Link>
            <Link href="/tu-van-size" onClick={closeMenus}>Tư vấn size</Link>
            <Link href="/outfit" onClick={closeMenus}>Phối đồ</Link>
            <Link href="/help" onClick={closeMenus}>Trợ giúp</Link>
          </div>
        </nav>

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

        <div className="nav-actions">
          {isLoggedIn && (role === "admin" || role === "staff") && (
            <Link href="/admin" aria-label="Quản trị cửa hàng" title="Quản trị cửa hàng">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 9h16M5 9l1-5h12l1 5v10a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V9Z" />
                <path d="M10 20v-6h4v6" />
              </svg>
            </Link>
          )}
          <Link href="/wishlist" aria-label="Yêu thích" title="Danh sách yêu thích">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M20.8 8.7c0 4.1-8.8 10.1-8.8 10.1S3.2 12.8 3.2 8.7A4.7 4.7 0 0 1 12 6.2a4.7 4.7 0 0 1 8.8 2.5Z" />
            </svg>
          </Link>
          <Link href={isLoggedIn ? "/profile" : "/dang-nhap"} aria-label="Tài khoản" title="Tài khoản">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="8" r="3.5" />
              <path d="M4.8 20c.6-3.5 3.4-5.5 7.2-5.5s6.6 2 7.2 5.5" />
            </svg>
          </Link>
          <Link
            href="/cart"
            aria-label={cartItemCount > 0 ? `Giỏ hàng, ${cartItemCount} sản phẩm` : "Giỏ hàng"}
            title="Giỏ hàng"
          >
            <span className="header-cart-icon">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 8h14l1 13H4L5 8Z" />
                <path d="M9 9V6a3 3 0 0 1 6 0v3" />
              </svg>
              {cartItemCount > 0 && (
                <span className="header-cart-count" aria-hidden="true">
                  {cartItemCount}
                </span>
              )}
            </span>
          </Link>
        </div>

        <button type="button" className="mobile-menu-toggle" ref={mobileToggle}
          aria-label={mobileMenuOpen ? "Đóng menu danh mục" : "Mở menu danh mục"}
          aria-expanded={mobileMenuOpen} aria-controls="store-navigation"
          onClick={() => { setOpenMenu(""); setMobileMenuOpen((prev) => !prev); }}>
          <span /><span /><span />
        </button>
      </div>

      {toastMessage && (
        <div className="cart-toast-banner" role="status" aria-live="polite">
          <div className="cart-toast-content">
            <span className="cart-toast-check" aria-hidden="true">✓</span>
            <span>{toastMessage}</span>
            <Link href="/cart" className="cart-toast-link" onClick={() => setToastMessage("")}>
              Xem giỏ hàng →
            </Link>
            <button
              type="button"
              className="cart-toast-close"
              aria-label="Đóng thông báo"
              onClick={() => setToastMessage("")}
            >
              ×
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
