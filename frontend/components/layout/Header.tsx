"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import CategoryTiles from "@/components/product/CategoryTiles";
import CartDrawer from "@/components/cart/CartDrawer";
import SearchSuggestions from "./SearchSuggestions";
import { getAudienceCategories } from "@/lib/catalog-audience";
import { useCatalogCategories } from "@/lib/useCatalogCategories";
import { useDemoAuth } from "@/lib/demo-auth";
import { useAccountSession } from "@/components/account/useAccountSession";
import { STORE_LOGO, STORE_NAME } from "@/lib/store-brand";
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

const compactQuery = "(max-width: 1040px)";
function subscribeToWidth(notify: () => void) {
  const media = window.matchMedia(compactQuery);
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
}

function NavigationSurface({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  const compact = useSyncExternalStore(subscribeToWidth, () => window.matchMedia(compactQuery).matches, () => false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = dialog.current;
    if (open && compact && node && !node.open) node.showModal();
    return () => { if (node?.open) node.close(); };
  }, [open, compact]);
  if (!compact) return children;
  return (
    <dialog ref={dialog} className="store-nav-drawer" aria-label="Menu cửa hàng"
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
      onCancel={(event) => { event.preventDefault(); if (!dialog.current?.querySelector('.nav-submenu-toggle[aria-expanded="true"]')) onClose(); }}>
      <div className="store-nav-drawer-body">
        <div className="store-nav-drawer-heading">
          <Link href="/" onClick={onClose}><Image src={STORE_LOGO} width={48} height={48} alt={STORE_NAME} /></Link>
          <button type="button" onClick={onClose} aria-label="Đóng menu">×</button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

export default function Header() {
  const pathname = usePathname();
  const { isLoggedIn, role, token } = useDemoAuth();
  const { name, notice: sessionNotice } = useAccountSession(token);
  const { categories = [] } = useCatalogCategories();
  const [cartCount, setCartCount] = useState({ token: "", count: 0 });
  const cartItemCount = cartCount.token === token ? cartCount.count : 0;
  const [openMenu, setOpenMenu] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const mobileToggle = useRef<HTMLButtonElement>(null);
  const searchToggle = useRef<HTMLButtonElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const cartToggle = useRef<HTMLButtonElement>(null);
  const header = useRef<HTMLElement>(null);

  useEffect(() => {
    if (mobileSearchOpen) searchInput.current?.focus();
  }, [mobileSearchOpen]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const focusSelector = window.matchMedia("(max-width: 1040px)").matches
      ? ".nav-category-trigger"
      : ".nav-extra a";
    header.current?.querySelector<HTMLElement>(focusSelector)?.focus();
  }, [mobileMenuOpen]);

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
    if (!openMenu && !mobileMenuOpen && !mobileSearchOpen) return;
    function closeOutside(event: PointerEvent) {
      if (event.target instanceof Node && !header.current?.contains(event.target)) closeMenus();
      else if (mobileSearchOpen && event.target instanceof Element && !event.target.closest("#store-search, .mobile-search-toggle")) {
        setMobileSearchOpen(false);
      }
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (openMenu) {
        header.current?.querySelector<HTMLButtonElement>('.nav-submenu-toggle[aria-expanded="true"]')?.focus();
        setOpenMenu("");
      } else if (mobileSearchOpen) {
        if (searchToggle.current?.getClientRects().length) searchToggle.current.focus();
        else searchInput.current?.focus();
        setMobileSearchOpen(false);
      } else {
        setMobileMenuOpen(false);
        mobileToggle.current?.focus();
      }
    }
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [mobileMenuOpen, openMenu, mobileSearchOpen]);

  function closeMenus() {
    setOpenMenu("");
    setMobileMenuOpen(false);
    setMobileSearchOpen(false);
  }

  const rootCategories = defaultRootCategories.map((fallback) =>
    categories.find((item) => !item.parent_id && item.slug === fallback.slug) ?? fallback,
  );
  const isHome = pathname === "/";
  const isSolid = Boolean(openMenu || mobileMenuOpen || mobileSearchOpen || cartOpen);

  return (
    <header
      ref={header}
      className={`header storefront-header${isHome ? " storefront-header-transparent" : ""}${isSolid ? " storefront-header-solid" : ""}`}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse" && openMenu) setOpenMenu("");
      }}
    >
      <a href="#store-content" className="store-skip-link">Đến nội dung chính</a>
      <div className="nav site-nav">
        <Link href="/" className="logo" aria-label={`Trang chủ ${STORE_NAME}`} onClick={closeMenus}>
          <Image src={STORE_LOGO} alt="" width={64} height={64} loading="eager" />
        </Link>

        <NavigationSurface open={mobileMenuOpen} onClose={() => { closeMenus(); mobileToggle.current?.focus(); }}>
        <nav
          id="store-navigation"
          className={`nav-links${mobileMenuOpen ? " mobile-open" : ""}`}
          aria-label="Danh mục"
        >
          <Link href="/products" className="nav-category-trigger nav-shop-link"
            aria-current={pathname === "/products" ? "page" : undefined}
            onPointerEnter={(event) => {
              if (event.pointerType === "mouse" && openMenu) setOpenMenu("");
            }}
            onClick={closeMenus}>
            Cửa hàng
          </Link>
          {rootCategories.map((category) => {
            const href = `/categories/${category.slug}`;
            const isCurrent = pathname === `/${category.slug}` || pathname === href;
            const audienceCategories = getAudienceCategories(categories, category);
            const menu = category.slug === "nam"
              ? audienceCategories.filter((item) => item.slug !== "chan-vay" && item.slug !== "vay")
              : audienceCategories;
            const menuId = `category-menu-${category.slug}`;
            const expanded = openMenu === category.slug;
            return (
              <div
                className="nav-category"
                key={category.slug}
                onBlur={(event) => {
                  if (!(event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget))) {
                    setOpenMenu((current) => current === category.slug ? "" : current);
                  }
                }}
              >
                <div className="nav-category-row">
                  <Link className="nav-category-trigger" href={href}
                    aria-current={isCurrent ? "page" : undefined}
                    onPointerEnter={(event) => {
                      if (event.pointerType === "mouse" && !window.matchMedia(compactQuery).matches) {
                        setMobileSearchOpen(false);
                        setOpenMenu(menu.length > 0 ? category.slug : "");
                      }
                    }}
                    onClick={closeMenus}>
                    {category.name}
                  </Link>
                  {menu.length > 0 && <button
                    className="nav-submenu-toggle"
                    type="button"
                    aria-label={`Danh mục con ${category.name}`}
                    aria-expanded={expanded}
                    aria-controls={menuId}
                    onClick={() => {
                      setMobileSearchOpen(false);
                      setOpenMenu((current) => current === category.slug ? "" : category.slug);
                    }}
                  >
                    <span aria-hidden="true" />
                  </button>}
                </div>
                {menu.length > 0 && <div className={`nav-mega-menu${expanded ? " open" : ""}`} id={menuId}>
                  <div className="nav-mega-content">
                    <div className="nav-mega-intro">
                      <strong>Danh mục {category.name.toLocaleLowerCase("vi")}</strong>
                      <button type="button" className="nav-mega-close" aria-label={`Đóng danh mục con ${category.name}`} onClick={(event) => {
                        event.currentTarget.closest(".nav-category")?.querySelector<HTMLButtonElement>(".nav-submenu-toggle")?.focus();
                        setOpenMenu("");
                      }}>×</button>
                    </div>
                    <CategoryTiles categories={menu} audience={category.slug} onNavigate={closeMenus} />
                    <Link href={href} className="pill-button nav-mega-all" onClick={closeMenus}>
                      Xem tất cả thời trang {category.name.toLocaleLowerCase("vi")}
                    </Link>
                  </div>
                </div>}
              </div>
            );
          })}

          <div className="nav-extra">
            <Link href={isLoggedIn ? "/profile" : "/dang-nhap"} onClick={closeMenus}>{name || "Tài khoản"}</Link>
            <Link href="/orders" onClick={closeMenus}>Đơn hàng</Link>
            <Link href="/wishlist" onClick={closeMenus}>Yêu thích</Link>
            <Link href="/tu-van-size" onClick={closeMenus}>Tư vấn size</Link>
            <Link href="/outfit" onClick={closeMenus}>Phối đồ</Link>
            <Link href="/help" onClick={closeMenus}>Trợ giúp</Link>
          </div>
        </nav>
        </NavigationSurface>

        <form
          id="store-search"
          className={`header-search${mobileSearchOpen ? " header-search-open" : ""}`}
          action="/search"
          role="search"
        >
          <label className="sr-only" htmlFor="header-search-query">Tìm kiếm sản phẩm</label>
          <input
            id="header-search-query"
            ref={searchInput}
            type="search"
            name="q"
            placeholder="Bạn đang tìm sản phẩm gì?"
            value={searchQuery}
            maxLength={120}
            onFocus={() => { setOpenMenu(""); setMobileMenuOpen(false); setMobileSearchOpen(true); }}
            onChange={(event) => { setSearchQuery(event.target.value); setMobileSearchOpen(true); }}
          />
          <button type="submit" aria-label="Tìm kiếm">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="10.8" cy="10.8" r="6.8" />
              <path d="m16 16 4.5 4.5" />
            </svg>
          </button>
          {mobileSearchOpen && (
            <SearchSuggestions
              query={searchQuery}
              categories={categories}
              onNavigate={closeMenus}
              onClose={() => setMobileSearchOpen(false)}
            />
          )}
        </form>

        <div className="nav-actions">
          <button className="mobile-search-toggle" type="button" ref={searchToggle}
            aria-label={mobileSearchOpen ? "Đóng tìm kiếm" : "Mở tìm kiếm"}
            aria-controls="store-search" aria-expanded={mobileSearchOpen}
            onClick={() => {
              setOpenMenu("");
              setMobileMenuOpen(false);
              setMobileSearchOpen((current) => !current);
            }}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="10.8" cy="10.8" r="6.8" />
              <path d="m16 16 4.5 4.5" />
            </svg>
          </button>
          {isLoggedIn && (role === "admin" || role === "staff") && (
            <Link href="/admin" aria-label="Quản trị cửa hàng" title="Quản trị cửa hàng" onClick={closeMenus}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 9h16M5 9l1-5h12l1 5v10a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V9Z" />
                <path d="M10 20v-6h4v6" />
              </svg>
            </Link>
          )}
          <Link href="/wishlist" aria-label="Yêu thích" title="Danh sách yêu thích" onClick={closeMenus}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M20.8 8.7c0 4.1-8.8 10.1-8.8 10.1S3.2 12.8 3.2 8.7A4.7 4.7 0 0 1 12 6.2a4.7 4.7 0 0 1 8.8 2.5Z" />
            </svg>
          </Link>
          <Link href={isLoggedIn ? "/profile" : "/dang-nhap"} aria-label="Tài khoản" title={name || "Tài khoản"} onClick={closeMenus}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="8" r="3.5" />
              <path d="M4.8 20c.6-3.5 3.4-5.5 7.2-5.5s6.6 2 7.2 5.5" />
            </svg>
          </Link>
          <button
            type="button"
            className="header-cart-toggle"
            ref={cartToggle}
            aria-haspopup="dialog"
            aria-label={cartItemCount > 0 ? `Giỏ hàng, ${cartItemCount} sản phẩm` : "Giỏ hàng"}
            title="Giỏ hàng"
            onClick={() => { closeMenus(); setCartOpen(true); }}
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
          </button>
        </div>

        <button type="button" className="mobile-menu-toggle" ref={mobileToggle}
          aria-label={mobileMenuOpen ? "Đóng menu danh mục" : "Mở menu danh mục"}
          aria-expanded={mobileMenuOpen} aria-controls="store-navigation"
          onClick={() => {
            setOpenMenu("");
            setMobileSearchOpen(false);
            setMobileMenuOpen((prev) => !prev);
          }}>
          <span /><span /><span />
        </button>
      </div>

      {sessionNotice && <p className="header-session-notice" role="alert">{sessionNotice}</p>}
      {cartOpen && <CartDrawer token={token} onClose={() => { setCartOpen(false); cartToggle.current?.focus(); }} />}

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
