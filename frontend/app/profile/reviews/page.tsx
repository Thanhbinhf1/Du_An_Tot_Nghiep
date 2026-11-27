"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AccountLayout from "@/components/account/AccountLayout";
import styles from "@/components/account/account.module.css";
import { API_BASE_URL, authenticatedHeaders, readApiEnvelope } from "@/lib/api";
import { useDemoAuth } from "@/lib/demo-auth";

type Review = { _id: string; productId: string | null; productName: string; rating: number; comment: string };

export default function ReviewsPage() {
  const { token, isHydrated } = useDemoAuth();
  return <AccountLayout active="reviews" title="Đánh giá của tôi">
    {!isHydrated ? <p role="status">Đang kiểm tra đăng nhập…</p> : token ? <Reviews key={token} token={token} /> :
      <Link href="/dang-nhap?returnTo=%2Fprofile%2Freviews">Đăng nhập để xem đánh giá</Link>}
  </AccountLayout>;
}

function Reviews({ token }: { token: string }) {
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<{ rows: Review[]; pages: number }>();
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch(API_BASE_URL + "/reviews/account/mine?page=" + page, {
      headers: authenticatedHeaders(token), cache: "no-store", signal: controller.signal,
    }).then(readApiEnvelope<Review[]>).then(({ data, pagination }) => {
      if (!controller.signal.aborted) setResult({ rows: data, pages: pagination?.totalPages ?? 1 });
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Chưa tải được đánh giá.");
    });
    return () => controller.abort();
  }, [page, token]);
  function changePage(next: number) {
    setResult(undefined);
    setError("");
    setPage(next);
  }
  if (error) return <p role="alert">{error}</p>;
  if (!result) return <p role="status">Đang tải đánh giá…</p>;
  return <>
    {!result.rows.length && <p>Bạn chưa có đánh giá nào.</p>}
    {result.rows.map((review) => <article className={styles.panel} key={review._id}>
      <h2>{review.productName}</h2><span>{review.rating}/5 sao</span><p>{review.comment}</p>
      {review.productId && <Link href={`/product/${review.productId}#product-reviews`}>Xem đánh giá trên sản phẩm</Link>}
    </article>)}
    {result.pages > 1 && <nav aria-label="Phân trang đánh giá">
      <button disabled={page <= 1} onClick={() => changePage(page - 1)}>Trang trước</button>
      <span> Trang {page} / {result.pages} </span>
      <button disabled={page >= result.pages} onClick={() => changePage(page + 1)}>Trang sau</button>
    </nav>}
  </>;
}
