"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useDemoAuth } from "@/lib/demo-auth";
import { getOrderPayments } from "@/lib/payment-api";

type ResultState =
  | "loading"
  | "pending"
  | "success"
  | "failed"
  | "refunded"
  | "error";

function PaymentResultContent() {
  const params = useSearchParams();
  const orderId = params.get("orderId");

  const { token, isHydrated } = useDemoAuth();

  const [result, setResult] = useState<{
    orderId: string;
    status: ResultState;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (!isHydrated || !orderId || !token) return;

    let cancelled = false;

    getOrderPayments(orderId, token)
      .then((data) => {
        if (cancelled) return;

        const status = data.order_payment_status;

        const messages = {
          pending: "Thanh toán đang chờ xác nhận.",
          success: "Thanh toán thành công!",
          failed: "Thanh toán thất bại.",
          refunded: "Đơn hàng đã được hoàn tiền.",
        };

        setResult({
          orderId,
          status,
          message: messages[status],
        });
      })
      .catch((error) => {
        if (cancelled) return;

        setResult({
          orderId,
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Không thể kiểm tra thanh toán.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [orderId, token, isHydrated]);

  const missingOrder = isHydrated && !orderId;
  const missingLogin = isHydrated && !token;

  let message = "Đang kiểm tra thanh toán...";

  if (missingOrder) {
    message = "Chưa có mã đơn hàng để kiểm tra.";
  } else if (missingLogin) {
    message = "Vui lòng đăng nhập để xem kết quả thanh toán.";
  } else if (result?.orderId === orderId) {
    message = result.message;
  }

  return (
    <main
      style={{
        minHeight: "75vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
      }}
    >
      <section
        style={{
          textAlign: "center",
          maxWidth: 520,
          width: "100%",
        }}
      >
        <h1>Kết quả thanh toán</h1>

        <p style={{ marginTop: 20 }}>{message}</p>

        <div
          style={{
            display: "flex",
            gap: 16,
            justifyContent: "center",
            marginTop: 24,
          }}
        >
          {missingLogin ? (
            <Link href="/dang-nhap">Đăng nhập</Link>
          ) : (
            <Link href="/orders">Xem đơn hàng</Link>
          )}

          <Link href="/">Về trang chủ</Link>
        </div>
      </section>
    </main>
  );
}

export default function PaymentResultPage() {
  return (
    <Suspense
      fallback={
        <main
          style={{
            minHeight: "75vh",
            display: "grid",
            placeItems: "center",
          }}
        >
          <p>Đang tải trang kết quả thanh toán...</p>
        </main>
      }
    >
      <PaymentResultContent />
    </Suspense>
  );
}
