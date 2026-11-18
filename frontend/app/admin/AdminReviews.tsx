"use client";

import { useCallback, useEffect, useState } from "react";
import type { AdminRequest } from "./ProductVariantsManager";
import AdminReviewReports from "./AdminReviewReports";

type Review = {
  _id: string;
  product_key: string;
  user_name: string;
  user_email: string;
  rating: number;
  comment: string;
  createdAt: string;
};

export default function AdminReviews({ request }: { request: AdminRequest }) {
  const [showReports, setShowReports] = useState(false);
  return (
    <div className="admin-reviews-page">
      <div className="admin-review-report-actions" role="group" aria-label="Quản lý đánh giá">
        <button type="button" className={`admin-button${showReports ? " secondary-btn" : ""}`}
          aria-pressed={!showReports} onClick={() => setShowReports(false)}>Đánh giá sản phẩm</button>
        <button type="button" className={`admin-button${showReports ? "" : " secondary-btn"}`}
          aria-pressed={showReports} onClick={() => setShowReports(true)}>Báo cáo vi phạm</button>
      </div>
      {showReports ? <AdminReviewReports request={request} /> : <ReviewList request={request} />}
    </div>
  );
}

function ReviewList({ request }: { request: AdminRequest }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [starFilter, setStarFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fetchReviews = useCallback((signal?: AbortSignal) =>
    request<Review[]>("/admin/reviews", { signal })
      .then((data) => {
        if (signal?.aborted) return;
        setReviews(data);
        setError("");
      })
      .catch((cause: unknown) => {
        if (!signal?.aborted) setError(cause instanceof Error ? cause.message : "Không thể tải danh sách đánh giá.");
      })
      .finally(() => { if (!signal?.aborted) setLoading(false); }),
  [request]);

  useEffect(() => {
    const controller = new AbortController();
    void fetchReviews(controller.signal);
    return () => controller.abort();
  }, [fetchReviews]);

  const handleDeleteReview = async (id: string) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa/ẩn đánh giá này khỏi cửa hàng?")) return;
    setBusyId(id);
    setError("");
    setSuccess("");
    try {
      await request(`/admin/reviews/${id}`, { method: "DELETE" });
      setSuccess("Đã xóa đánh giá thành công.");
      setReviews((prev) => prev.filter((r) => r._id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể xóa đánh giá.");
    } finally {
      setBusyId("");
    }
  };

  const filteredReviews = reviews.filter((r) => {
    if (starFilter !== "all" && r.rating !== Number(starFilter)) return false;
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      const matchKey = r.product_key.toLowerCase().includes(q);
      const matchName = r.user_name.toLowerCase().includes(q);
      const matchEmail = r.user_email.toLowerCase().includes(q);
      const matchComment = r.comment.toLowerCase().includes(q);
      if (!matchKey && !matchName && !matchEmail && !matchComment) return false;
    }
    return true;
  });

  const renderStars = (rating: number) => {
    return (
      <span className="star-rating-render" style={{ color: "#f59e0b" }}>
        {"★".repeat(rating)}
        <span style={{ color: "#d1d5db" }}>{"☆".repeat(5 - rating)}</span>
      </span>
    );
  };

  return (
      <div className="admin-panel">
        <div className="admin-toolbar">
          <div>
            <h2>Quản lý đánh giá & Bình luận sản phẩm</h2>
            <p className="admin-muted">
              Kiểm duyệt phản hồi của khách hàng, đảm bảo môi trường mua sắm văn minh ({reviews.length} đánh giá).
            </p>
          </div>
          <button
            type="button"
            className="admin-button"
            onClick={() => { setLoading(true); void fetchReviews(); }}
            disabled={loading}
          >
            {loading ? "Đang tải..." : "🔄 Làm mới đánh giá"}
          </button>
        </div>

        {error && <p className="admin-alert">{error}</p>}
        {success && <p className="admin-success">{success}</p>}

        {/* FILTERS */}
        <div className="admin-filter-bar">
          <div className="admin-search-form">
            <input
              type="text"
              placeholder="Tìm theo sản phẩm, tên khách, nội dung..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="admin-search-input"
            />
            {search && (
              <button type="button" onClick={() => setSearch("")}>
                Xóa
              </button>
            )}
          </div>

          <div className="filter-select-group">
            <label>Số sao:</label>
            <select
              value={starFilter}
              onChange={(e) => setStarFilter(e.target.value)}
              className="admin-select"
            >
              <option value="all">Tất cả số sao</option>
              <option value="5">5 sao ★★★★★</option>
              <option value="4">4 sao ★★★★☆</option>
              <option value="3">3 sao ★★★☆☆</option>
              <option value="2">2 sao ★★☆☆☆</option>
              <option value="1">1 sao ★☆☆☆☆</option>
            </select>
          </div>
        </div>

        {/* REVIEWS TABLE */}
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Sản phẩm</th>
                <th>Khách hàng</th>
                <th style={{ textAlign: "center" }}>Số sao</th>
                <th>Nội dung đánh giá</th>
                <th>Ngày gửi</th>
                <th style={{ textAlign: "right" }}>Kiểm duyệt</th>
              </tr>
            </thead>
            <tbody>
              {filteredReviews.length === 0 ? (
                <tr>
                  <td colSpan={6} className="admin-empty">
                    {loading ? "Đang tải đánh giá..." : "Chưa có đánh giá nào phù hợp."}
                  </td>
                </tr>
              ) : (
                filteredReviews.map((r) => (
                  <tr key={r._id}>
                    <td>
                      <code>{r.product_key}</code>
                    </td>
                    <td>
                      <strong>{r.user_name}</strong>
                      <br />
                      <small className="admin-muted">{r.user_email}</small>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      {renderStars(r.rating)}
                      <br />
                      <small>({r.rating}/5)</small>
                    </td>
                    <td>
                      <p style={{ margin: 0, maxWidth: "360px", wordBreak: "break-word" }}>
                        {r.comment}
                      </p>
                    </td>
                    <td>
                      <small>{new Date(r.createdAt).toLocaleString("vi-VN")}</small>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        type="button"
                        className="danger-btn"
                        disabled={busyId === r._id}
                        onClick={() => void handleDeleteReview(r._id)}
                      >
                        {busyId === r._id ? "Đang xóa..." : "Xóa đánh giá"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
  );
}
