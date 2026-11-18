"use client";

import { useEffect, useState } from "react";
import type { AdminPaginatedRequest, AdminRequest } from "./ProductVariantsManager";

type InventoryVariant = {
  _id: string;
  sku: string;
  size: string;
  color: string;
  price: number;
  sale_price: number | null;
  stock_quantity: number;
  status: boolean;
  product_id?: {
    _id: string;
    name: string;
    slug: string;
    status: boolean;
  } | null;
};

export default function AdminInventory({ request, paginatedRequest }: { request: AdminRequest; paginatedRequest: AdminPaginatedRequest }) {
  const [variants, setVariants] = useState<InventoryVariant[]>([]);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [editingStock, setEditingStock] = useState<Record<string, number>>({});
  const [updatingId, setUpdatingId] = useState("");
  const [loadedKey, setLoadedKey] = useState("");
  const url = `/admin/inventory?page=${page}&limit=20&low_stock=${lowStockOnly}&search=${encodeURIComponent(query)}`;
  const loadKey = `${url}:${refresh}`;
  const loading = loadKey !== loadedKey;
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const formatPrice = (val: number) =>
    `${new Intl.NumberFormat("vi-VN").format(val)} đ`;

  useEffect(() => {
    const controller = new AbortController();
    paginatedRequest<InventoryVariant[]>(url, { signal: controller.signal })
      .then(({ data, pagination }) => {
        if (controller.signal.aborted) return;
        setVariants(data);
        setTotalPages(pagination?.totalPages || 1);
        setTotalCount(pagination?.total ?? data.length);
        setEditingStock(Object.fromEntries(data.map((item) => [item._id, item.stock_quantity])));
        setError("");
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) {
          setVariants([]);
          setError(err instanceof Error ? err.message : "Không thể tải danh sách tồn kho.");
        }
      })
      .finally(() => { if (!controller.signal.aborted) setLoadedKey(loadKey); });
    return () => controller.abort();
  }, [loadKey, paginatedRequest, url]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setQuery(search.trim());
    setRefresh((value) => value + 1);
  };

  const handleStockChange = (id: string, value: number) => {
    setEditingStock((prev) => ({
      ...prev,
      [id]: Math.max(0, Math.floor(value)),
    }));
  };

  const handleSaveStock = async (id: string) => {
    const newStock = editingStock[id];
    if (newStock === undefined || newStock < 0) return;
    setUpdatingId(id);
    setError("");
    setSuccess("");
    try {
      await request(`/admin/inventory/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ stock_quantity: newStock }),
      });
      setSuccess("Đã cập nhật tồn kho thành công.");
      setVariants((prev) =>
        prev.map((v) => (v._id === id ? { ...v, stock_quantity: newStock } : v)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cập nhật thất bại.");
    } finally {
      setUpdatingId("");
    }
  };

  return (
    <div className="admin-inventory-page">
      <div className="admin-panel">
        <div className="admin-toolbar">
          <div>
            <h2>Quản lý kho hàng & Biến thể</h2>
            <p className="admin-muted">
              Theo dõi và điều chỉnh số lượng tồn kho theo SKU, Size, Màu sắc ({totalCount} biến thể).
            </p>
          </div>
          <button
            type="button"
            className="admin-button"
            onClick={() => setRefresh((value) => value + 1)}
            disabled={loading}
          >
            {loading ? "Đang tải..." : "🔄 Làm mới kho"}
          </button>
        </div>

        {error && <p className="admin-alert">{error}</p>}
        {success && <p className="admin-success">{success}</p>}

        {/* Filters bar */}
        <div className="admin-filter-bar">
          <form onSubmit={handleSearchSubmit} className="admin-search-form">
            <input
              type="text"
              placeholder="Tìm kiếm theo mã SKU..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="admin-search-input"
            />
            <button type="submit" className="admin-button secondary-btn">
              Tìm kiếm
            </button>
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setPage(1);
                  setQuery("");
                }}
              >
                Xóa tìm
              </button>
            )}
          </form>

          <label className="admin-checkbox-label">
            <input
              type="checkbox"
              checked={lowStockOnly}
              onChange={(e) => {
                setLowStockOnly(e.target.checked);
                setPage(1);
              }}
            />
            <strong>⚠️ Chỉ lọc sản phẩm sắp hết hàng (Tồn kho ≤ 10)</strong>
          </label>
        </div>

        {/* Table */}
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Mã SKU</th>
                <th>Tên sản phẩm</th>
                <th>Kích cỡ</th>
                <th>Màu sắc</th>
                <th style={{ textAlign: "right" }}>Giá bán</th>
                <th style={{ textAlign: "center" }}>Tình trạng</th>
                <th style={{ textAlign: "center", width: "180px" }}>Tồn kho thực tế</th>
                <th style={{ textAlign: "right" }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {variants.length === 0 ? (
                <tr>
                  <td colSpan={8} className="admin-empty">
                    {loading ? "Đang tải dữ liệu kho..." : "Không tìm thấy biến thể nào phù hợp."}
                  </td>
                </tr>
              ) : (
                variants.map((v) => {
                  const currentVal = editingStock[v._id] ?? v.stock_quantity;
                  const isDirty = currentVal !== v.stock_quantity;
                  const isBusy = updatingId === v._id;

                  let stockTagClass = "in-stock";
                  let stockTagText = "Còn hàng";
                  if (v.stock_quantity === 0) {
                    stockTagClass = "out-of-stock";
                    stockTagText = "Hết hàng";
                  } else if (v.stock_quantity <= 10) {
                    stockTagClass = "low-stock";
                    stockTagText = "Sắp hết";
                  }

                  return (
                    <tr key={v._id}>
                      <td>
                        <code>{v.sku}</code>
                      </td>
                      <td>
                        <strong>{v.product_id?.name ?? "Sản phẩm không xác định"}</strong>
                      </td>
                      <td>
                        <span className="spec-chip">{v.size}</span>
                      </td>
                      <td>
                        <span className="spec-chip">{v.color}</span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {v.sale_price ? (
                          <>
                            <strong>{formatPrice(v.sale_price)}</strong>
                            <br />
                            <small style={{ textDecoration: "line-through", color: "#9ca3af" }}>
                              {formatPrice(v.price)}
                            </small>
                          </>
                        ) : (
                          <strong>{formatPrice(v.price)}</strong>
                        )}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span className={`stock-badge ${stockTagClass}`}>{stockTagText}</span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <div className="quick-stock-editor">
                          <button
                            type="button"
                            onClick={() => handleStockChange(v._id, currentVal - 1)}
                            disabled={currentVal <= 0 || isBusy}
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min="0"
                            value={currentVal}
                            onChange={(e) => handleStockChange(v._id, Number(e.target.value))}
                            disabled={isBusy}
                          />
                          <button
                            type="button"
                            onClick={() => handleStockChange(v._id, currentVal + 1)}
                            disabled={isBusy}
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {isDirty ? (
                          <button
                            type="button"
                            className="admin-button save-stock-btn"
                            disabled={isBusy}
                            onClick={() => void handleSaveStock(v._id)}
                          >
                            {isBusy ? "Lưu..." : "Lưu tồn"}
                          </button>
                        ) : (
                          <span className="admin-muted" style={{ fontSize: "12px" }}>
                            Đồng bộ
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="admin-pagination">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              ← Trang trước
            </button>
            <span>
              Trang {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Trang sau →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
