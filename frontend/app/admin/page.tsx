"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { API_BASE_URL, authenticatedHeaders, readApiResponse } from "@/lib/api";
import { signOutDemo, useDemoAuth } from "@/lib/demo-auth";
import type { Product } from "@/types/product";
import "./admin.css";

type Category = { _id: string; name: string; slug: string; description?: string };
type StoredProduct = Omit<Product, "id" | "category"> & {
  _id: string;
  category_id: string | { _id: string; name: string };
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

export default function AdminPage() {
  const router = useRouter();
  const { isLoggedIn, role, token, isHydrated } = useDemoAuth();
  const [verified, setVerified] = useState(false);
  const [section, setSection] = useState<"products" | "categories">("products");
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<StoredProduct[]>([]);
  const [productForm, setProductForm] = useState(blankProduct);
  const [categoryForm, setCategoryForm] = useState({ name: "", description: "" });
  const [editingProduct, setEditingProduct] = useState<string | null>(null);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
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
        const [categoryData, productData] = await Promise.all([
          fetch(`${API_BASE_URL}/catalog/categories`).then(readApiResponse<Category[]>),
          fetch(`${API_BASE_URL}/catalog/products`).then(readApiResponse<StoredProduct[]>),
        ]);
        if (active) {
          setCategories(categoryData);
          setProducts(productData);
          setError("");
        }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Không thể tải dữ liệu quản trị.");
      }
    };
    void loadData();
    return () => { active = false; };
  }, [role, token, verified]);

  async function refreshData() {
    const [categoryData, productData] = await Promise.all([
      fetch(`${API_BASE_URL}/catalog/categories`).then(readApiResponse<Category[]>),
      fetch(`${API_BASE_URL}/catalog/products`).then(readApiResponse<StoredProduct[]>),
    ]);
    setCategories(categoryData);
    setProducts(productData);
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

  return (
    <section className="admin-page">
      <div className="admin-heading">
        <div>
          <h1>Quản trị cửa hàng</h1>
          <p>Quản lý sản phẩm và danh mục của cửa hàng.</p>
        </div>
        <Link className="admin-button" href="/">Về cửa hàng</Link>
      </div>
      <div className="admin-tabs">
        <button className={section === "products" ? "active" : ""} onClick={() => setSection("products")}>Sản phẩm ({products.length})</button>
        <button className={section === "categories" ? "active" : ""} onClick={() => setSection("categories")}>Danh mục ({categories.length})</button>
      </div>
      {error && <p className="admin-alert" role="alert">{error}</p>}
      {success && <p className="admin-success" role="status">{success}</p>}

      {section === "categories" ? (
        <>
          <div className="admin-panel">
            <h2>{editingCategory ? "Sửa danh mục" : "Tạo danh mục mới"}</h2>
            <form className="admin-form" onSubmit={saveCategory}>
              <label>Tên danh mục<input required value={categoryForm.name} onChange={(event) => setCategoryForm({ ...categoryForm, name: event.target.value })} /></label>
              <label>Mô tả<input value={categoryForm.description} onChange={(event) => setCategoryForm({ ...categoryForm, description: event.target.value })} /></label>
              <div className="admin-actions wide">
                <button className="admin-button" disabled={busy}>{busy ? "Đang lưu..." : editingCategory ? "Lưu thay đổi" : "Tạo danh mục"}</button>
                {editingCategory && <button type="button" onClick={() => { setEditingCategory(null); setCategoryForm({ name: "", description: "" }); }}>Hủy</button>}
              </div>
            </form>
          </div>
          <div className="admin-panel">
            <table className="admin-table">
              <thead><tr><th>Tên</th><th>Đường dẫn</th><th>Mô tả</th><th>Thao tác</th></tr></thead>
              <tbody>{categories.map((category) => (
                <tr key={category._id}>
                  <td>{category.name}</td><td>/categories/{category.slug}</td><td>{category.description}</td>
                  <td><div className="admin-actions">
                    <button onClick={() => { setEditingCategory(category._id); setCategoryForm({ name: category.name, description: category.description ?? "" }); }}>Sửa</button>
                    <button className="danger" onClick={() => void deleteEntry(`/admin/categories/${category._id}`, "danh mục")}>Xóa</button>
                  </div></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          <div className="admin-panel">
            <h2>{editingProduct ? "Sửa sản phẩm" : "Thêm sản phẩm"}</h2>
            <form className="admin-form" onSubmit={saveProduct}>
              <label>Tên sản phẩm<input required value={productForm.name} onChange={(event) => setProductForm({ ...productForm, name: event.target.value })} /></label>
              <label>Mã sản phẩm<input required value={productForm.code} onChange={(event) => setProductForm({ ...productForm, code: event.target.value })} /></label>
              <label>Danh mục<select required value={productForm.categoryId} onChange={(event) => setProductForm({ ...productForm, categoryId: event.target.value })}><option value="">Chọn danh mục</option>{categories.map((category) => <option key={category._id} value={category._id}>{category.name}</option>)}</select></label>
              <label>Màu sắc<input required value={productForm.color} onChange={(event) => setProductForm({ ...productForm, color: event.target.value })} /></label>
              <label>Giá (VND)<input required type="number" min="0" value={productForm.price} onChange={(event) => setProductForm({ ...productForm, price: event.target.value })} /></label>
              <label>Kích cỡ (phân cách bằng dấu phẩy)<input required placeholder="S, M, L, XL" value={productForm.sizes} onChange={(event) => setProductForm({ ...productForm, sizes: event.target.value })} /></label>
              <label className="wide">Tải ảnh lên (JPG, PNG, WEBP; tối đa 5MB)<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setImageFile(event.target.files?.[0] ?? null)} /></label>
              <label className="wide">Hoặc đường dẫn ảnh<input value={productForm.image} onChange={(event) => { setProductForm({ ...productForm, image: event.target.value }); setImageFile(null); }} /></label>
              <div className="admin-actions wide">
                <button className="admin-button" disabled={busy || !categories.length}>{busy ? "Đang lưu..." : editingProduct ? "Lưu thay đổi" : "Thêm sản phẩm"}</button>
                {editingProduct && <button type="button" onClick={() => { setEditingProduct(null); setProductForm(blankProduct); setImageFile(null); }}>Hủy</button>}
                {!categories.length && <span className="admin-muted">Tạo danh mục trước khi thêm sản phẩm.</span>}
              </div>
            </form>
          </div>
          <div className="admin-panel">
            <table className="admin-table">
              <thead><tr><th>Ảnh</th><th>Sản phẩm</th><th>Danh mục</th><th>Giá</th><th>Thao tác</th></tr></thead>
              <tbody>{products.map((product) => (
                <tr key={product._id}>
                  <td><Image src={product.image} alt="" width={54} height={68} unoptimized /></td>
                  <td>{product.name}<br /><small>{product.code}</small></td>
                  <td>{typeof product.category_id === "string" ? "—" : product.category_id.name}</td>
                  <td>{new Intl.NumberFormat("vi-VN").format(product.price)} VND</td>
                  <td><div className="admin-actions">
                    <button onClick={() => editProduct(product)}>Sửa</button>
                    <button className="danger" onClick={() => void deleteEntry(`/admin/products/${product._id}`, "sản phẩm")}>Xóa</button>
                  </div></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
