"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { API_BASE_URL, authenticatedHeaders, readApiResponse, resolveProductImage } from "@/lib/api";
import { useDemoAuth } from "@/lib/demo-auth";
import { reviewReportReasons } from "@/lib/review-reports";

type ProductComment = {
  _id: string;
  user_name: string;
  rating: number;
  comment: string;
  createdAt: string;
  images?: string[];
};

type ProductReviewResponse = {
  comments: ProductComment[];
  averageRating: number;
  total: number;
};

type ReviewEligibility = { canReview: boolean; ownReview: Pick<ProductComment, "_id" | "rating" | "comment"> | null };

// Tách URL ảnh đính kèm trong nội dung nhận xét (nếu có dạng [img:url])
function parseCommentWithImages(rawComment: string): { text: string; images: string[] } {
  const images: string[] = [];
  const text = rawComment
    .replace(/\[img:(https?:\/\/[^\]]+|\/[^\]]+)\]/gi, (_match, url: string) => {
      images.push(url.trim());
      return "";
    })
    .trim();
  return { text, images };
}

export default function ProductReviews({ productId }: { productId: string }) {
  const { token } = useDemoAuth();
  return <ReviewSection key={`${productId}:${token}`} productId={productId} token={token} />;
}

function ReviewSection({ productId, token }: { productId: string; token: string }) {
  const reviewUrl = `${API_BASE_URL}/reviews/${encodeURIComponent(productId)}`;
  const loginUrl = `/dang-nhap?returnTo=${encodeURIComponent(`/product/${productId}#product-reviews`)}`;
  const [reviews, setReviews] = useState<ProductReviewResponse>({
    comments: [],
    averageRating: 0,
    total: 0,
  });
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [imageUrlInput, setImageUrlInput] = useState("");
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [starFilter, setStarFilter] = useState<number | "all">("all");
  const [previewImage, setPreviewImage] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [listError, setListError] = useState("");
  const [savedMessage, setSavedMessage] = useState("");
  const [eligibility, setEligibility] = useState<ReviewEligibility>();
  const [eligibilityError, setEligibilityError] = useState("");
  const [reportId, setReportId] = useState("");
  const [reported, setReported] = useState<string[]>([]);
  const [reportError, setReportError] = useState("");
  const [reporting, setReporting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch(reviewUrl, {
      signal: controller.signal,
    })
      .then(readApiResponse<ProductReviewResponse>)
      .then((data) => { if (!controller.signal.aborted) setReviews(data); })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setListError(cause instanceof Error ? cause.message : "Không thể tải đánh giá.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [reviewUrl]);

  useEffect(() => {
    if (window.location.hash === "#product-reviews") {
      const section = document.getElementById("product-reviews");
      section?.focus({ preventScroll: true });
      section?.scrollIntoView({ behavior: "instant" });
    }
  }, [productId]);

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    fetch(`${reviewUrl}/eligibility`, {
      headers: authenticatedHeaders(token), signal: controller.signal, cache: "no-store",
    })
      .then(readApiResponse<ReviewEligibility>)
      .then((data) => {
        if (controller.signal.aborted) return;
        setEligibility(data);
        if (data.canReview && data.ownReview) {
          const parsed = parseCommentWithImages(data.ownReview.comment);
          setRating(data.ownReview.rating);
          setComment(parsed.text);
          setAttachedImages(parsed.images);
        }
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setEligibilityError(cause instanceof Error ? cause.message : "Không thể kiểm tra đơn hàng.");
        }
      });
    return () => controller.abort();
  }, [reviewUrl, token]);

  function handleAddImageUrl() {
    const trimmed = imageUrlInput.trim();
    if (!trimmed) return;
    if (!/^(?:https?:\/\/[^\s\[\]]+|\/(?![\\/])[^\s\[\]]+)$/i.test(trimmed)) {
      setError("Đường dẫn hình ảnh phải bắt đầu bằng http://, https:// hoặc /");
      return;
    }
    if (attachedImages.length >= 3) {
      setError("Tối đa đính kèm 3 hình ảnh cho mỗi đánh giá.");
      return;
    }
    setError("");
    setAttachedImages((prev) => [...prev, trimmed]);
    setImageUrlInput("");
  }

  async function handleUploadFiles(files: FileList | null) {
    if (!files || files.length === 0 || !token) return;
    const remaining = 3 - attachedImages.length;
    if (remaining <= 0) {
      setError("Tối đa đính kèm 3 hình ảnh cho mỗi đánh giá.");
      return;
    }
    const chosen = Array.from(files).slice(0, remaining);
    setError("");
    setUploadingImage(true);
    try {
      const uploadedUrls: string[] = [];
      for (const file of chosen) {
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
          throw new Error("Chỉ chấp nhận ảnh JPG, PNG hoặc WebP.");
        }
        if (file.size > 5 * 1024 * 1024) {
          throw new Error("Mỗi ảnh tải lên không được vượt quá 5 MB.");
        }
        const formData = new FormData();
        formData.append("image", file);
        const response = await fetch(`${API_BASE_URL}/reviews/upload-image`, {
          method: "POST",
          headers: authenticatedHeaders(token),
          body: formData,
        });
        const data = await readApiResponse<{ url: string }>(response);
        if (data?.url) uploadedUrls.push(data.url);
      }
      if (uploadedUrls.length > 0) {
        setAttachedImages((prev) => [...prev, ...uploadedUrls].slice(0, 3));
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể tải ảnh đánh giá lên.");
    } finally {
      setUploadingImage(false);
    }
  }

  async function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSavedMessage("");
    const imageTags = attachedImages.map((url) => `[img:${url}]`).join(" ");
    const fullComment = imageTags ? `${comment.trim()}\n${imageTags}` : comment.trim();
    if (fullComment.length > 1000) {
      setError("Nhận xét và đường dẫn ảnh vượt quá 1.000 ký tự. Hãy rút gọn trước khi gửi.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(reviewUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authenticatedHeaders(token),
        },
        body: JSON.stringify({ rating, comment: fullComment }),
      });
      const saved = await readApiResponse<ProductComment>(response);
      setEligibility({ canReview: true, ownReview: saved });
      setReviews((current) => {
        const comments = current.comments.some((item) => item._id === saved._id)
          ? current.comments.map((item) => item._id === saved._id ? saved : item)
          : [saved, ...current.comments];
        const averageRating = comments.reduce((total, item) => total + item.rating, 0) / comments.length;
        return { comments, averageRating, total: comments.length };
      });
      setImageUrlInput("");
      setStarFilter("all");
      setSavedMessage("Đã lưu đánh giá của bạn.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể gửi đánh giá.");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitReport(event: FormEvent<HTMLFormElement>, reviewId: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setReportError("");
    setReporting(true);
    try {
      const response = await fetch(`${reviewUrl}/reports/${encodeURIComponent(reviewId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authenticatedHeaders(token) },
        body: JSON.stringify({ reason: form.get("reason"), details: form.get("details") }),
      });
      await readApiResponse<{ alreadyReported: boolean }>(response);
      setReported((previous) => [...previous, reviewId]);
      setReportId("");
    } catch (cause) {
      setReportError(cause instanceof Error ? cause.message : "Không thể gửi báo cáo.");
    } finally {
      setReporting(false);
    }
  }

  const filteredComments = reviews.comments.filter((item) =>
    starFilter === "all" ? true : item.rating === starFilter,
  );

  return (
    <section className="product-reviews review-anchor" id="product-reviews" tabIndex={-1} aria-labelledby="product-reviews-title">
      <div className="product-reviews-heading">
        <div>
          <h2 id="product-reviews-title">Đánh giá sản phẩm</h2>
          <p>
            {reviews.total ? (
              <>
                <strong>{reviews.averageRating.toFixed(1)}</strong> / 5 ★ · {reviews.total} đánh giá từ khách hàng
              </>
            ) : (
              "Chưa có đánh giá"
            )}
          </p>
        </div>

        {reviews.total > 0 && (
          <div className="review-filter-pills" role="group" aria-label="Lọc đánh giá theo số sao">
            <button
              type="button"
              className={`review-pill${starFilter === "all" ? " active" : ""}`}
              onClick={() => setStarFilter("all")}
            >
              Tất cả ({reviews.total})
            </button>
            {[5, 4, 3, 2, 1].map((star) => (
              <button
                key={star}
                type="button"
                className={`review-pill${starFilter === star ? " active" : ""}`}
                onClick={() => setStarFilter(star)}
              >
                {star} ★
              </button>
            ))}
          </div>
        )}
      </div>

      {token && eligibility?.canReview && (
        <form className="product-review-form" onSubmit={submitReview}>
          <p className="product-review-label">Đánh giá của bạn</p>
          <div className="product-review-stars" role="group" aria-label="Chọn số sao">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                className={value <= rating ? "active" : ""}
                aria-label={`${value} sao`}
                aria-pressed={rating === value}
                onClick={() => setRating(value)}
              >
                ★
              </button>
            ))}
          </div>

          <label className="product-review-label" htmlFor={`review-comment-${productId}`}>
            Nhận xét
          </label>
          <textarea
            id={`review-comment-${productId}`}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            maxLength={900}
            rows={4}
            placeholder="Chia sẻ cảm nhận của bạn về chất liệu, kiểu dáng và kích cỡ..."
            required
          />

          <div className="review-image-attach">
            <label className="product-review-label" htmlFor={`review-image-${productId}`}>
              Hình ảnh đánh giá (tối đa 3 ảnh)
            </label>
            <div className="review-image-input-row">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                hidden
                onChange={(event) => {
                  const files = event.target.files;
                  void handleUploadFiles(files);
                  event.target.value = "";
                }}
              />
              <button
                type="button"
                className="pill-button"
                disabled={uploadingImage || attachedImages.length >= 3}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploadingImage ? "Đang tải ảnh…" : "📷 Tải ảnh từ máy"}
              </button>
              <input
                id={`review-image-${productId}`}
                inputMode="url"
                value={imageUrlInput}
                onChange={(event) => setImageUrlInput(event.target.value)}
                placeholder="Hoặc dán link ảnh (https://...)"
              />
              <button
                type="button"
                className="pill-button"
                disabled={uploadingImage || attachedImages.length >= 3 || !imageUrlInput.trim()}
                onClick={handleAddImageUrl}
              >
                + Thêm link
              </button>
            </div>
            {attachedImages.length > 0 && (
              <div className="review-attached-previews">
                {attachedImages.map((imgUrl, index) => (
                  <div className="review-attached-thumb" key={`${imgUrl}-${index}`}>
                    <img src={resolveProductImage(imgUrl)} alt={`Ảnh đính kèm ${index + 1}`} />
                    <button
                      type="button"
                      aria-label="Xóa ảnh đính kèm"
                      onClick={() =>
                        setAttachedImages((prev) => prev.filter((_, itemIndex) => itemIndex !== index))
                      }
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="product-review-form-footer">
            <span>{comment.length}/900 ký tự</span>
            <button
              className="pill-button dark"
              type="submit"
              disabled={loading || !rating || !comment.trim() || submitting}
            >
              {submitting ? "Đang lưu..." : eligibility.ownReview ? "Lưu đánh giá" : "Gửi đánh giá"}
            </button>
          </div>
        </form>
      )}
      {!token && (
        <p className="product-review-login">
          <Link href={loginUrl}>Đăng nhập</Link> để đánh giá sản phẩm bạn đã nhận.
        </p>
      )}
      {token && !eligibilityError && !eligibility?.canReview && (
        <p className="product-review-login" role="status">
          {eligibility ? "Bạn có thể đánh giá sản phẩm sau khi đơn hàng được giao thành công." : "Đang kiểm tra đơn hàng của bạn…"}
        </p>
      )}
      {eligibilityError && <p className="product-review-error" role="alert">{eligibilityError}</p>}
      {savedMessage && <p className="product-review-notice" role="status">{savedMessage}</p>}

      {error && (
        <p className="product-review-error" role="alert">
          {error}
        </p>
      )}

      <div className="product-review-list" aria-live="polite">
        {loading ? (
          <p className="muted">Đang tải đánh giá...</p>
        ) : listError ? (
          <p className="product-review-error" role="alert">{listError}</p>
        ) : filteredComments.length ? (
          filteredComments.map((review) => {
            const parsed = parseCommentWithImages(review.comment);
            const allImages = [...(review.images ?? []), ...parsed.images];
            return (
              <article className="product-review" key={review._id}>
                <div className="product-review-author">
                  <strong>{review.user_name}</strong>
                  <time dateTime={review.createdAt}>
                    {new Date(review.createdAt).toLocaleDateString("vi-VN")}
                  </time>
                </div>
                <p className="product-review-rating" aria-label={`${review.rating} trên 5 sao`}>
                  {"★".repeat(review.rating)}
                  <span>{"★".repeat(5 - review.rating)}</span>
                </p>
                <p className="product-review-comment">{parsed.text}</p>
                {allImages.length > 0 && (
                  <div className="product-review-images">
                    {allImages.map((imgUrl, idx) => {
                      const resolved = resolveProductImage(imgUrl);
                      return (
                        <button
                          key={`${imgUrl}-${idx}`}
                          type="button"
                          className="review-photo-btn"
                          onClick={() => setPreviewImage(resolved)}
                          aria-label="Phóng to ảnh đánh giá"
                        >
                          <img src={resolved} alt={`Ảnh đánh giá từ ${review.user_name}`} loading="lazy" />
                        </button>
                      );
                    })}
                  </div>
                )}
                {reported.includes(review._id) ? (
                  <p className="product-review-notice" role="status">Đã gửi báo cáo vi phạm.</p>
                ) : reportId === review._id ? (
                  <form className="review-report-form" onSubmit={(event) => void submitReport(event, review._id)}>
                    <label>
                      Lý do báo cáo
                      <select name="reason" required defaultValue="">
                        <option value="" disabled>Chọn lý do</option>
                        {Object.entries(reviewReportReasons).map(([reason, label]) => (
                          <option key={reason} value={reason}>{label}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Chi tiết (không bắt buộc)
                      <textarea name="details" rows={2} maxLength={500} />
                    </label>
                    {reportError && <p className="product-review-error" role="alert">{reportError}</p>}
                    <div className="review-report-actions">
                      <button className="pill-button" type="button" disabled={reporting} onClick={() => setReportId("")}>Hủy</button>
                      <button className="pill-button dark" type="submit" disabled={reporting}>Gửi báo cáo</button>
                    </div>
                  </form>
                ) : review._id !== eligibility?.ownReview?._id && (
                  token ? (
                    <button className="review-report-trigger" type="button" disabled={reporting || !eligibility}
                      onClick={() => { setReportError(""); setReportId(review._id); }}>Báo cáo vi phạm</button>
                  ) : (
                    <Link className="review-report-trigger" href={loginUrl}>Đăng nhập để báo cáo</Link>
                  )
                )}
              </article>
            );
          })
        ) : (
          <p className="muted">{reviews.total ? "Chưa có đánh giá ở mức sao này." : "Sản phẩm chưa có đánh giá."}</p>
        )}
      </div>

      {previewImage && (
        <div
          className="image-zoom-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Xem ảnh đánh giá phóng to"
          onClick={() => setPreviewImage("")}
        >
          <div className="image-zoom-dialog" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="image-zoom-close"
              onClick={() => setPreviewImage("")}
              aria-label="Đóng ảnh phóng to"
            >
              × Đóng
            </button>
            <img src={previewImage} alt="Ảnh đánh giá phóng to" />
          </div>
        </div>
      )}
    </section>
  );
}
