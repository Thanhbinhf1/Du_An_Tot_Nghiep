"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { API_BASE_URL, authenticatedHeaders, readApiResponse } from "@/lib/api";
import { useDemoAuth } from "@/lib/demo-auth";

type ProductComment = {
  _id: string;
  user_name: string;
  rating: number;
  comment: string;
  createdAt: string;
};

type ProductReviewResponse = {
  comments: ProductComment[];
  averageRating: number;
  total: number;
};

export default function ProductReviews({ productId }: { productId: string }) {
  const { isLoggedIn, token } = useDemoAuth();
  const [reviews, setReviews] = useState<ProductReviewResponse>({
    comments: [],
    averageRating: 0,
    total: 0,
  });
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_BASE_URL}/reviews/${encodeURIComponent(productId)}`, {
      signal: controller.signal,
    })
      .then(readApiResponse<ProductReviewResponse>)
      .then(setReviews)
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : "Không thể tải đánh giá.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [productId]);

  async function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/reviews/${encodeURIComponent(productId)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authenticatedHeaders(token),
        },
        body: JSON.stringify({ rating, comment }),
      });
      await readApiResponse<ProductComment>(response);
      const updatedResponse = await fetch(`${API_BASE_URL}/reviews/${encodeURIComponent(productId)}`);
      setReviews(await readApiResponse<ProductReviewResponse>(updatedResponse));
      setComment("");
      setRating(0);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể gửi đánh giá.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="product-reviews" aria-labelledby="product-reviews-title">
      <div className="product-reviews-heading">
        <div>
          <h2 id="product-reviews-title">Đánh giá sản phẩm</h2>
          <p>
            {reviews.total
              ? <><strong>{reviews.averageRating.toFixed(1)}</strong> / 5 · {reviews.total} đánh giá</>
              : "Chưa có đánh giá"}
          </p>
        </div>
      </div>

      {isLoggedIn ? (
        <form className="product-review-form" onSubmit={submitReview}>
          <label className="product-review-label">Đánh giá của bạn</label>
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
            maxLength={1000}
            rows={4}
            placeholder="Chia sẻ cảm nhận của bạn về sản phẩm"
            required
          />
          <div className="product-review-form-footer">
            <span>{comment.length}/1000 ký tự</span>
            <button className="pill-button dark" type="submit" disabled={!rating || !comment.trim() || submitting}>
              {submitting ? "Đang gửi..." : "Gửi đánh giá"}
            </button>
          </div>
        </form>
      ) : (
        <p className="product-review-login">
          <Link href="/dang-nhap">Đăng nhập</Link> để viết đánh giá sản phẩm.
        </p>
      )}

      {error && <p className="product-review-error" role="alert">{error}</p>}

      <div className="product-review-list" aria-live="polite">
        {loading ? <p className="muted">Đang tải đánh giá...</p> : reviews.comments.length ? (
          reviews.comments.map((review) => (
            <article className="product-review" key={review._id}>
              <div className="product-review-author">
                <strong>{review.user_name}</strong>
                <time dateTime={review.createdAt}>
                  {new Date(review.createdAt).toLocaleDateString("vi-VN")}
                </time>
              </div>
              <p className="product-review-rating" aria-label={`${review.rating} trên 5 sao`}>
                {"★".repeat(review.rating)}<span>{"★".repeat(5 - review.rating)}</span>
              </p>
              <p className="product-review-comment">{review.comment}</p>
            </article>
          ))
        ) : !error ? (
          <p className="muted">Hãy là người đầu tiên chia sẻ đánh giá về sản phẩm này.</p>
        ) : null}
      </div>
    </section>
  );
}
