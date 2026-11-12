"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { useDemoAuth } from "@/lib/demo-auth";
import { getMyBackendOrders, type BackendOrder } from "@/lib/order-api";
import { formatVnd } from "@/data/products";

const orderStatusText: Record<string, string> = {
  pending: "Chờ xác nhận",
  processing: "Đang xử lý",
  shipping: "Đang giao hàng",
  completed: "Hoàn thành",
  cancelled: "Đã hủy",
};

const paymentStatusText: Record<string, string> = {
  pending: "Chờ thanh toán",
  success: "Đã thanh toán",
  failed: "Thanh toán thất bại",
  refunded: "Đã hoàn tiền",
};

const paymentMethodText: Record<string, string> = {
  COD: "Thanh toán khi nhận hàng",
  BankTransfer: "Chuyển khoản ngân hàng",
  VNPay: "VNPay",
  MoMo: "MoMo",
};

export default function BackendOrdersPage() {
  const { token, isHydrated } = useDemoAuth();

  const [orders, setOrders] = useState<BackendOrder[]>([]);
  const [loadedToken, setLoadedToken] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isHydrated || !token) return;

    let active = true;

    getMyBackendOrders(token)
      .then((data) => {
        if (!active) return;
        setOrders(data);
        setLoadedToken(token);
        setError("");
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setLoadedToken(token);
        setError(
          cause instanceof Error ? cause.message : "Không thể tải đơn hàng.",
        );
      });

    return () => {
      active = false;
    };
  }, [token, isHydrated]);

  if (!isHydrated) {
    return (
      <main className="container">
        <p>Đang kiểm tra đăng nhập...</p>
      </main>
    );
  }

  if (!token) {
    return (
      <main className="container">
        <h1 className="page-title">Đơn hàng của tôi</h1>
        <p>Vui lòng đăng nhập để xem đơn hàng.</p>
        <Link href="/dang-nhap">Đăng nhập</Link>
      </main>
    );
  }

  const loading = loadedToken !== token;

  return (
    <main className="container" style={{ paddingTop: 32, paddingBottom: 64 }}>
      <h1 className="page-title">Đơn hàng MongoDB</h1>

      <p className="small muted">
        Danh sách đơn hàng được lấy từ Backend F.Style.
      </p>

      {loading && <p>Đang tải đơn hàng...</p>}

      {!loading && error && (
        <p role="alert" style={{ color: "#b42318" }}>
          {error}
        </p>
      )}

      {!loading && !error && orders.length === 0 && (
        <div className="empty-state">
          <h2>Bạn chưa có đơn hàng MongoDB</h2>
          <p>Khi Checkout thật được sử dụng, đơn hàng sẽ xuất hiện ở đây.</p>
          <Link className="pill-button dark" href="/products">
            Tiếp tục mua sắm
          </Link>
        </div>
      )}

      {!loading && !error && (
        <div style={{ display: "grid", gap: 18 }}>
          {orders.map((order) => {
            const canContinuePayment =
              order.order_status === "pending" &&
              order.payment_status === "pending";

            return (
              <article
                className="panel"
                key={order._id}
                style={{ padding: 24 }}
              >
                <h2 style={{ fontSize: 18 }}>
                  Đơn hàng #{order._id.slice(-8).toUpperCase()}
                </h2>

                <p className="small muted">Mã đầy đủ: {order._id}</p>

                <p>
                  Người nhận: <strong>{order.receiver_name}</strong>
                </p>

                <p>
                  Phương thức:{" "}
                  <strong>
                    {paymentMethodText[order.payment_method] ??
                      order.payment_method}
                  </strong>
                </p>

                <p>
                  Trạng thái đơn:{" "}
                  <strong>
                    {orderStatusText[order.order_status] ?? order.order_status}
                  </strong>
                </p>

                <p>
                  Thanh toán:{" "}
                  <strong>
                    {paymentStatusText[order.payment_status] ??
                      order.payment_status}
                  </strong>
                </p>

                <p>
                  Tổng tiền: <strong>{formatVnd(order.final_amount)}</strong>
                </p>

                <div
                  style={{
                    display: "flex",
                    gap: 12,
                    flexWrap: "wrap",
                    marginTop: 20,
                  }}
                >
                  <Link
                    className="pill-button"
                    href={`/payment/result?orderId=${encodeURIComponent(
                      order._id,
                    )}`}
                  >
                    Kiểm tra thanh toán
                  </Link>

                  {canContinuePayment &&
                    order.payment_method === "BankTransfer" && (
                      <Link
                        className="pill-button dark"
                        href={`/payment/bank-transfer?orderId=${encodeURIComponent(
                          order._id,
                        )}`}
                      >
                        Tiếp tục chuyển khoản
                      </Link>
                    )}
                </div>

                {canContinuePayment &&
                  (order.payment_method === "MoMo" ||
                    order.payment_method === "VNPay") && (
                    <p className="small muted">
                      Đơn đang chờ thanh toán online. Chức năng tiếp tục thanh
                      toán sẽ được kết nối với cổng thanh toán.
                    </p>
                  )}
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
