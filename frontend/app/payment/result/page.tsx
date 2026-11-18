"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useDemoAuth } from "@/lib/demo-auth";
import { getOrderPayments, type PaymentStatus } from "@/lib/payment-api";
import { getBackendOrder, paymentMethodText } from "@/lib/order-api";
import { formatVnd } from "@/data/products";

const states = {
  loading: { title: "Đang kiểm tra thanh toán", message: "Đang tải trạng thái giao dịch.", mark: "…" },
  pending: { title: "Đang chờ xác nhận", message: "Hệ thống đang chờ xác nhận từ cổng thanh toán.", mark: "…" },
  success: { title: "Thanh toán thành công", message: "F.Style đã ghi nhận khoản thanh toán của bạn.", mark: "✓" },
  failed: { title: "Thanh toán thất bại", message: "Mở chi tiết đơn để xem trạng thái và các lựa chọn thanh toán còn khả dụng.", mark: "×" },
  refunded: { title: "Đã hoàn tiền", message: "Đơn hàng đã được cập nhật trạng thái hoàn tiền.", mark: "↩" },
  error: { title: "Kết quả thanh toán", message: "Chưa thể tải trạng thái giao dịch.", mark: "!" },
};

type PaymentResult = { status: PaymentStatus | "error"; message?: string; method?: string; amount?: number };

function LoadingResult() {
  return <div className="payment-result-frame"><p className="panel" role="status">Đang tải kết quả thanh toán...</p></div>;
}

function PaymentResultRoute() {
  const orderId = useSearchParams().get("orderId");
  const { token, isHydrated } = useDemoAuth();
  if (!isHydrated) return <LoadingResult />;
  return <PaymentResultContent key={`${orderId}:${token}`} orderId={orderId} token={token} />;
}

function PaymentResultContent({ orderId, token }: { orderId: string | null; token: string }) {
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<PaymentResult>();
  const validOrder = Boolean(orderId && /^[a-f0-9]{24}$/i.test(orderId));
  const state = validOrder && token ? result?.status ?? "loading" : "error";
  const presentation = states[state];
  const message = !validOrder
    ? "Kiểm tra lại liên kết hoặc mở đơn hàng từ tài khoản của bạn."
    : !token
      ? "Đăng nhập để xem trạng thái của giao dịch này."
      : result?.message || presentation.message;

  useEffect(() => {
    if (!validOrder || !orderId || !token) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const id = orderId;

    async function refresh(remaining: number) {
      try {
        const data = await getOrderPayments(id, token);
        if (!active) return;
        const status = data.order_payment_status;
        const method = data.payments[0]?.payment_method;
        setResult({ status, method: method ? paymentMethodText[method] : undefined });

        if (status === "success") {
          const order = await getBackendOrder(id, token).catch(() => undefined);
          if (active && order) {
            setResult({ status, method: paymentMethodText[order.payment_method], amount: order.final_amount });
          }
        }
        if (status === "pending" && remaining > 0) {
          timer = setTimeout(() => void refresh(remaining - 1), 3000);
        }
      } catch (cause) {
        if (active) setResult({ status: "error", message: cause instanceof Error ? cause.message : undefined });
      }
    }

    void refresh(8);
    return () => { active = false; clearTimeout(timer); };
  }, [orderId, token, revision, validOrder]);

  return (
    <div className="payment-result-frame">
      <section className="panel payment-result-card" data-status={state} aria-live="polite">
        <span className="payment-result-mark" aria-hidden="true">{presentation.mark}</span>
        <h1>{presentation.title}</h1>
        <p>{message}</p>
        {validOrder && orderId && (
          <dl className="payment-result-details">
            <div><dt>Mã đơn hàng</dt><dd>#{orderId.slice(-8).toUpperCase()}</dd></div>
            {result?.method && <div><dt>Phương thức</dt><dd>{result.method}</dd></div>}
            {result?.amount != null && <div><dt>Đã thanh toán</dt><dd>{formatVnd(result.amount)}</dd></div>}
          </dl>
        )}

        <div className="payment-result-actions">
          {validOrder && token && orderId && <Link className="pill-button dark" href={`/orders/${encodeURIComponent(orderId)}`}>Xem chi tiết đơn hàng</Link>}
          {!token && <Link className="pill-button dark" href="/dang-nhap">Đăng nhập</Link>}
          {validOrder && token && (state === "pending" || state === "error") && (
            <button type="button" className="pill-button" onClick={() => { setResult(undefined); setRevision((value) => value + 1); }}>Kiểm tra lại</button>
          )}
          <Link className="pill-button" href="/products">Tiếp tục mua sắm</Link>
        </div>
      </section>
    </div>
  );
}

export default function PaymentResultPage() {
  return <Suspense fallback={<LoadingResult />}><PaymentResultRoute /></Suspense>;
}
