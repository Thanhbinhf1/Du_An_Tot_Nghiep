"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useDemoAuth } from "@/lib/demo-auth";
import { formatVnd } from "@/data/products";
import { createSePayCheckout, getOrderPayments, reconcileSePayOrder, type SePayPaymentResponse } from "@/lib/payment-api";

function LoadingPayment() {
  return <div className="payment-result-frame"><p className="panel" role="status">Đang tải thông tin thanh toán...</p></div>;
}

function SePayRoute() {
  const orderId = useSearchParams().get("orderId");
  const { token, isHydrated } = useDemoAuth();
  const [attempt, setAttempt] = useState(0);
  if (!isHydrated) return <LoadingPayment />;
  if (!token || !orderId || !/^[a-f0-9]{24}$/i.test(orderId)) {
    return (
      <div className="payment-result-frame">
        <section className="panel payment-result-card">
          <h1>Thanh toán SePay</h1>
          <p>{!token ? "Đăng nhập để thanh toán đơn hàng của bạn." : "Mã đơn hàng không hợp lệ."}</p>
          <Link className="pill-button dark" href={!token ? "/dang-nhap" : "/orders"}>{!token ? "Đăng nhập" : "Xem đơn hàng"}</Link>
        </section>
      </div>
    );
  }
  return <SePayPayment key={`${orderId}:${token}:${attempt}`} orderId={orderId} token={token} retry={() => setAttempt((value) => value + 1)} />;
}

function SePayPayment({ orderId, token, retry }: { orderId: string; token: string; retry: () => void }) {
  const router = useRouter();
  const [payment, setPayment] = useState<SePayPaymentResponse>();
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const [notice, setNotice] = useState("");
  const [qrFailed, setQrFailed] = useState(false);
  const resultUrl = `/payment/result?orderId=${encodeURIComponent(orderId)}`;

  useEffect(() => {
    let active = true;
    createSePayCheckout(orderId, token)
      .then((data) => { if (active) setPayment(data); })
      .catch(async (cause: unknown) => {
        const current = await getOrderPayments(orderId, token).catch(() => undefined);
        if (!active) return;
        if (current && current.order_payment_status !== "pending") {
          router.replace(resultUrl);
          return;
        }
        setError(cause instanceof Error ? cause.message : "Không thể tải thông tin thanh toán SePay.");
      });
    return () => { active = false; };
  }, [orderId, token, resultUrl, router]);

  useEffect(() => {
    if (!payment) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;
    async function refresh() {
      try {
        // Tra cứu trực tiếp định kỳ hỗ trợ trường hợp webhook chưa tới cửa hàng.
        if (attempt % 3 === 0) await reconcileSePayOrder(orderId, token).catch(() => undefined);
        if (!active) return;
        const data = await getOrderPayments(orderId, token);
        if (!active) return;
        if (data.order_payment_status !== "pending") {
          router.replace(resultUrl);
          return;
        }
      } catch {
        // Khách vẫn có thể chuyển khoản theo mã đang hiển thị và kiểm tra lại.
      }
      attempt++;
      if (active) timer = setTimeout(() => void refresh(), 5000);
    }
    void refresh();
    return () => { active = false; clearTimeout(timer); };
  }, [payment, orderId, token, resultUrl, router]);

  async function checkPayment() {
    if (checking) return;
    setChecking(true);
    setNotice("");
    try {
      await reconcileSePayOrder(orderId, token);
      const data = await getOrderPayments(orderId, token);
      if (data.order_payment_status !== "pending") router.replace(resultUrl);
      else setNotice("Chưa ghi nhận khoản thanh toán. Hệ thống sẽ tiếp tục kiểm tra.");
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "Chưa thể kiểm tra giao dịch. Vui lòng thử lại.");
    } finally {
      setChecking(false);
    }
  }

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setNotice("Đã sao chép.");
    } catch {
      setNotice("Bạn có thể chọn và sao chép thông tin chuyển khoản đang hiển thị.");
    }
  }

  if (!payment && !error) return <LoadingPayment />;
  return (
    <section className="sepay-payment-frame">
      <div className="sepay-payment-heading">
        <Link href={`/orders/${encodeURIComponent(orderId)}`}>← Chi tiết đơn hàng</Link>
        <h1 className="page-title">Thanh toán qua SePay</h1>
        <p className="muted">Quét mã bằng ứng dụng ngân hàng. Giữ nguyên số tiền và nội dung chuyển khoản.</p>
      </div>
      {error && (
        <div className="panel sepay-payment-error">
          <p role="alert">{error}</p>
          <button className="pill-button dark" type="button" onClick={retry}>Thử lại</button>
        </div>
      )}
      {payment && (
        <div className="panel sepay-payment-card">
          <div className="sepay-qr-column">
            <p className="small muted">Đơn hàng #{orderId.slice(-8).toUpperCase()}</p>
            <strong className="sepay-payment-amount">{formatVnd(payment.amount)}</strong>
            {qrFailed ? (
              <p role="alert" className="sepay-qr-error">Chưa tải được mã QR. Bạn có thể chuyển khoản theo thông tin bên cạnh.</p>
            ) : (
              <Image unoptimized src={payment.qr_url} width={280} height={280} className="sepay-qr-image"
                alt="Mã QR chuyển khoản cho đơn hàng" onError={() => setQrFailed(true)} />
            )}
            <p className="small muted">Mã QR đã điền sẵn thông tin chuyển khoản.</p>
          </div>
          <div className="sepay-details-column">
            <h2>Thông tin nhận tiền</h2>
            <dl className="sepay-bank-details">
              <div><dt>Ngân hàng</dt><dd>{payment.bank.bank_name}</dd></div>
              <div><dt>Chủ tài khoản</dt><dd>{payment.bank.account_name}</dd></div>
              <div>
                <dt>Số tài khoản</dt>
                <dd><span>{payment.bank.account_number}</span><button type="button" onClick={() => void copy(payment.bank.account_number)} aria-label="Sao chép số tài khoản">Sao chép</button></dd>
              </div>
              <div>
                <dt>Nội dung chuyển khoản</dt>
                <dd><strong>{payment.transfer_content}</strong><button type="button" onClick={() => void copy(payment.transfer_content)} aria-label="Sao chép nội dung chuyển khoản">Sao chép</button></dd>
              </div>
            </dl>
            <p className="sepay-payment-status" role="status">Đang chờ thanh toán</p>
            <p className="small muted">Trang sẽ tự cập nhật sau khi cửa hàng xác nhận giao dịch.</p>
            <button type="button" className="pill-button dark" disabled={checking} onClick={() => void checkPayment()}>
              {checking ? "Đang kiểm tra..." : "Tôi đã chuyển khoản"}
            </button>
            {notice && <p className="small" role="status">{notice}</p>}
            <p><Link href={resultUrl}>Xem trạng thái thanh toán</Link></p>
          </div>
        </div>
      )}
    </section>
  );
}

export default function SePayPage() {
  return <Suspense fallback={<LoadingPayment />}><SePayRoute /></Suspense>;
}
