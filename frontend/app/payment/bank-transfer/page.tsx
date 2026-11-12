"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useDemoAuth } from "@/lib/demo-auth";
import {
  createBankTransferCheckout,
  type BankTransferPaymentResponse,
} from "@/lib/payment-api";

function BankTransferContent() {
  const params = useSearchParams();
  const orderId = params.get("orderId");
  const { token, isHydrated } = useDemoAuth();

  const [payment, setPayment] = useState<BankTransferPaymentResponse | null>(
    null,
  );

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Không tự tạo Payment khi trang vừa được mở.
  // Người dùng chủ động nhấn nút để gửi yêu cầu.
  async function handleCreatePayment() {
    if (!orderId || !token || loading) return;

    setLoading(true);
    setError("");

    try {
      const result = await createBankTransferCheckout(orderId, token);

      setPayment(result);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Không thể lấy thông tin chuyển khoản.",
      );
    } finally {
      setLoading(false);
    }
  }

  const validOrderId =
    typeof orderId === "string" && /^[a-fA-F0-9]{24}$/.test(orderId);

  return (
    <main
      className="container"
      style={{ maxWidth: 650, paddingTop: 50, paddingBottom: 60 }}
    >
      <h1 className="page-title">Thanh toán chuyển khoản</h1>

      {!isHydrated ? (
        <p>Đang kiểm tra đăng nhập...</p>
      ) : !token ? (
        <p>
          Vui lòng <Link href="/dang-nhap">đăng nhập</Link>.
        </p>
      ) : !validOrderId ? (
        <p>Chưa có mã đơn hàng hợp lệ.</p>
      ) : (
        <>
          <p>
            Đơn hàng: <strong>{orderId}</strong>
          </p>

          {!payment && (
            <button
              type="button"
              className="pill-button dark"
              disabled={loading}
              onClick={handleCreatePayment}
            >
              {loading ? "Đang lấy thông tin..." : "Lấy thông tin chuyển khoản"}
            </button>
          )}

          {error && (
            <p role="alert" style={{ color: "#b42318" }}>
              {error}
            </p>
          )}

          {payment && (
            <section className="panel" style={{ marginTop: 24 }}>
              <h2>Thông tin chuyển khoản</h2>

              <p>
                Ngân hàng: <strong>{payment.bank.bank_name}</strong>
              </p>

              <p>
                Số tài khoản: <strong>{payment.bank.account_number}</strong>
              </p>

              <p>
                Chủ tài khoản: <strong>{payment.bank.account_name}</strong>
              </p>

              <p>
                Số tiền:{" "}
                <strong>{payment.amount.toLocaleString("vi-VN")} đ</strong>
              </p>

              <p>
                Nội dung chuyển khoản:{" "}
                <strong>{payment.transfer_content}</strong>
              </p>

              <p style={{ marginTop: 20 }}>
                Trạng thái: <strong>Chờ xác nhận thanh toán</strong>
              </p>

              <p className="small muted">
                Vui lòng chuyển đúng số tiền và nội dung. Đơn hàng chỉ được xác
                nhận thanh toán sau khi hệ thống kiểm tra giao dịch.
              </p>

              <Link
                href={`/payment/result?orderId=${encodeURIComponent(
                  payment.order_id,
                )}`}
                className="pill-button"
              >
                Kiểm tra trạng thái
              </Link>
            </section>
          )}
        </>
      )}

      <p style={{ marginTop: 28 }}>
        <Link href="/orders">Xem đơn hàng của tôi</Link>
      </p>
    </main>
  );
}

export default function BankTransferPage() {
  return (
    <Suspense fallback={<p>Đang tải trang thanh toán...</p>}>
      <BankTransferContent />
    </Suspense>
  );
}
