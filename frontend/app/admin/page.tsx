"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { API_BASE_URL, authenticatedHeaders, readApiEnvelope, readApiResponse } from "@/lib/api";
import { signOutDemo, useDemoAuth, type AccountRole } from "@/lib/demo-auth";
import "./admin.css";

import AdminDashboard from "./AdminDashboard";
import AdminIcon from "./AdminIcon";
import ProductVariantsManager from "./ProductVariantsManager";
import AdminInventory from "./AdminInventory";
import AdminOrders from "./AdminOrders";
import AdminPayments from "./AdminPayments";
import AdminCustomers from "./AdminCustomers";
import AdminReviews from "./AdminReviews";
import AdminOutfits from "./AdminOutfits";
import AdminReportsSettings from "./AdminReportsSettings";
import AdminContacts from "./AdminContacts";
import BrandManager from "./BrandManager";

const blankCategory = { name: "", slug: "", description: "", image: "", parent_id: "", status: true };
type Category = Omit<typeof blankCategory, "parent_id"> & { _id: string; parent_id?: { _id: string; name: string } | null };

type Coupon = {
  _id: string;
  code: string;
  discount_type: "percent" | "fixed";
  discount_value: number;
  min_order_value: number;
  max_discount?: number | null;
  usage_limit: number;
  used_count: number;
  start_date: string;
  end_date: string;
  status: boolean;
};

const blankCoupon = {
  code: "",
  discount_type: "percent" as "percent" | "fixed",
  discount_value: "",
  min_order_value: "0",
  max_discount: "",
  usage_limit: "100",
  start_date: "",
  end_date: "",
  status: true,
};

const adminSections = [
  { id: "dashboard", label: "Tổng quan" },
  { id: "products", label: "Sản phẩm & Biến thể" },
  { id: "inventory", label: "Quản lý tồn kho" },
  { id: "orders", label: "Quản lý đơn hàng" },
  { id: "payments", label: "Quản lý thanh toán" },
  { id: "customers", label: "Khách hàng & Phân quyền" },
  { id: "categories", label: "Danh mục sản phẩm" },
  { id: "brands", label: "Thương hiệu" },
  { id: "coupons", label: "Mã giảm giá" },
  { id: "reviews", label: "Đánh giá sản phẩm" },
  { id: "outfits", label: "Outfit & Tư vấn size" },
  { id: "contacts", label: "Yêu cầu liên hệ" },
  { id: "settings", label: "Báo cáo & Cài đặt" },
] as const;

type AdminSectionId = (typeof adminSections)[number]["id"];
const adminOnlySections: AdminSectionId[] = ["products", "categories", "brands"];

export default function AdminPage() {
  const router = useRouter();
  const { token, isHydrated, account } = useDemoAuth();
  const [session, setSession] = useState<{ token: string; role?: AccountRole; error?: string }>();
  const [sessionRetry, setSessionRetry] = useState(0);
  const verifiedRole = session?.token === token ? session.role : undefined;
  const [section, setSection] = useState<AdminSectionId>("dashboard");
  const [categories, setCategories] = useState<Category[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [categoryForm, setCategoryForm] = useState(blankCategory);
  const [couponForm, setCouponForm] = useState(blankCoupon);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editingCoupon, setEditingCoupon] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const formatPrice = (amount: number) => `${new Intl.NumberFormat("vi-VN").format(amount)} đ`;

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

  const refreshData = useCallback((signal?: AbortSignal) =>
    Promise.all([
        verifiedRole === "admin" ? adminRequest<Category[]>("/categories?all=true", { signal }) : [],
        adminRequest<Coupon[]>("/admin/coupons", { signal }),
    ]).then(([categoryData, couponData]) => {
      if (signal?.aborted) return;
      setCategories(categoryData);
      setCoupons(couponData);
    }).catch((cause: unknown) => {
      if (!signal?.aborted) setError(cause instanceof Error ? cause.message : "Không thể tải dữ liệu.");
    }),
  [adminRequest, verifiedRole]);

  useEffect(() => {
    if (!verifiedRole) return;
    const controller = new AbortController();
    void refreshData(controller.signal);
    return () => controller.abort();
  }, [refreshData, verifiedRole]);

  // Save Coupon
  async function saveCoupon(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const payload = {
        ...couponForm,
        discount_value: Number(couponForm.discount_value),
        min_order_value: Number(couponForm.min_order_value),
        max_discount: couponForm.max_discount ? Number(couponForm.max_discount) : null,
        usage_limit: Number(couponForm.usage_limit),
        start_date: new Date(couponForm.start_date).toISOString(),
        end_date: new Date(couponForm.end_date).toISOString(),
      };
      await adminRequest(`/admin/coupons${editingCoupon ? `/${editingCoupon}` : ""}`, {
        method: editingCoupon ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });
      setCouponForm(blankCoupon);
      setEditingCoupon(null);
      setSuccess(editingCoupon ? "Đã cập nhật mã giảm giá." : "Đã tạo mã giảm giá mới.");
      await refreshData();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể lưu mã giảm giá.");
    } finally {
      setBusy(false);
    }
  }

  function editCoupon(coupon: Coupon) {
    const toLocalInputValue = (value: string) => {
      const date = new Date(value);
      return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
    };
    setCouponForm({
      code: coupon.code,
      discount_type: coupon.discount_type,
      discount_value: String(coupon.discount_value),
      min_order_value: String(coupon.min_order_value),
      max_discount: coupon.max_discount == null ? "" : String(coupon.max_discount),
      usage_limit: String(coupon.usage_limit),
      start_date: toLocalInputValue(coupon.start_date),
      end_date: toLocalInputValue(coupon.end_date),
      status: coupon.status,
    });
    setEditingCoupon(coupon._id);
  }

  // Save Category
  async function saveCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await adminRequest(`/categories${editingCategory ? `/${editingCategory}` : ""}`, {
        method: editingCategory ? "PATCH" : "POST",
        body: JSON.stringify(categoryForm),
      });
      setCategoryForm(blankCategory);
      setEditingCategory(null);
      window.dispatchEvent(new Event("fstyle-catalog-change"));
      setSuccess(editingCategory ? "Đã cập nhật danh mục." : "Đã tạo danh mục.");
      await refreshData();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể lưu danh mục.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteEntry(path: string, label: string) {
    if (!window.confirm(`Bạn chắc chắn muốn xóa ${label} này?`)) return;
    setError("");
    setSuccess("");
    try {
      await adminRequest(path, { method: "DELETE" });
      window.dispatchEvent(new Event("fstyle-catalog-change"));
      setSuccess(`Đã xóa ${label}.`);
      await refreshData();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `Không thể xóa ${label}.`);
    }
  }

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
        <p>Đang kiểm tra quyền quản trị F.Style Store...</p>
      </div>
    );
  }

  const isAdmin = verifiedRole === "admin";
  const activeSection = !isAdmin && adminOnlySections.includes(section) ? "dashboard" : section;
  const sectionName = adminSections.find((item) => item.id === activeSection)?.label ?? "Quản trị";

  return (
    <section className="admin-shell">
      {/* SIDEBAR NAVIGATION */}
      <aside className="admin-sidebar">
        <Link className="admin-brand" href="/" aria-label="F.Style Store - về cửa hàng">
          <span className="admin-brand-name">F.Style</span>
          <small>Quản trị</small>
        </Link>

        <nav className="admin-nav" aria-label="Điều hướng quản trị">
          {adminSections.filter((item) => isAdmin || !adminOnlySections.includes(item.id)).map((item) => (
            <button
              key={item.id}
              type="button"
              className={activeSection === item.id ? "active" : ""}
              aria-current={activeSection === item.id ? "page" : undefined}
              onClick={() => setSection(item.id)}
            >
              <span className="admin-nav-icon"><AdminIcon name={item.id} /></span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="admin-sidebar-bottom">
          <div className="admin-profile-chip">
            <span className="admin-avatar">{isAdmin ? "A" : "S"}</span>
            <div>
              <strong>{account || (isAdmin ? "Quản trị viên" : "Nhân viên")}</strong>
              <small>{isAdmin ? "Toàn quyền hệ thống" : "Vận hành đơn & kho"}</small>
            </div>
          </div>
          <Link href="/">← <span>Quay lại cửa hàng</span></Link>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="admin-main">
        <header className="admin-topbar">
          <div>
            <h1>{sectionName}</h1>
          </div>
          <div className="admin-topbar-right">
            <span className="admin-status">
              <i /> Hệ thống trực tuyến
            </span>
            <Link className="admin-store-link" href="/" target="_blank">
              Xem cửa hàng ↗
            </Link>
          </div>
        </header>

        <div className="admin-content" key={activeSection}>
          {activeSection === "dashboard" && (
            <div className="admin-welcome">
              <div>
                <h2>Tình hình cửa hàng</h2>
                <p>Theo dõi doanh thu, đơn hàng và những mặt hàng sắp hết.</p>
              </div>
              <button className="admin-button" type="button" onClick={() => setSection("orders")}>
                Xem đơn hàng <span aria-hidden="true">↗</span>
              </button>
            </div>
          )}

          {error && <p className="admin-alert" role="alert">{error}</p>}
          {success && <p className="admin-success" role="status">{success}</p>}

          {/* 1. DASHBOARD */}
          {activeSection === "dashboard" && (
            <AdminDashboard
              request={adminRequest}
              onNavigate={(tab) => setSection(tab as AdminSectionId)}
            />
          )}

          {/* 2. SẢN PHẨM & BIẾN THỂ */}
          {activeSection === "products" && (
            <ProductVariantsManager
              request={adminRequest} paginatedRequest={adminRequestPage}
            />
          )}

          {/* 3. TỒN KHO */}
          {activeSection === "inventory" && <AdminInventory request={adminRequest} paginatedRequest={adminRequestPage} />}

          {/* 4. ĐƠN HÀNG */}
          {activeSection === "orders" && <AdminOrders request={adminRequest} isAdmin={isAdmin} />}

          {/* 5. THANH TOÁN */}
          {activeSection === "payments" && <AdminPayments request={adminRequest} />}

          {/* 6. KHÁCH HÀNG & PHÂN QUYỀN */}
          {activeSection === "customers" && (
            <AdminCustomers
              request={adminRequest}
              currentUserRole={verifiedRole}
            />
          )}

          {/* 7. DANH MỤC */}
          {activeSection === "categories" && (
            <>
              <div className="admin-panel">
                <h2>{editingCategory ? "Sửa danh mục" : "Tạo danh mục mới"}</h2>
                <form className="admin-form" onSubmit={saveCategory}>
                  <label>
                    Tên danh mục
                    <input
                      required
                      value={categoryForm.name}
                      onChange={(event) =>
                        setCategoryForm({ ...categoryForm, name: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    Slug danh mục
                    <input
                      required
                      value={categoryForm.slug}
                      onChange={(event) =>
                        setCategoryForm({ ...categoryForm, slug: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    Danh mục cha
                    <select
                      value={categoryForm.parent_id}
                      onChange={(event) =>
                        setCategoryForm({ ...categoryForm, parent_id: event.target.value })
                      }
                    >
                      <option value="">Danh mục gốc (Không có cha)</option>
                      {categories
                        .filter((item) => item._id !== editingCategory)
                        .map((item) => (
                          <option value={item._id} key={item._id}>
                            {item.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    Đường dẫn ảnh
                    <input
                      value={categoryForm.image}
                      onChange={(event) =>
                        setCategoryForm({ ...categoryForm, image: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    Mô tả
                    <input
                      value={categoryForm.description}
                      onChange={(event) =>
                        setCategoryForm({ ...categoryForm, description: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    Hiển thị
                    <select
                      value={String(categoryForm.status)}
                      onChange={(event) =>
                        setCategoryForm({
                          ...categoryForm,
                          status: event.target.value === "true",
                        })
                      }
                    >
                      <option value="true">Đang hiển thị</option>
                      <option value="false">Đã ẩn</option>
                    </select>
                  </label>
                  <div className="admin-actions wide">
                    <button className="admin-button" disabled={busy}>
                      {busy ? "Đang lưu..." : editingCategory ? "Lưu thay đổi" : "Tạo danh mục"}
                    </button>
                    {editingCategory && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCategory(null);
                          setCategoryForm(blankCategory);
                        }}
                      >
                        Hủy
                      </button>
                    )}
                  </div>
                </form>
              </div>

              <div className="admin-panel">
                <div className="admin-panel-heading">
                  <div>
                    <h2>Danh sách danh mục ({categories.length})</h2>
                    <p>Phân loại sản phẩm theo cấu trúc cha / con.</p>
                  </div>
                </div>
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Tên danh mục</th>
                        <th>Slug</th>
                        <th>Danh mục cha</th>
                        <th>Mô tả</th>
                        <th style={{ textAlign: "right" }}>Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categories.map((category) => (
                        <tr key={category._id}>
                          <td>
                            <strong>{category.name}</strong>
                            {category.status === false && (
                              <small style={{ color: "#ef4444" }}> · Đã ẩn</small>
                            )}
                          </td>
                          <td>
                            <code>{category.slug}</code>
                          </td>
                          <td>
                            {category.parent_id?.name ? (
                              <span className="spec-chip">{category.parent_id.name}</span>
                            ) : (
                              <span className="admin-muted">Gốc</span>
                            )}
                          </td>
                          <td>{category.description || "—"}</td>
                          <td style={{ textAlign: "right" }}>
                            <div className="admin-actions" style={{ justifyContent: "flex-end" }}>
                              <button
                                onClick={() => {
                                  setEditingCategory(category._id);
                                  setCategoryForm({
                                    name: category.name,
                                    slug: category.slug,
                                    description: category.description ?? "",
                                    image: category.image ?? "",
                                    parent_id: category.parent_id?._id ?? "",
                                    status: category.status,
                                  });
                                }}
                              >
                                Sửa
                              </button>
                              <button
                                className="danger-btn"
                                onClick={() =>
                                  void deleteEntry(`/categories/${category._id}`, "danh mục")
                                }
                              >
                                Xóa
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* 8. THƯƠNG HIỆU */}
          {activeSection === "brands" && <BrandManager request={adminRequest} />}

          {/* 9. MÃ GIẢM GIÁ */}
          {activeSection === "coupons" && (
            <>
              <div className="admin-panel">
                <h2>{editingCoupon ? "Cập nhật mã giảm giá" : "Tạo mã giảm giá"}</h2>
                <form className="admin-form" onSubmit={saveCoupon}>
                  <label>
                    Mã giảm giá
                    <input
                      required
                      value={couponForm.code}
                      onChange={(event) =>
                        setCouponForm({
                          ...couponForm,
                          code: event.target.value.toUpperCase(),
                        })
                      }
                      placeholder="VD: FSTYLE10"
                    />
                  </label>
                  <label>
                    Loại ưu đãi
                    <select
                      value={couponForm.discount_type}
                      onChange={(event) =>
                        setCouponForm({
                          ...couponForm,
                          discount_type: event.target.value as "percent" | "fixed",
                        })
                      }
                    >
                      <option value="percent">Phần trăm (%)</option>
                      <option value="fixed">Số tiền cố định (VND)</option>
                    </select>
                  </label>
                  <label>
                    Giá trị giảm
                    <input
                      required
                      type="number"
                      min="1"
                      max={couponForm.discount_type === "percent" ? 100 : undefined}
                      value={couponForm.discount_value}
                      onChange={(event) =>
                        setCouponForm({ ...couponForm, discount_value: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    Đơn tối thiểu (VND)
                    <input
                      required
                      type="number"
                      min="0"
                      value={couponForm.min_order_value}
                      onChange={(event) =>
                        setCouponForm({ ...couponForm, min_order_value: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    Giảm tối đa (VND, tùy chọn)
                    <input
                      type="number"
                      min="0"
                      value={couponForm.max_discount}
                      onChange={(event) =>
                        setCouponForm({ ...couponForm, max_discount: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    Lượt sử dụng tối đa
                    <input
                      required
                      type="number"
                      min="1"
                      step="1"
                      value={couponForm.usage_limit}
                      onChange={(event) =>
                        setCouponForm({ ...couponForm, usage_limit: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    Bắt đầu
                    <input
                      required
                      type="datetime-local"
                      value={couponForm.start_date}
                      onChange={(event) =>
                        setCouponForm({ ...couponForm, start_date: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    Kết thúc
                    <input
                      required
                      type="datetime-local"
                      value={couponForm.end_date}
                      onChange={(event) =>
                        setCouponForm({ ...couponForm, end_date: event.target.value })
                      }
                    />
                  </label>
                  <label className="admin-coupon-toggle">
                    <input
                      type="checkbox"
                      checked={couponForm.status}
                      onChange={(event) =>
                        setCouponForm({ ...couponForm, status: event.target.checked })
                      }
                    />{" "}
                    Kích hoạt mã sau khi lưu
                  </label>
                  <div className="admin-actions wide">
                    <button className="admin-button" disabled={busy}>
                      {busy ? "Đang lưu..." : editingCoupon ? "Lưu thay đổi" : "Tạo mã"}
                    </button>
                    {editingCoupon && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCoupon(null);
                          setCouponForm(blankCoupon);
                        }}
                      >
                        Hủy
                      </button>
                    )}
                  </div>
                </form>
              </div>

              <div className="admin-panel">
                <div className="admin-panel-heading">
                  <div>
                    <h2>Chương trình ưu đãi ({coupons.length} mã)</h2>
                    <p>Mã giảm giá và tình trạng sử dụng.</p>
                  </div>
                </div>
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Mã</th>
                        <th>Mức giảm</th>
                        <th>Điều kiện</th>
                        <th>Đã dùng</th>
                        <th>Thời hạn</th>
                        <th>Trạng thái</th>
                        <th style={{ textAlign: "right" }}>Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {coupons.map((coupon) => (
                        <tr key={coupon._id}>
                          <td>
                            <strong>{coupon.code}</strong>
                          </td>
                          <td>
                            {coupon.discount_type === "percent"
                              ? `${coupon.discount_value}%`
                              : formatPrice(coupon.discount_value)}
                          </td>
                          <td>
                            Đơn từ {formatPrice(coupon.min_order_value)}
                            {coupon.max_discount != null ? (
                              <>
                                <br />
                                <small>Tối đa {formatPrice(coupon.max_discount)}</small>
                              </>
                            ) : null}
                          </td>
                          <td>
                            {coupon.used_count}/{coupon.usage_limit}
                          </td>
                          <td>
                            {new Date(coupon.start_date).toLocaleDateString("vi-VN")} –{" "}
                            {new Date(coupon.end_date).toLocaleDateString("vi-VN")}
                          </td>
                          <td>
                            <span
                              className={`admin-coupon-state ${coupon.status ? "enabled" : ""}`}
                            >
                              {coupon.status ? "Đang bật" : "Đã tắt"}
                            </span>
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <div className="admin-actions" style={{ justifyContent: "flex-end" }}>
                              <button onClick={() => editCoupon(coupon)}>Sửa</button>
                              {isAdmin && (
                                <button
                                  className="danger-btn"
                                  onClick={() =>
                                    void deleteEntry(
                                      `/admin/coupons/${coupon._id}`,
                                      "mã giảm giá",
                                    )
                                  }
                                >
                                  Xóa
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {!coupons.length && (
                        <tr>
                          <td className="admin-empty" colSpan={7}>
                            Chưa có mã giảm giá nào.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* 10. ĐÁNH GIÁ SẢN PHẨM */}
          {activeSection === "reviews" && <AdminReviews request={adminRequest} />}

          {/* 11. OUTFIT & TƯ VẤN SIZE */}
          {activeSection === "outfits" && <AdminOutfits request={adminRequest} paginatedRequest={adminRequestPage} isAdmin={isAdmin} />}

          {/* 12. YÊU CẦU LIÊN HỆ */}
          {activeSection === "contacts" && <AdminContacts request={adminRequest} />}

          {/* 13. BÁO CÁO & CÀI ĐẶT */}
          {activeSection === "settings" && (
            <AdminReportsSettings
              request={adminRequest}
              currentUserRole={verifiedRole}
            />
          )}
        </div>
      </div>
    </section>
  );
}
