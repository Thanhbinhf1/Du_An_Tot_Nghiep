"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import { resolveProductImage } from "@/lib/api";
import { bodyKeys, garmentKeys, garmentMeasurements, measurements, type SizeRow } from "@/lib/size-guide";
import type { AdminPaginatedRequest, AdminRequest } from "./ProductVariantsManager";

type OutfitItem = {
  _id: string;
  display_order: number;
  product_id?: {
    _id: string;
    name: string;
    slug: string;
  } | null;
};

type Outfit = {
  _id: string;
  title: string;
  description?: string;
  style?: string;
  occasion?: string;
  gallery?: string[];
  image: string;
  discount_type: "percent" | "fixed";
  discount_value: number;
  is_active: boolean;
  items: OutfitItem[];
};

type SizeRule = SizeRow & {
  _id: string;
  category_id?: {
    _id: string;
    name: string;
    slug: string;
  } | null;
  product_id?: { _id: string; name: string } | null;
  scope?: "product";
};

type SimpleProduct = {
  _id: string;
  name: string;
  slug: string;
};

type SimpleCategory = {
  _id: string;
  name: string;
  slug: string;
};

const blankOutfitForm = {
  title: "",
  description: "",
  style: "",
  occasion: "",
  galleryText: "",
  image: "",
  discount_type: "percent" as "percent" | "fixed",
  discount_value: 10,
  is_active: true,
  product_ids: [] as string[],
};

const blankSizeRuleForm: SizeRow & { category_id: string; product_id: string } = {
  category_id: "",
  product_id: "",
  size: "",
  fit_type: "Regular",
};

export default function AdminOutfits({ request, paginatedRequest, isAdmin }: { request: AdminRequest; paginatedRequest: AdminPaginatedRequest; isAdmin: boolean }) {
  const [activeSubTab, setActiveSubTab] = useState<"outfits" | "size">("outfits");
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [sizeRules, setSizeRules] = useState<SizeRule[]>([]);
  const [products, setProducts] = useState<SimpleProduct[]>([]);
  const [categories, setCategories] = useState<SimpleCategory[]>([]);

  const [outfitForm, setOutfitForm] = useState(blankOutfitForm);
  const [editingOutfitId, setEditingOutfitId] = useState<string | null>(null);

  const [editingSizeId, setEditingSizeId] = useState("");
  const [sizeForm, setSizeForm] = useState(blankSizeRuleForm);
  const [sizeScope, setSizeScope] = useState<"category" | "product">("category");

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadProducts = useCallback(async (signal?: AbortSignal) => {
    const products: SimpleProduct[] = [];
    let page = 1;
    let totalPages: number;
    do {
      const path = isAdmin ? "/products/admin" : "/products";
      const result = await paginatedRequest<SimpleProduct[]>(`${path}?limit=100&page=${page}`, { signal });
      products.push(...result.data);
      totalPages = result.pagination?.totalPages ?? 1;
      page += 1;
    } while (page <= totalPages);
    return products;
  }, [isAdmin, paginatedRequest]);

  const fetchData = useCallback((signal?: AbortSignal) =>
    Promise.all([
        request<Outfit[]>("/admin/outfits", { signal }),
        request<SizeRule[]>("/admin/size-recommendations", { signal }),
        loadProducts(signal),
        request<SimpleCategory[]>("/categories?all=true", { signal }),
    ]).then(([outfitData, sizeData, prodData, catData]) => {
      if (signal?.aborted) return;
      setOutfits(outfitData);
      setSizeRules(sizeData);
      setProducts(prodData);
      setCategories(catData);
      setSizeForm((prev) => prev.category_id || !catData[0] ? prev : { ...prev, category_id: catData[0]._id });
    }).catch((err: unknown) => {
      if (!signal?.aborted) setError(err instanceof Error ? err.message : "Không thể tải dữ liệu.");
    }).finally(() => { if (!signal?.aborted) setLoading(false); }),
  [loadProducts, request]);

  useEffect(() => {
    const controller = new AbortController();
    void fetchData(controller.signal);
    return () => controller.abort();
  }, [fetchData]);

  const handleSaveOutfit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await request(`/admin/outfits${editingOutfitId ? `/${editingOutfitId}` : ""}`, {
        method: editingOutfitId ? "PUT" : "POST",
        body: JSON.stringify({ ...outfitForm, gallery: [...new Set(outfitForm.galleryText.split("\n").map((line) => line.trim()).filter(Boolean))] }),
      });
      setSuccess(editingOutfitId ? "Đã cập nhật Lookbook Outfit." : "Đã tạo Outfit mới.");
      setOutfitForm(blankOutfitForm);
      setEditingOutfitId(null);
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lưu Outfit thất bại.");
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteOutfit = async (id: string) => {
    if (!window.confirm("Bạn chắc chắn muốn xóa bộ phối Outfit này?")) return;
    setBusy(true);
    setError("");
    try {
      await request(`/admin/outfits/${id}`, { method: "DELETE" });
      setSuccess("Đã xóa bộ phối Outfit.");
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể xóa Outfit.");
    } finally {
      setBusy(false);
    }
  };

  const handleSaveSizeRule = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await request(editingSizeId ? `/admin/size-recommendations/${editingSizeId}` : "/admin/size-recommendations", {
        method: editingSizeId ? "PUT" : "POST",
        body: JSON.stringify({ ...sizeForm, product_id: sizeScope === "product" ? sizeForm.product_id : "" }),
      });
      setSuccess(editingSizeId ? "Đã cập nhật quy tắc tư vấn size." : "Đã thêm quy tắc tư vấn size.");
      resetSizeForm();
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Thêm quy tắc thất bại.");
    } finally {
      setBusy(false);
    }
  };

  function resetSizeForm() {
    setEditingSizeId("");
    setSizeScope("category");
    setSizeForm({ ...blankSizeRuleForm, category_id: categories[0]?._id ?? "" });
  }

  const handleDeleteSizeRule = async (id: string) => {
    if (!window.confirm("Bạn chắc chắn muốn xóa quy tắc gợi ý size này?")) return;
    setBusy(true);
    setError("");
    try {
      await request(`/admin/size-recommendations/${id}`, { method: "DELETE" });
      setSuccess("Đã xóa quy tắc gợi ý size.");
      if (id === editingSizeId) resetSizeForm();
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể xóa quy tắc.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-outfits-page">
      <div className="admin-order-tabs" style={{ marginBottom: "20px" }}>
        <button
          type="button"
          className={`order-tab-btn ${activeSubTab === "outfits" ? "active" : ""}`}
          onClick={() => setActiveSubTab("outfits")}
        >
          ✨ Bộ phối đồ Lookbook (Mix & Match)
        </button>
        <button
          type="button"
          className={`order-tab-btn ${activeSubTab === "size" ? "active" : ""}`}
          onClick={() => setActiveSubTab("size")}
        >
          📏 Bảng quy tắc tư vấn size thông minh
        </button>
      </div>

      {error && <p className="admin-alert">{error}</p>}
      {success && <p className="admin-success">{success}</p>}

      {/* 1. OUTFIT LOOKBOOK TAB */}
      {activeSubTab === "outfits" && (
        <>
          <div className="admin-panel">
            <h2>{editingOutfitId ? "Cập nhật bộ phối Lookbook" : "Tạo bộ phối Lookbook mới"}</h2>
            <p className="admin-muted">
              Gợi ý bộ phối cho khách hàng. Giỏ hàng tính theo giá biến thể của từng món được chọn.
            </p>

            <form onSubmit={handleSaveOutfit} className="admin-form">
              <label>
                Tên bộ phối Lookbook
                <input
                  required
                  placeholder="VD: Set Năng Động Dạo Phố Mùa Hè"
                  value={outfitForm.title}
                  onChange={(e) => setOutfitForm({ ...outfitForm, title: e.target.value })}
                />
              </label>

              <label>
                Đường dẫn ảnh Lookbook (URL)
                <input
                  required
                  placeholder="https://... hoặc /uploads/..."
                  value={outfitForm.image}
                  onChange={(e) => setOutfitForm({ ...outfitForm, image: e.target.value })}
                />
              </label>

              <label>
                Mô tả phong cách
                <input
                  placeholder="VD: Phong cách trẻ trung, thoải mái kết hợp áo thun oversize và quần short kaki"
                  value={outfitForm.description}
                  onChange={(e) => setOutfitForm({ ...outfitForm, description: e.target.value })}
                />
              </label>

              <label>Phong cách dùng để lọc
                <input value={outfitForm.style} maxLength={60} onChange={(event) => setOutfitForm({ ...outfitForm, style: event.target.value })} placeholder="Ví dụ: Công sở" />
              </label>
              <label>Dịp mặc
                <input value={outfitForm.occasion} maxLength={160} onChange={(event) => setOutfitForm({ ...outfitForm, occasion: event.target.value })} />
              </label>
              <label className="wide">Ảnh phụ (mỗi URL một dòng)
                <textarea value={outfitForm.galleryText} rows={2} onChange={(event) => setOutfitForm({ ...outfitForm, galleryText: event.target.value })} />
              </label>

              <label>
                Giá trị ưu đãi bộ phối lưu nội bộ
                <input
                  type="number"
                  min="0"
                  max={outfitForm.discount_type === "percent" ? 100 : undefined}
                  required
                  value={outfitForm.discount_value}
                  onChange={(e) =>
                    setOutfitForm({ ...outfitForm, discount_value: Number(e.target.value) })
                  }
                />
              </label>

              <label>
                Loại ưu đãi lưu nội bộ
                <select value={outfitForm.discount_type} onChange={(event) => setOutfitForm({ ...outfitForm, discount_type: event.target.value as Outfit["discount_type"] })}>
                  <option value="percent">Phần trăm</option>
                  <option value="fixed">Số tiền</option>
                </select>
              </label>
              <label>
                <input type="checkbox" checked={outfitForm.is_active} onChange={(event) => setOutfitForm({ ...outfitForm, is_active: event.target.checked })} />
                Hiển thị bộ phối trên cửa hàng
              </label>
              <label className="wide">
                Chọn sản phẩm trong bộ phối:
                <div className="outfit-product-picker">
                  {products.map((p) => {
                    const checked = outfitForm.product_ids.includes(p._id);
                    return (
                      <label key={p._id} className="picker-checkbox-item">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const newIds = e.target.checked
                              ? [...outfitForm.product_ids, p._id]
                              : outfitForm.product_ids.filter((id) => id !== p._id);
                            setOutfitForm({ ...outfitForm, product_ids: newIds });
                          }}
                        />
                        <span>{p.name}</span>
                      </label>
                    );
                  })}
                </div>
              </label>

              <div className="admin-actions wide">
                <button type="submit" className="admin-button" disabled={busy}>
                  {busy ? "Đang lưu..." : editingOutfitId ? "Lưu thay đổi" : "Tạo Outfit"}
                </button>
                {editingOutfitId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingOutfitId(null);
                      setOutfitForm(blankOutfitForm);
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
                <h2>Danh sách các bộ phối Lookbook</h2>
                <p>Hiển thị trực quan trên trang /outfit và /mix-match của khách hàng.</p>
              </div>
              <span>{outfits.length} bộ phối</span>
            </div>

            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Ảnh</th>
                    <th>Tên bộ phối</th>
                    <th>Mô tả</th>
                    <th style={{ textAlign: "center" }}>Ưu đãi combo</th>
                    <th>Sản phẩm thành phần</th>
                    <th style={{ textAlign: "right" }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {outfits.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="admin-empty">
                        {loading ? "Đang tải outfits..." : "Chưa có bộ phối Lookbook nào."}
                      </td>
                    </tr>
                  ) : (
                    outfits.map((o) => (
                      <tr key={o._id}>
                        <td style={{ width: "70px" }}>
                          <Image
                            src={resolveProductImage(o.image)}
                            alt={o.title}
                            width={54}
                            height={72}
                            style={{ objectFit: "cover", borderRadius: "4px" }}
                            unoptimized
                          />
                        </td>
                        <td>
                          <strong>{o.title}</strong>
                        </td>
                        <td>{o.description || "—"}</td>
                        <td style={{ textAlign: "center" }}>
                          <span className="badge-highlight">-{o.discount_value.toLocaleString("vi-VN")}{o.discount_type === "percent" ? "%" : " ₫"}</span>
                        </td>
                        <td>
                          {o.items.map((it, idx) => (
                            <div key={idx} style={{ fontSize: "12px" }}>
                              • {it.product_id?.name ?? "Sản phẩm"}
                            </div>
                          ))}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <div className="admin-actions" style={{ justifyContent: "flex-end" }}>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingOutfitId(o._id);
                                setOutfitForm({
                                  title: o.title,
                                  image: o.image,
                                  description: o.description ?? "",
                                  style: o.style ?? "",
                                  occasion: o.occasion ?? "",
                                  galleryText: o.gallery?.join("\n") ?? "",
                                  discount_type: o.discount_type,
                                  discount_value: o.discount_value,
                                  is_active: o.is_active,
                                  product_ids: o.items
                                    .map((it) => it.product_id?._id)
                                    .filter(Boolean) as string[],
                                });
                              }}
                            >
                              Sửa
                            </button>
                            <button
                              type="button"
                              className="danger-btn"
                              onClick={() => void handleDeleteOutfit(o._id)}
                            >
                              Xóa
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* 2. SIZE RECOMMENDATION RULES TAB */}
      {activeSubTab === "size" && (
        <>
          <div className="admin-panel">
            <h2>{editingSizeId ? "Sửa quy tắc tư vấn size" : "Thêm quy tắc tư vấn size"}</h2>
            <p className="admin-muted">
              Nhập các khoảng số đo cơ thể dùng để tư vấn hoặc số đo thành phẩm dùng để tra bảng. Bảng riêng của sản phẩm được ưu tiên.
            </p>

            <form onSubmit={handleSaveSizeRule} className="admin-form">
              <label>Áp dụng cho
                <select value={sizeScope} disabled={Boolean(editingSizeId)}
                  onChange={(event) => setSizeScope(event.target.value as "category" | "product")}>
                  <option value="category">Danh mục</option>
                  <option value="product">Sản phẩm riêng</option>
                </select>
              </label>
              {sizeScope === "product" ? <label>Sản phẩm áp dụng
                <select required value={sizeForm.product_id} onChange={(event) => setSizeForm({ ...sizeForm, product_id: event.target.value })}>
                  <option value="">Chọn sản phẩm</option>
                  {products.map((product) => <option key={product._id} value={product._id}>{product.name}</option>)}
                </select>
              </label> : <label>
                Danh mục áp dụng
                <select
                  required
                  value={sizeForm.category_id}
                  onChange={(e) => setSizeForm({ ...sizeForm, category_id: e.target.value })}
                >
                  {categories.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>}

              <label>
                Kích cỡ (Size)
                <input required maxLength={32} value={sizeForm.size} onChange={(event) => setSizeForm({ ...sizeForm, size: event.target.value })} />
              </label>

              <label>
                Form dáng (Fit Type)
                <select
                  value={sizeForm.fit_type}
                  onChange={(e) =>
                    setSizeForm({ ...sizeForm, fit_type: e.target.value as SizeRule["fit_type"] })
                  }
                >
                  <option value="Regular">Vừa vặn tiêu chuẩn (Regular)</option>
                  <option value="Slim">Ôm dáng gọn gàng (Slim)</option>
                  <option value="Oversize">Rộng rãi thoải mái (Oversize)</option>
                </select>
              </label>
              <details className="wide" open>
                <summary>Số đo cơ thể</summary>
                <div className="admin-form">
                  {bodyKeys.flatMap((key) => (["min", "max"] as const).map((bound) => {
                    const field = `${bound}_${key}` as const;
                    const spec = measurements[key];
                    return <label key={field}>{spec.label} {bound === "min" ? "tối thiểu" : "tối đa"} ({spec.unit})
                      <input type="number" min={spec.min} max={spec.max} step="any" value={sizeForm[field] ?? ""}
                        onChange={(event) => setSizeForm({ ...sizeForm, [field]: event.target.value ? Number(event.target.value) : undefined })} />
                    </label>;
                  }))}
                </div>
              </details>
              <details className="wide">
                <summary>Số đo thành phẩm (cm)</summary>
                <div className="admin-form">
                  {garmentKeys.map((key) => <label key={key}>{garmentMeasurements[key]}
                    <input type="number" min="0.01" max="300" step="any" value={sizeForm.garment?.[key] ?? ""}
                      onChange={(event) => setSizeForm({ ...sizeForm, garment: {
                        ...sizeForm.garment, [key]: event.target.value ? Number(event.target.value) : undefined,
                      } })} />
                  </label>)}
                </div>
              </details>

              <div className="admin-actions wide">
                <button type="submit" className="admin-button" disabled={busy}>
                  {busy ? "Đang lưu..." : editingSizeId ? "Lưu quy tắc" : "Thêm quy tắc tư vấn"}
                </button>
                {editingSizeId && <button type="button" disabled={busy} onClick={resetSizeForm}>Hủy</button>}
              </div>
            </form>
          </div>

          <div className="admin-panel">
            <div className="admin-panel-heading">
              <div>
                <h2>Bảng quy tắc size đang cấu hình</h2>
                <p>Quy tắc theo từng sản phẩm hoặc danh mục.</p>
              </div>
              <span>{sizeRules.length} quy tắc</span>
            </div>

            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Áp dụng cho</th>
                    <th style={{ textAlign: "center" }}>Size</th>
                    <th>Khoảng chiều cao</th>
                    <th>Khoảng cân nặng</th>
                    <th>Form dáng</th>
                    <th style={{ textAlign: "right" }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {sizeRules.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="admin-empty">
                        Chưa có quy tắc size nào. Hãy thêm quy tắc để kích hoạt gợi ý thông minh.
                      </td>
                    </tr>
                  ) : (
                    sizeRules.map((r) => (
                      <tr key={r._id}>
                        <td>
                          <strong>{r.product_id?.name ?? r.category_id?.name ?? "Đã xóa khỏi danh mục"}</strong>
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <span className="spec-chip">{r.size}</span>
                        </td>
                        <td>
                          {r.min_height !== undefined && r.max_height !== undefined ? `${r.min_height}–${r.max_height} cm` : "—"}
                        </td>
                        <td>
                          {r.min_weight !== undefined && r.max_weight !== undefined ? `${r.min_weight}–${r.max_weight} kg` : "—"}
                        </td>
                        <td>
                          <span className="form-type-chip">{r.fit_type}</span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <button type="button" disabled={busy} onClick={() => {
                            const { category_id, product_id, scope, _id, ...rule } = r;
                            setEditingSizeId(_id);
                            setSizeScope(scope === "product" ? "product" : "category");
                            setSizeForm({ ...rule, category_id: category_id?._id ?? "", product_id: product_id?._id ?? "" });
                          }}>Sửa</button>
                          <button
                            type="button"
                            className="danger-btn"
                            disabled={busy}
                            onClick={() => void handleDeleteSizeRule(r._id)}
                          >
                            Xóa
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
