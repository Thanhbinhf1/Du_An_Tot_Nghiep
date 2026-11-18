"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { reviewReportReasons, type ReviewReportReason } from "@/lib/review-reports";
import type { AdminRequest } from "./ProductVariantsManager";

type ReviewReport = {
  _id: string;
  review_id: string;
  product_key: string;
  author_name: string;
  rating: number;
  comment: string;
  reason: ReviewReportReason;
  details: string;
  createdAt: string;
  status: "pending" | "dismissed" | "removed";
  current?: { comment: string; rating: number };
};

type ReportPage = { reports: ReviewReport[]; hasMore: boolean };

const statusLabels = { pending: "Chờ xử lý", dismissed: "Đã bỏ qua", removed: "Đã gỡ đánh giá" };

export default function AdminReviewReports({ request }: { request: AdminRequest }) {
  const [data, setData] = useState<ReportPage>();
  const [view, setView] = useState<"pending" | "history">("pending");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    request<ReportPage>(`/admin/review-reports?view=${view}&page=${page}`, { signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) setData(result); })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : "Không thể tải báo cáo.");
        }
      });
    return () => controller.abort();
  }, [page, request, revision, view]);

  function changeView(next: typeof view) {
    if (next === view) return;
    setData(undefined);
    setError("");
    setNotice("");
    setPage(1);
    setView(next);
  }

  async function moderate(report: ReviewReport, remove: boolean) {
    if (remove && !window.confirm("Gỡ đánh giá này khỏi trang sản phẩm?")) return;
    setBusyId(report._id);
    setError("");
    setNotice("");
    try {
      if (remove) {
        await request(`/admin/reviews/${report.review_id}`, { method: "DELETE" });
        setNotice("Đã gỡ đánh giá. Các báo cáo liên quan đã chuyển vào lịch sử.");
      } else {
        await request(`/admin/review-reports/${report._id}/dismiss`, { method: "PATCH" });
        setNotice("Đã bỏ qua báo cáo.");
      }
      setData(undefined);
      setRevision((current) => current + 1);
      if (page > 1 && data?.reports.every((item) => remove ? item.review_id === report.review_id : item._id === report._id)) {
        setPage(page - 1);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể xử lý báo cáo.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <section className="admin-panel" aria-labelledby="review-reports-title">
      <div className="admin-toolbar">
        <h2 id="review-reports-title">Báo cáo đánh giá vi phạm</h2>
        <button type="button" className="admin-button secondary-btn" disabled={Boolean(busyId)}
          onClick={() => { setData(undefined); setError(""); setRevision((current) => current + 1); }}>
          Làm mới
        </button>
      </div>
      <div className="admin-review-report-actions" role="group" aria-label="Trạng thái báo cáo">
        <button type="button" className={`admin-button${view === "pending" ? "" : " secondary-btn"}`}
          aria-pressed={view === "pending"} disabled={Boolean(busyId)} onClick={() => changeView("pending")}>Chờ xử lý</button>
        <button type="button" className={`admin-button${view === "history" ? "" : " secondary-btn"}`}
          aria-pressed={view === "history"} disabled={Boolean(busyId)} onClick={() => changeView("history")}>Lịch sử xử lý</button>
      </div>
      {error && <p className="admin-alert" role="alert">{error}</p>}
      {notice && <p className="admin-success" role="status">{notice}</p>}
      {!data ? !error && <p className="admin-muted" role="status">Đang tải báo cáo…</p> : data.reports.length === 0 ? (
        <p className="admin-empty">Chưa có báo cáo {view === "pending" ? "chờ xử lý" : "đã xử lý"}.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>Đánh giá được báo cáo</th><th>Lý do báo cáo</th><th>Ngày gửi</th><th>Xử lý</th></tr>
            </thead>
            <tbody>
              {data.reports.map((report) => (
                <tr key={report._id}>
                  <td className="admin-review-report-copy">
                    <strong>{report.author_name} · {report.rating}/5 sao</strong>
                    {/^[a-f\d]{24}$/i.test(report.product_key) && (
                      <Link href={`/product/${report.product_key}#product-reviews`}>Mở trang sản phẩm</Link>
                    )}
                    <p>{report.comment}</p>
                    {report.current && (report.current.comment !== report.comment || report.current.rating !== report.rating) && (
                      <div><small>Đánh giá hiện tại · {report.current.rating}/5 sao</small><p>{report.current.comment}</p></div>
                    )}
                  </td>
                  <td className="admin-review-report-copy"><strong>{reviewReportReasons[report.reason]}</strong>{report.details && <p>{report.details}</p>}</td>
                  <td><time dateTime={report.createdAt}>{new Date(report.createdAt).toLocaleString("vi-VN")}</time></td>
                  <td>
                    {report.status === "pending" ? (
                      <div className="admin-review-report-actions">
                        <button type="button" className="danger-btn" disabled={Boolean(busyId)} onClick={() => void moderate(report, true)}>Gỡ đánh giá</button>
                        <button type="button" className="admin-button secondary-btn" disabled={Boolean(busyId)} onClick={() => void moderate(report, false)}>Bỏ qua</button>
                      </div>
                    ) : statusLabels[report.status]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {(page > 1 || data?.hasMore) && (
        <div className="admin-review-report-actions" aria-label="Chuyển trang báo cáo">
          <button type="button" className="admin-button secondary-btn" disabled={page <= 1 || Boolean(busyId)}
            onClick={() => { setData(undefined); setError(""); setPage(page - 1); }}>Trang trước</button>
          <span>Trang {page}</span>
          <button type="button" className="admin-button secondary-btn" disabled={!data?.hasMore || Boolean(busyId)}
            onClick={() => { setData(undefined); setError(""); setPage(page + 1); }}>Trang sau</button>
        </div>
      )}
    </section>
  );
}
