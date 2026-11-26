"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { API_BASE_URL, authenticatedHeaders, readApiEnvelope, readApiResponse } from "@/lib/api";
import { signOutDemo, useDemoAuth, type AccountRole } from "@/lib/demo-auth";
import "./admin.css";
import "./admin-workspace.css";

import AdminDashboard from "./AdminDashboard";
import AdminIcon from "./AdminIcon";
import ProductVariantsManager from "./ProductVariantsManager";
import AdminInventory from "./AdminInventory";
import AdminOrders from "./AdminOrders";
import AdminFulfillment from "./AdminFulfillment";
import AdminPayments from "./AdminPayments";
import AdminCustomers from "./AdminCustomers";
import AdminReviews from "./AdminReviews";
import AdminOutfits from "./AdminOutfits";
import AdminReportsSettings from "./AdminReportsSettings";
import AdminContacts from "./AdminContacts";
import BrandManager from "./BrandManager";
import AdminCategories from "./AdminCategories";
import AdminCoupons from "./AdminCoupons";
import AdminActivity from "./AdminActivity";
import AdminBanners from "./AdminBanners";
import { adminSections, navigate, subscribeNavigation, isOrderQueue, type AdminSectionId } from "./adminNavigation";


const adminOnlySections: AdminSectionId[] = ["products", "categories", "brands", "staff", "activity", "banners"];
const searchTargets = [
  { id: "orders", label: "Đơn hàng" },
  { id: "products", label: "Sản phẩm" },
  { id: "inventory", label: "Tồn kho / SKU" },
  { id: "customers", label: "Khách hàng" },
  { id: "staff", label: "Nhân viên" },
] as const;

function WorkspaceSearch({ section, isAdmin, initialSearch, onSearch }: {
  section: AdminSectionId;
  isAdmin: boolean;
  initialSearch: string;
  onSearch: (section: AdminSectionId, search: string) => void;
}) {
  const options = searchTargets.filter(({ id }) => isAdmin || !adminOnlySections.includes(id));
  const initialTarget = options.find(({ id }) => id === section)?.id ?? "orders";
  return (
    <form className="admin-workspace-search" role="search" aria-label="Tìm trong khu quản trị" onSubmit={(event) => {
      event.preventDefault();
      const fields = new FormData(event.currentTarget);
      const target = options.find(({ id }) => id === fields.get("section"));
      if (target) onSearch(target.id, String(fields.get("search") ?? "").trim());
    }}>
      <button className="admin-icon-button" type="submit" aria-label="Tìm kiếm"><AdminIcon name="search" /></button>
      <input name="search" type="search" aria-label="Từ khóa tìm kiếm" maxLength={100} placeholder="Tìm đơn hàng, sản phẩm, SKU, khách hàng…" defaultValue={initialSearch} />
      <select name="section" aria-label="Tìm trong" defaultValue={initialTarget}>
        {options.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
      </select>
    </form>
  );
}

const sectionDescriptions: Partial<Record<AdminSectionId, string>> = {
  dashboard: "Theo dõi hiệu quả kinh doanh và các công việc cần xử lý.",
  work: "Mở đúng hàng đợi để xác nhận đơn, kiểm hàng hoàn và theo dõi hoàn tiền.",
  reports: "Xem doanh thu ghi nhận, sức bán và khuyến nghị nhập hàng.",
};

export default function AdminPage() {
  const router = useRouter();
  const { token, isHydrated, account } = useDemoAuth();
  const [session, setSession] = useState<{ token: string; role?: AccountRole; error?: string }>();
  const [sessionRetry, setSessionRetry] = useState(0);
  const [sidebarCompact, setSidebarCompact] = useState(false);
  const [mobileNavExpanded, setMobileNavExpanded] = useState(false);
  const verifiedRole = session?.token === token ? session.role : undefined;
  const location = useSyncExternalStore(subscribeNavigation, () => window.location.hash.slice(1), () => "");
  const [sectionKey, query] = location.split("?");
  const section = adminSections.find(item => item.id === sectionKey)?.id ?? "dashboard";
  const params = new URLSearchParams(query);
  const queue = params.get("queue");
  const initialSearch = params.get("search")?.slice(0, 100) ?? "";
  // Auth & role check
  useEffect(() => {
    if (!isHydrated) return;
    if (!token) {
      router.replace("/dang-nhap");
      return;
    }

    const controller = new AbortController();
    fetch(`${API_BASE_URL}/admin/session`, { headers: authenticatedHeaders(token), signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (controller.signal.aborted) return;
        if (response.status === 401) {
          signOutDemo();
          router.replace("/dang-nhap");
        } else if (response.status === 403) {
          router.replace("/profile");
        } else {
          return readApiResponse<{ role: AccountRole }>(response);
        }
      })
      .then((res) => {
        if (res && !controller.signal.aborted) setSession({ token, role: res.role });
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setSession({ token, error: cause instanceof Error ? cause.message : "Không thể kiểm tra phiên quản trị." });
        }
      });
    return () => controller.abort();
  }, [isHydrated, router, sessionRetry, token]);

  const adminRequestPage = useCallback(
    async <T,>(path: string, init: RequestInit = {}) => {
      const response = await fetch(`${API_BASE_URL}${path}`, {
        ...init,
        headers: {
          ...authenticatedHeaders(token),
          ...(init.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
          ...init.headers,
        },
      });
      return readApiEnvelope<T>(response, init.method === "DELETE");
    },
    [token],
  );

  const adminRequest = useCallback(
    async <T,>(path: string, init?: RequestInit) => (await adminRequestPage<T>(path, init)).data,
    [adminRequestPage],
  );

  const sessionError = session?.token === token ? session.error : undefined;
  if (sessionError) {
    return (
      <div className="admin-login-prompt" role="alert">
        <p>{sessionError}</p>
        <button type="button" onClick={() => { setSession(undefined); setSessionRetry((value) => value + 1); }}>Thử lại</button>
      </div>
    );
  }
  if (!isHydrated || !verifiedRole) {
    return (
      <div className="admin-login-prompt">
        <div className="spinner-dot" />
        <p>Đang kiểm tra quyền quản trị VSC_BAPD...</p>
      </div>
    );
  }

  const isAdmin = verifiedRole === "admin";
  const activeSection = !isAdmin && adminOnlySections.includes(section) ? "dashboard" : section;
  const selected = adminSections.find(item => item.id === activeSection)!;
  const sectionName = activeSection === "dashboard" ? "Tổng quan cửa hàng"
    : activeSection === "products" ? "Quản lý sản phẩm"
    : activeSection === "customers" ? "Quản lý khách hàng" : selected.label;
  const visibleSections = adminSections.filter(item => isAdmin || !adminOnlySections.includes(item.id));
  const roleLabel = isAdmin ? "Quản trị viên" : "Nhân viên";
  const accountLabel = account || roleLabel;
  const goTo = (target: AdminSectionId, parameters?: Record<string, string>) => {
    setMobileNavExpanded(false);
    navigate(target, parameters);
  };

  return (
    <section className="admin-shell" data-compact={sidebarCompact} data-mobile-expanded={mobileNavExpanded}>
      <aside className="admin-sidebar">
        <Link className="admin-brand" href="/" aria-label="VSC_BAPD - về cửa hàng">
          <Image className="admin-brand-logo" src="/logo-vsc.png" alt="VSC_BAPD" width={46} height={46} loading="eager" />
          <span className="workspace-brand"><strong>VSC_BAPD</strong><small>Quản trị cửa hàng</small></span>
        </Link>

        <nav id="admin-workspace-navigation" className="admin-nav" aria-label="Điều hướng quản trị">
          {Array.from(new Set(visibleSections.map(item => item.group))).map(group => (
            <div className="admin-nav-group" key={group}><p>{group}</p>{visibleSections.filter(item => item.group === group).map((item) => (
            <button
              key={item.id}
              type="button"
              className={activeSection === item.id ? "active" : ""}
              aria-current={activeSection === item.id ? "page" : undefined}
              title={item.label}
              onClick={() => goTo(item.id)}
            >
              <span className="admin-nav-icon"><AdminIcon name={item.id} /></span>
              <span className="admin-nav-text">{item.label}</span>
            </button>
          ))}</div>))}
        </nav>

      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <button className="admin-icon-button admin-desktop-menu" type="button" aria-controls="admin-workspace-navigation" aria-expanded={!sidebarCompact} aria-label={sidebarCompact ? "Mở rộng menu quản trị" : "Thu gọn menu quản trị"} onClick={() => setSidebarCompact((value) => !value)}><AdminIcon name="menu" /></button>
          <button className="admin-icon-button admin-mobile-menu" type="button" aria-controls="admin-workspace-navigation" aria-expanded={mobileNavExpanded} aria-label={mobileNavExpanded ? "Thu gọn menu quản trị" : "Mở rộng menu quản trị"} onClick={() => setMobileNavExpanded((value) => !value)}><AdminIcon name="menu" /></button>
          <WorkspaceSearch key={activeSection + ":" + initialSearch} section={activeSection} isAdmin={isAdmin} initialSearch={initialSearch} onSearch={(target, search) => goTo(target, search ? { search } : undefined)} />
          <div className="admin-topbar-right">
            <button className="admin-icon-button" type="button" aria-label="Mở danh sách việc cần xử lý" title="Việc cần xử lý" onClick={() => goTo("work")}><AdminIcon name="bell" /></button>
            <Link className="admin-store-link" href="/" target="_blank" rel="noopener" aria-label="Xem cửa hàng">
              <AdminIcon name="store" /><span>Xem cửa hàng</span>
            </Link>
            <details className="admin-account" onKeyDown={(event) => {
              if (event.key === "Escape" && event.currentTarget.open) {
                event.currentTarget.open = false;
                event.currentTarget.querySelector("summary")?.focus();
              }
            }}>
              <summary aria-label={`Tài khoản ${accountLabel}`}>
                <span className="admin-avatar">{accountLabel.charAt(0).toUpperCase()}</span>
                <span className="admin-account-label"><strong>{isAdmin ? "Admin" : "Nhân viên"}</strong><small>{roleLabel}</small></span>
                <AdminIcon name="down" />
              </summary>
              <div className="admin-account-menu">
                <strong>{accountLabel}</strong>
                <Link href="/profile">Hồ sơ cá nhân</Link>
                <button type="button" onClick={() => { signOutDemo(); router.replace("/dang-nhap"); }}>Đăng xuất</button>
              </div>
            </details>
          </div>
        </header>

        <div className="admin-content">
          <div className="admin-page-heading">
            {activeSection !== "dashboard" && (
              <nav className="admin-page-path" aria-label="Đường dẫn hiện tại">
                <a href="#dashboard" onClick={() => setMobileNavExpanded(false)}>Tổng quan</a>
                {selected.group !== "Tổng quan" && <><AdminIcon name="chevron" /><span>{selected.group}</span></>}
                <AdminIcon name="chevron" /><span aria-current="page">{sectionName}</span>
              </nav>
            )}
            <h1>{sectionName}</h1>
            {sectionDescriptions[activeSection] && <p>{sectionDescriptions[activeSection]}</p>}
          </div>
          <div key={token + ":" + (activeSection === "fulfillment" ? activeSection : location)}>

          {/* 1. DASHBOARD */}
          {(activeSection === "dashboard" || activeSection === "work" || activeSection === "reports") && (
            <AdminDashboard
              request={adminRequest}
              onNavigate={navigate}
              mode={activeSection}
            />
          )}

          {/* 2. SẢN PHẨM & BIẾN THỂ */}
          {activeSection === "products" && (
            <ProductVariantsManager
              initialSearch={initialSearch} request={adminRequest} paginatedRequest={adminRequestPage}
            />
          )}

          {/* 3. TỒN KHO */}
          {activeSection === "inventory" && <AdminInventory initialSearch={initialSearch} request={adminRequest} paginatedRequest={adminRequestPage} isAdmin={isAdmin} />}

          {/* 4. ĐƠN HÀNG */}
          {activeSection === "orders" && <AdminOrders queue={isOrderQueue(queue) ? queue : undefined} initialSearch={initialSearch} request={adminRequest} paginatedRequest={adminRequestPage} isAdmin={isAdmin} />}
          {activeSection === "fulfillment" && <AdminFulfillment view={params.get("view")} initialSearch={initialSearch} request={adminRequest} paginatedRequest={adminRequestPage} isAdmin={isAdmin} />}

          {/* 5. THANH TOÁN */}
          {activeSection === "payments" && <AdminPayments paginatedRequest={adminRequestPage} />}

          {/* 6. KHÁCH HÀNG & PHÂN QUYỀN */}
          {(activeSection === "customers" || activeSection === "staff") && (
            <AdminCustomers
              request={adminRequest}
              paginatedRequest={adminRequestPage}
              currentUserRole={verifiedRole}
              initialSearch={initialSearch}
              staffDirectory={activeSection === "staff"}
            />
          )}

          {/* 7. DANH MỤC */}
          {activeSection === "categories" && <AdminCategories request={adminRequest} />}

          {activeSection === "brands" && <BrandManager request={adminRequest} />}

          {activeSection === "coupons" && <AdminCoupons request={adminRequest} isAdmin={isAdmin} />}
          {activeSection === "banners" && <AdminBanners request={adminRequest} />}

          {/* 10. ĐÁNH GIÁ SẢN PHẨM */}
          {activeSection === "reviews" && <AdminReviews request={adminRequest} paginatedRequest={adminRequestPage} isAdmin={isAdmin} />}

          {/* 11. OUTFIT & TƯ VẤN SIZE */}
          {activeSection === "outfits" && <AdminOutfits request={adminRequest} paginatedRequest={adminRequestPage} isAdmin={isAdmin} />}

          {/* 12. YÊU CẦU LIÊN HỆ */}
          {(activeSection === "contacts" || activeSection === "returns") && <AdminContacts request={adminRequest} fixedTopic={activeSection === "returns" ? "doi-tra" : undefined} />}

          {activeSection === "activity" && <AdminActivity request={adminRequest} />}

          {/* 13. BÁO CÁO & CÀI ĐẶT */}
          {activeSection === "settings" && (
            <AdminReportsSettings
              request={adminRequest}
              currentUserRole={verifiedRole}
            />
          )}
          </div>
        </div>
      </div>
    </section>
  );
}
