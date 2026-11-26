"use client";

import { useCallback, useEffect, useState } from "react";
import type { AdminRequest, AdminPaginatedRequest } from "./ProductVariantsManager";
import type { ApiPagination } from "@/lib/api";
import AdminPagination, { adminListPath } from "./AdminPagination";
import AdminReviewReports from "./AdminReviewReports";
import BlockedWordsManager from "./BlockedWordsManager";

type Review = {
  _id: string;
  product_key: string;
  user_name: string;
  user_email: string;
  rating: number;
  comment: string;
  public_comment: string;
  mask_all: boolean;
  createdAt: string;
};

export default function AdminReviews({ request, paginatedRequest, isAdmin }: { request: AdminRequest; paginatedRequest: AdminPaginatedRequest; isAdmin: boolean }) {
  const [showReports, setShowReports] = useState(false);
  const [showWords, setShowWords] = useState(false);
  return (
    <div className="admin-reviews-page">
      <div className="admin-review-report-actions" role="group" aria-label="Quản lý đánh giá">
        <button type="button" className={`admin-button${showReports ? " secondary-btn" : ""}`}
          aria-pressed={!showReports && !showWords} onClick={() => { setShowReports(false); setShowWords(false); }}>Đánh giá sản phẩm</button>
        <button type="button" className={`admin-button${showReports ? "" : " secondary-btn"}`}
          aria-pressed={showReports} onClick={() => { setShowReports(true); setShowWords(false); }}>Báo cáo vi phạm</button>
        <button type="button" className="admin-button secondary-btn" aria-pressed={showWords} onClick={() => { setShowWords(true); setShowReports(false); }}>Từ cấm và che nội dung</button>
      </div>
      {showWords ? <BlockedWordsManager request={request} isAdmin={isAdmin} /> : showReports ? <AdminReviewReports request={request} /> : <ReviewList request={request} paginatedRequest={paginatedRequest} />}
    </div>
  );
}

function ReviewList({ request, paginatedRequest }: { request: AdminRequest; paginatedRequest: AdminPaginatedRequest }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [revision, setRevision] = useState(0);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<ApiPagination>();
  const [starFilter, setStarFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fetchReviews = useCallback((signal: AbortSignal) =>
    paginatedRequest<Review[]>(adminListPath("/admin/reviews", { page, limit: 25, search: search.trim(), rating: starFilter }), { signal })
      .then(({ data, pagination }) => {
        if (signal?.aborted) return;
        setReviews(data);
        setPagination(pagination);
        if (!data.length && page > 1) setPage(page - 1);
        setError("");
      })
      .catch((cause: unknown) => {
        if (!signal?.aborted) setError(cause instanceof Error ? cause.message : "Không thể tải danh sách đánh giá.");
      })
      .finally(() => { if (!signal?.aborted) setLoading(false); }),
  [paginatedRequest, page, search, starFilter]);

  useEffect(() => {
    const controller = new AbortController();
    void fetchReviews(controller.signal);
    return () => controller.abort();
  }, [fetchReviews, revision]);

  const handleModerateReview = async (review: Review) => {
    const id = review._id;
    if (!window.confirm(review.mask_all ? "Bỏ che toàn bộ nội dung? Từ cấm vẫn được tự động che." : "Che toàn bộ phần chữ bằng dấu *? Số sao và đánh giá vẫn được giữ.")) return;
    setBusyId(id);
    setError("");
    setSuccess("");
    try {
      await request(`/admin/reviews/${id}/moderation`, { method: "PATCH", body: JSON.stringify({ mask_all: !review.mask_all }) });
      setSuccess("Đã cập nhật cách hiển thị; giữ nguyên đánh giá và số sao.");
      setLoading(true); setRevision((value) => value + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể kiểm duyệt đánh giá.");
    } finally {
      setBusyId("");
    }
  };

  const filteredReviews = reviews;

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
              Kiểm duyệt phản hồi của khách hàng, đảm bảo môi trường mua sắm văn minh ({pagination?.total ?? 0} đánh giá).
            </p>
          </div>
          <button
            type="button"
            className="admin-button"
            onClick={() => { setLoading(true); setRevision((value) => value + 1); }}
            disabled={loading}
          >
            {loading ? "Đang tải..." : "🔄 Làm mới đánh giá"}
          </button>
        </div>
        <p className="admin-muted">Từ cấm được tự che bằng dấu * trên cửa hàng, kể cả đánh giá cũ. Nội dung gốc chỉ để nhân viên đối chiếu. Không xóa đánh giá hoặc thay đổi số sao vì phản hồi tiêu cực.</p>

        {error && <p className="admin-alert">{error}</p>}
        {success && <p className="admin-success">{success}</p>}

        {/* FILTERS */}
        <div className="admin-filter-bar">
          <div className="admin-search-form">
            <input
              type="text"
              placeholder="Tìm theo sản phẩm, tên khách, nội dung..."
              value={search}
              maxLength={100}
              onChange={(e) => { setSearch(e.target.value); setPage(1); setLoading(true); }}
              className="admin-search-input"
            />
            {search && (
              <button type="button" onClick={() => { setSearch(""); setPage(1); setLoading(true); }}>
                Xóa
              </button>
            )}
          </div>

          <div className="filter-select-group">
            <label>Số sao:</label>
            <select
              value={starFilter}
              onChange={(e) => { setStarFilter(e.target.value); setPage(1); setLoading(true); }}
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
                      <small className="admin-muted">Hiển thị với khách: {r.public_comment}</small>
                    </td>
                    <td>
                      <small>{new Date(r.createdAt).toLocaleString("vi-VN")}</small>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        type="button"
                        className="danger-btn"
                        disabled={busyId === r._id}
                        onClick={() => void handleModerateReview(r)}
                      >
                        {busyId === r._id ? "Đang lưu..." : r.mask_all ? "Bỏ che toàn bộ" : "Che nội dung vi phạm"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <AdminPagination page={page} pagination={pagination} loading={loading} onPage={(value) => { setPage(value); setLoading(true); }} />
      </div>
  );
}
