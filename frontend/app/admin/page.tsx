"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { API_BASE_URL, authenticatedHeaders, readApiResponse } from "@/lib/api";
import { signOutDemo, useDemoAuth } from "@/lib/demo-auth";
import type { Product } from "@/types/product";
import "./admin.css";
import ProductVariantsManager from "./ProductVariantsManager";

type Category = { _id: string; name: string; slug: string; description?: string };
type StoredProduct = Omit<Product, "id" | "category"> & {
  _id: string;
  category_id: string | { _id: string; name: string };
};
type AdminOrder = {
  _id: string;
  user_id: { name: string; email: string } | null;
  receiver_name: string;
  receiver_phone: string;
  final_amount: number;
  order_status: "pending" | "processing" | "shipping" | "completed" | "cancelled";
  payment_status: string;
  payment_method: string;
  created_at: string;
  items: Array<{ product_name: string; sku: string; size: string; color: string; quantity: number }>;
};
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

const blankProduct = {
  name: "",
  code: "",
  color: "",
  sizes: "",
  price: "",
  categoryId: "",
  image: "",
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
  { id: "variants", label: "Biến thể sản phẩm", icon: "▦" },
  { id: "products", label: "Sản phẩm", icon: "▦" },
  { id: "categories", label: "Danh mục", icon: "◇" },
  { id: "orders", label: "Đơn hàng", icon: "▤" },
  { id: "coupons", label: "Mã giảm giá", icon: "%" },
] as const;

export default function AdminPage() {
  const router = useRouter();
  const { isLoggedIn, role, token, isHydrated } = useDemoAuth();
  const [verified, setVerified] = useState(false);
  const [section, setSection] = useState<(typeof adminSections)[number]["id"]>("products");
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<StoredProduct[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [productForm, setProductForm] = useState(blankProduct);
  const [categoryForm, setCategoryForm] = useState({ name: "", description: "" });
  const [couponForm, setCouponForm] = useState(blankCoupon);
  const [editingProduct, setEditingProduct] = useState<string | null>(null);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editingCoupon, setEditingCoupon] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!isHydrated) return;
    if (isLoggedIn && role !== "admin") router.replace("/profile");
    if (!isLoggedIn || !token) {
      router.replace("/dang-nhap");
      return;
    }
    if (role !== "admin") return;

    let active = true;
    fetch(`${API_BASE_URL}/admin/session`, { headers: authenticatedHeaders(token) })
      .then(readApiResponse<{ role: "admin" }>)
      .then(() => {
        if (active) setVerified(true);
      })
      .catch(() => {
        if (!active) return;
        signOutDemo();
        router.replace("/dang-nhap");
      });
    return () => { active = false; };
  }, [isHydrated, isLoggedIn, role, router, token]);

  const adminRequest = useCallback(async <T,>(path: string, init: RequestInit = {}) => {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        ...authenticatedHeaders(token),
        ...(init.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
        ...init.headers,
      },
    });
    return readApiResponse<T>(response);
  }, [token]);

  useEffect(() => {
    if (!verified || !token || role !== "admin") return;
    let active = true;
    const loadData = async () => {
      try {
        const [categoryData, productData, orderData, couponData] = await Promise.all([
          fetch(`${API_BASE_URL}/catalog/categories`).then(readApiResponse<Category[]>),
          fetch(`${API_BASE_URL}/catalog/products`).then(readApiResponse<StoredProduct[]>),
          adminRequest<AdminOrder[]>("/admin/orders"),
          adminRequest<Coupon[]>("/admin/coupons"),
        ]);
        if (active) {
          setCategories(categoryData);
          setProducts(productData);
          setOrders(orderData);
          setCoupons(couponData);
          setError("");
        }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Không thể tải dữ liệu quản trị.");
      }
    };
    void loadData();
    return () => { active = false; };
  }, [adminRequest, role, token, verified]);

  async function refreshData() {
    const [categoryData, productData, orderData, couponData] = await Promise.all([
      fetch(`${API_BASE_URL}/catalog/categories`).then(readApiResponse<Category[]>),
      fetch(`${API_BASE_URL}/catalog/products`).then(readApiResponse<StoredProduct[]>),
      adminRequest<AdminOrder[]>("/admin/orders"),
      adminRequest<Coupon[]>("/admin/coupons"),
    ]);
    setCategories(categoryData);
    setProducts(productData);
    setOrders(orderData);
    setCoupons(couponData);
  }

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
      };
      await adminRequest(`/admin/coupons${editingCoupon ? `/${editingCoupon}` : ""}`, {
        method: editingCoupon ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });
      setCouponForm(blankCoupon);
      setEditingCoupon(null);
      setSuccess(editingCoupon ? "Đã cập nhật mã giảm giá." : "Đã tạo mã giảm giá.");
      await refreshData();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể lưu mã giảm giá.");
    } finally {
      setBusy(false);
    }
  }

  async function updateOrderStatus(orderId: string, status: AdminOrder["order_status"]) {
    setError("");
    setSuccess("");
    try {
      await adminRequest(`/admin/orders/${orderId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setSuccess("Đã cập nhật trạng thái đơn hàng.");
      await refreshData();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể cập nhật đơn hàng.");
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

  async function saveCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await adminRequest(`/admin/categories${editingCategory ? `/${editingCategory}` : ""}`, {
        method: editingCategory ? "PUT" : "POST",
        body: JSON.stringify(categoryForm),
      });
      setCategoryForm({ name: "", description: "" });
      setEditingCategory(null);
      window.dispatchEvent(new Event("bapd-catalog-change"));
      setSuccess(editingCategory ? "Đã cập nhật danh mục." : "Đã tạo danh mục.");
      await refreshData();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể lưu danh mục.");
    } finally {
      setBusy(false);
    }
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      let image = productForm.image;
      if (imageFile) {
        const uploadData = new FormData();
        uploadData.set("image", imageFile);
        const uploaded = await adminRequest<{ url: string }>("/admin/uploads", {
          method: "POST",
          body: uploadData,
        });
        image = `${API_BASE_URL.replace(/\/api\/?$/, "")}${uploaded.url}`;
      }
      if (!image.trim()) throw new Error("Hãy chọn ảnh hoặc nhập đường dẫn ảnh.");
      const payload = {
        ...productForm,
        categoryId: productForm.categoryId,
        price: Number(productForm.price),
        sizes: productForm.sizes.split(",").map((size) => size.trim()).filter(Boolean),
        image,
      };
      await adminRequest(`/admin/products${editingProduct ? `/${editingProduct}` : ""}`, {
        method: editingProduct ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });
      setProductForm(blankProduct);
      setImageFile(null);
      setEditingProduct(null);
      window.dispatchEvent(new Event("bapd-catalog-change"));
      setSuccess(editingProduct ? "Đã cập nhật sản phẩm." : "Đã thêm sản phẩm.");
      await refreshData();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể lưu sản phẩm.");
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
      window.dispatchEvent(new Event("bapd-catalog-change"));
      setSuccess(`Đã xóa ${label}.`);
      await refreshData();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `Không thể xóa ${label}.`);
    }
  }

  function editProduct(product: StoredProduct) {
    const categoryId = typeof product.category_id === "string"
      ? product.category_id
      : product.category_id._id;
    setProductForm({
      name: product.name,
      code: product.code,
      color: product.color,
      sizes: product.sizes.join(", "),
      price: String(product.price),
      categoryId,
      image: product.image,
    });
    setEditingProduct(product._id);
    setImageFile(null);
    setSection("products");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (!isHydrated || !isLoggedIn || role !== "admin" || !verified) {
    return <div className="admin-login-prompt">Đang kiểm tra quyền quản trị...</div>;
  }

  const sectionName = adminSections.find((item) => item.id === section)?.label ?? "Quản trị";
  const formatPrice = (amount: number) => `${new Intl.NumberFormat("vi-VN").format(amount)} đ`;
  const statusLabels: Record<AdminOrder["order_status"], string> = {
    pending: "Chờ xác nhận",
    processing: "Đang xử lý",
    shipping: "Đang giao",
    completed: "Hoàn thành",
    cancelled: "Đã hủy",
  };

  return (
    <section className="admin-shell">
      <aside className="admin-sidebar">
        <Link className="admin-brand" href="/" aria-label="BAPD Commerce - về cửa hàng">
          <Image className="admin-brand-logo" src="/logo-vcs.png" alt="VCS BAPD" width={52} height={52} priority />
          <span>BAPD <small>COMMERCE</small></span>
        </Link>
        <span className="admin-nav-label">KHÔNG GIAN QUẢN TRỊ</span>
        <nav className="admin-nav" aria-label="Điều hướng quản trị">
          {adminSections.map((item) => (
            <button key={item.id} type="button" className={section === item.id ? "active" : ""} onClick={() => setSection(item.id)}>
              <span className="admin-nav-icon">{item.icon}</span>{item.label}
              {item.id !== "variants" && <span className="admin-nav-count">{item.id === "products" ? products.length : item.id === "categories" ? categories.length : item.id === "orders" ? orders.length : coupons.length}</span>}
            </button>
          ))}
        </nav>
        <div className="admin-sidebar-bottom">
          <div className="admin-profile-chip"><span className="admin-avatar">A</span><span>Quản trị viên<small>Toàn quyền hệ thống</small></span></div>
          <Link href="/">← <span>Quay lại cửa hàng</span></Link>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div><span className="admin-breadcrumb">BAPD / QUẢN TRỊ</span><h1>{sectionName}</h1></div>
          <div className="admin-topbar-right"><span className="admin-status"><i /> Hệ thống hoạt động</span><Link className="admin-store-link" href="/">Xem cửa hàng ↗</Link></div>
        </header>
        <div className="admin-content">
          <div className="admin-welcome"><div><span className="admin-eyebrow">BAPD STORE · ADMIN CONSOLE</span><h2>Trung tâm vận hành</h2><p>Quản lý nội dung và hoạt động cửa hàng tại một nơi.</p></div></div>
          <div className="admin-overview" aria-label="Tổng quan cửa hàng">
            <article className="admin-stat-card"><span className="admin-stat-icon">▦</span><div><p>Sản phẩm</p><strong>{products.length}</strong><small>Đang kinh doanh</small></div></article>
            <article className="admin-stat-card"><span className="admin-stat-icon admin-stat-icon-red">◇</span><div><p>Danh mục</p><strong>{categories.length}</strong><small>Nhóm sản phẩm</small></div></article>
            <article className="admin-stat-card"><span className="admin-stat-icon">▤</span><div><p>Đơn hàng</p><strong>{orders.length}</strong><small>Đơn lưu trên hệ thống</small></div></article>
            <article className="admin-stat-card"><span className="admin-stat-icon">%</span><div><p>Mã giảm giá</p><strong>{coupons.length}</strong><small>Chương trình khuyến mãi</small></div></article>
          </div>
          {error && <p className="admin-alert" role="alert">{error}</p>}
          {success && <p className="admin-success" role="status">{success}</p>}

          {section === "variants" && <div className="admin-panel"><ProductVariantsManager request={adminRequest} /></div>}

          {section === "categories" && <>
            <div className="admin-panel"><h2>{editingCategory ? "Sửa danh mục" : "Tạo danh mục mới"}</h2>
              <form className="admin-form" onSubmit={saveCategory}>
                <label>Tên danh mục<input required value={categoryForm.name} onChange={(event) => setCategoryForm({ ...categoryForm, name: event.target.value })} /></label>
                <label>Mô tả<input value={categoryForm.description} onChange={(event) => setCategoryForm({ ...categoryForm, description: event.target.value })} /></label>
                <div className="admin-actions wide"><button className="admin-button" disabled={busy}>{busy ? "Đang lưu..." : editingCategory ? "Lưu thay đổi" : "Tạo danh mục"}</button>
                  {editingCategory && <button type="button" onClick={() => { setEditingCategory(null); setCategoryForm({ name: "", description: "" }); }}>Hủy</button>}</div>
              </form>
            </div>
            <div className="admin-panel"><div className="admin-panel-heading"><div><h2>Danh sách danh mục</h2><p>Các nhóm sản phẩm trong cửa hàng.</p></div><span>{categories.length} mục</span></div>
              <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Tên</th><th>Mô tả</th><th>Thao tác</th></tr></thead>
                <tbody>{categories.map((category) => <tr key={category._id}><td><strong>{category.name}</strong></td><td>{category.description || "—"}</td>
                  <td><div className="admin-actions"><button onClick={() => { setEditingCategory(category._id); setCategoryForm({ name: category.name, description: category.description ?? "" }); }}>Sửa</button>
                    <button className="danger" onClick={() => void deleteEntry(`/admin/categories/${category._id}`, "danh mục")}>Xóa</button></div></td></tr>)}</tbody>
              </table></div>
            </div>
          </>}

          {section === "products" && <>
            <div className="admin-panel"><h2>{editingProduct ? "Sửa sản phẩm" : "Thêm sản phẩm"}</h2>
              <form className="admin-form" onSubmit={saveProduct}>
                <label>Tên sản phẩm<input required value={productForm.name} onChange={(event) => setProductForm({ ...productForm, name: event.target.value })} /></label>
                <label>Mã sản phẩm<input required value={productForm.code} onChange={(event) => setProductForm({ ...productForm, code: event.target.value })} /></label>
                <label>Danh mục<select required value={productForm.categoryId} onChange={(event) => setProductForm({ ...productForm, categoryId: event.target.value })}><option value="">Chọn danh mục</option>{categories.map((category) => <option key={category._id} value={category._id}>{category.name}</option>)}</select></label>
                <label>Màu sắc<input required value={productForm.color} onChange={(event) => setProductForm({ ...productForm, color: event.target.value })} /></label>
                <label>Giá (VND)<input required type="number" min="0" value={productForm.price} onChange={(event) => setProductForm({ ...productForm, price: event.target.value })} /></label>
                <label>Kích cỡ<input required placeholder="S, M, L, XL" value={productForm.sizes} onChange={(event) => setProductForm({ ...productForm, sizes: event.target.value })} /></label>
                <label className="wide">Tải ảnh lên (JPG, PNG, WEBP; tối đa 5MB)<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setImageFile(event.target.files?.[0] ?? null)} /></label>
                <label className="wide">Hoặc đường dẫn ảnh<input value={productForm.image} onChange={(event) => { setProductForm({ ...productForm, image: event.target.value }); setImageFile(null); }} /></label>
                <div className="admin-actions wide"><button className="admin-button" disabled={busy || !categories.length}>{busy ? "Đang lưu..." : editingProduct ? "Lưu thay đổi" : "Thêm sản phẩm"}</button>
                  {editingProduct && <button type="button" onClick={() => { setEditingProduct(null); setProductForm(blankProduct); setImageFile(null); }}>Hủy</button>}
                  {!categories.length && <span className="admin-muted">Tạo danh mục trước khi thêm sản phẩm.</span>}</div>
              </form>
            </div>
            <div className="admin-panel"><div className="admin-panel-heading"><div><h2>Danh sách sản phẩm</h2><p>Thông tin sản phẩm đang hiển thị trên cửa hàng.</p></div><span>{products.length} mục</span></div>
              <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Ảnh</th><th>Sản phẩm</th><th>Danh mục</th><th>Giá</th><th>Thao tác</th></tr></thead>
                <tbody>{products.map((product) => <tr key={product._id}><td><Image src={product.image} alt="" width={54} height={68} unoptimized /></td>
                  <td><strong>{product.name}</strong><br /><small>{product.code}</small></td><td><span className="admin-category-tag">{typeof product.category_id === "string" ? "—" : product.category_id.name}</span></td>
                  <td><strong>{formatPrice(product.price)}</strong></td><td><div className="admin-actions"><button onClick={() => editProduct(product)}>Sửa</button>
                    <button className="danger" onClick={() => void deleteEntry(`/admin/products/${product._id}`, "sản phẩm")}>Xóa</button></div></td></tr>)}</tbody>
              </table></div>
            </div>
          </>}

          {section === "orders" && <div className="admin-panel"><div className="admin-panel-heading"><div><h2>Quản lý đơn hàng</h2><p>Theo dõi khách mua, giá trị và cập nhật tiến độ đơn.</p></div><span>{orders.length} đơn</span></div>
            <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Mã đơn / ngày tạo</th><th>Khách hàng</th><th>Sản phẩm</th><th>Thanh toán</th><th>Tổng tiền</th><th>Trạng thái</th></tr></thead>
              <tbody>{orders.map((order) => <tr key={order._id}><td><strong>#{order._id.slice(-8).toUpperCase()}</strong><br /><small>{new Date(order.created_at).toLocaleString("vi-VN")}</small></td>
                <td><strong>{order.receiver_name}</strong><br /><small>{order.user_id?.email ?? order.receiver_phone}</small></td>
                <td>{order.items.length ? order.items.map((item) => `${item.product_name} · ${item.size} × ${item.quantity}`).join(", ") : "Không có chi tiết"}</td>
                <td>{order.payment_method}<br /><small>{order.payment_status}</small></td><td><strong>{formatPrice(order.final_amount)}</strong></td>
                <td><select className="admin-status-select" aria-label={`Trạng thái đơn ${order._id}`} value={order.order_status} onChange={(event) => void updateOrderStatus(order._id, event.target.value as AdminOrder["order_status"])}>
                  {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></td></tr>)}
                {!orders.length && <tr><td className="admin-empty" colSpan={6}>Chưa có đơn hàng nào được lưu trên hệ thống.</td></tr>}</tbody>
            </table></div>
          </div>}

          {section === "coupons" && <>
            <div className="admin-panel"><h2>{editingCoupon ? "Cập nhật mã giảm giá" : "Tạo mã giảm giá"}</h2>
              <form className="admin-form" onSubmit={saveCoupon}>
                <label>Mã giảm giá<input required value={couponForm.code} onChange={(event) => setCouponForm({ ...couponForm, code: event.target.value.toUpperCase() })} placeholder="VD: WELCOME10" /></label>
                <label>Loại ưu đãi<select value={couponForm.discount_type} onChange={(event) => setCouponForm({ ...couponForm, discount_type: event.target.value as "percent" | "fixed" })}><option value="percent">Phần trăm (%)</option><option value="fixed">Số tiền cố định (VND)</option></select></label>
                <label>Giá trị giảm<input required type="number" min="1" max={couponForm.discount_type === "percent" ? 100 : undefined} value={couponForm.discount_value} onChange={(event) => setCouponForm({ ...couponForm, discount_value: event.target.value })} /></label>
                <label>Đơn tối thiểu (VND)<input required type="number" min="0" value={couponForm.min_order_value} onChange={(event) => setCouponForm({ ...couponForm, min_order_value: event.target.value })} /></label>
                <label>Giảm tối đa (VND, tùy chọn)<input type="number" min="0" value={couponForm.max_discount} onChange={(event) => setCouponForm({ ...couponForm, max_discount: event.target.value })} /></label>
                <label>Lượt sử dụng tối đa<input required type="number" min="1" step="1" value={couponForm.usage_limit} onChange={(event) => setCouponForm({ ...couponForm, usage_limit: event.target.value })} /></label>
                <label>Bắt đầu<input required type="datetime-local" value={couponForm.start_date} onChange={(event) => setCouponForm({ ...couponForm, start_date: event.target.value })} /></label>
                <label>Kết thúc<input required type="datetime-local" value={couponForm.end_date} onChange={(event) => setCouponForm({ ...couponForm, end_date: event.target.value })} /></label>
                <label className="admin-coupon-toggle"><input type="checkbox" checked={couponForm.status} onChange={(event) => setCouponForm({ ...couponForm, status: event.target.checked })} /> Kích hoạt mã sau khi lưu</label>
                <div className="admin-actions wide"><button className="admin-button" disabled={busy}>{busy ? "Đang lưu..." : editingCoupon ? "Lưu thay đổi" : "Tạo mã"}</button>
                  {editingCoupon && <button type="button" onClick={() => { setEditingCoupon(null); setCouponForm(blankCoupon); }}>Hủy</button>}</div>
              </form>
            </div>
            <div className="admin-panel"><div className="admin-panel-heading"><div><h2>Chương trình ưu đãi</h2><p>Mã giảm giá và tình trạng sử dụng.</p></div><span>{coupons.length} mã</span></div>
              <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Mã</th><th>Mức giảm</th><th>Điều kiện</th><th>Đã dùng</th><th>Thời hạn</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
                <tbody>{coupons.map((coupon) => <tr key={coupon._id}><td><strong>{coupon.code}</strong></td>
                  <td>{coupon.discount_type === "percent" ? `${coupon.discount_value}%` : formatPrice(coupon.discount_value)}</td>
                  <td>Đơn từ {formatPrice(coupon.min_order_value)}{coupon.max_discount != null ? <><br /><small>Tối đa {formatPrice(coupon.max_discount)}</small></> : null}</td>
                  <td>{coupon.used_count}/{coupon.usage_limit}</td><td>{new Date(coupon.start_date).toLocaleDateString("vi-VN")} – {new Date(coupon.end_date).toLocaleDateString("vi-VN")}</td>
                  <td><span className={`admin-coupon-state ${coupon.status ? "enabled" : ""}`}>{coupon.status ? "Đang bật" : "Đã tắt"}</span></td>
                  <td><div className="admin-actions"><button onClick={() => editCoupon(coupon)}>Sửa</button><button className="danger" onClick={() => void deleteEntry(`/admin/coupons/${coupon._id}`, "mã giảm giá")}>Xóa</button></div></td></tr>)}
                  {!coupons.length && <tr><td className="admin-empty" colSpan={7}>Chưa có mã giảm giá nào.</td></tr>}</tbody>
              </table></div>
            </div>
          </>}
        </div>
      </main>
    </section>
  );
}
