"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useDemoAuth } from "@/lib/demo-auth";
import { getBackendCart, type BackendCart } from "@/lib/cart-api";
import { getShippingAddresses, type ShippingAddress } from "@/lib/address-api";
import { createBackendOrder, type PaymentMethod } from "@/lib/order-api";
import { createOnlineCheckout } from "@/lib/online-checkout";
import { formatVnd } from "@/data/products";
import PaymentMethodSelector from "./PaymentMethodSelector";

type CreatedOrder = {
  id: string;
  method: PaymentMethod;
};

function validatePaymentUrl(value: string, method: "VNPay" | "MoMo") {
  const url = new URL(value);

  const expectedHost =
    method === "VNPay"
      ? process.env.NEXT_PUBLIC_VNPAY_PAYMENT_HOST
      : process.env.NEXT_PUBLIC_MOMO_PAYMENT_HOST;

  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    !expectedHost ||
    url.hostname.toLowerCase() !== expectedHost.toLowerCase()
  ) {
    throw new Error(
      "URL cổng thanh toán chưa được cấu hình hoặc không hợp lệ.",
    );
  }

  return url.toString();
}

export default function BackendCheckout() {
  const router = useRouter();
  const { token, isHydrated } = useDemoAuth();

  const [cart, setCart] = useState<BackendCart | null>(null);
  const [addresses, setAddresses] = useState<ShippingAddress[]>([]);
  const [addressId, setAddressId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("COD");
  const [note, setNote] = useState("");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [createdOrder, setCreatedOrder] = useState<CreatedOrder | null>(null);
  const [completedCOD, setCompletedCOD] = useState(false);

  const busy = useRef(false);

  useEffect(() => {
    if (!isHydrated || !token) return;

    let active = true;

    Promise.all([getBackendCart(token), getShippingAddresses(token)])
      .then(([cartData, addressData]) => {
        if (!active) return;

        setCart(cartData);
        setAddresses(addressData);
        setAddressId(
          addressData.find((item) => item.is_default)?._id ??
            addressData[0]?._id ??
            "",
        );
        setError("");
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(
          cause instanceof Error
            ? cause.message
            : "Không thể tải dữ liệu Checkout.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [token, isHydrated]);

  async function continuePayment(order: CreatedOrder) {
    if (!token) throw new Error("Phiên đăng nhập không hợp lệ.");

    if (order.method === "COD") {
      setCompletedCOD(true);
      return;
    }

    if (order.method === "BankTransfer") {
      router.push(
        `/payment/bank-transfer?orderId=${encodeURIComponent(order.id)}`,
      );
      return;
    }

    const paymentUrl = await createOnlineCheckout(
      order.id,
      order.method,
      token,
    );

    const safeUrl = validatePaymentUrl(paymentUrl, order.method);

    window.location.assign(safeUrl);
  }

  async function handleSubmit() {
    if (busy.current || !token || !cart?.items.length || !addressId) {
      return;
    }

    busy.current = true;
    setSubmitting(true);
    setError("");

    try {
      // Chỉ tạo một đơn. Nếu đã có đơn, dùng lại mã cũ.
      let order = createdOrder;

      if (!order) {
        const response = await createBackendOrder(
          {
            address_id: addressId,
            payment_method: paymentMethod,
            note,
          },
          token,
        );

        order = {
          id: response.order_id,
          method: paymentMethod,
        };

        setCreatedOrder(order);
      }

      await continuePayment(order);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Không thể hoàn tất yêu cầu.",
      );
    } finally {
      busy.current = false;
      setSubmitting(false);
    }
  }

  if (!isHydrated) {
    return <p>Đang kiểm tra đăng nhập...</p>;
  }

  if (!token) {
    return (
      <div className="container">
        <h2>Vui lòng đăng nhập</h2>
        <Link href="/dang-nhap">Đăng nhập</Link>
      </div>
    );
  }

  if (loading) {
    return <p>Đang tải giỏ hàng và địa chỉ...</p>;
  }

  return (
    <section className="container checkout-page">
      <h1 className="page-title">Thanh toán bằng MongoDB</h1>

      {error && (
        <p role="alert" style={{ color: "#b42318" }}>
          {error}
        </p>
      )}

      {createdOrder ? (
        <div className="panel">
          <h2>
            {completedCOD ? "Đã tạo đơn hàng COD" : "Đơn hàng đã được tạo"}
          </h2>

          <p>
            Mã đơn hàng: <strong>{createdOrder.id}</strong>
          </p>

          <p>
            Phương thức: <strong>{createdOrder.method}</strong>
          </p>

          <p>
            {completedCOD
              ? "Đơn COD đã được ghi nhận và đang chờ xử lý."
              : "Nếu thanh toán chưa hoàn tất, hãy tiếp tục bằng mã đơn hiện tại. Không tạo đơn mới."}
          </p>

          {!completedCOD && (
            <button
              type="button"
              className="pill-button dark"
              disabled={submitting}
              onClick={handleSubmit}
            >
              {submitting ? "Đang xử lý..." : "Tiếp tục thanh toán"}
            </button>
          )}

          <p style={{ marginTop: 16 }}>
            <Link href="/orders">Xem danh sách đơn hàng MongoDB</Link>
          </p>
        </div>
      ) : (
        <>
          <h2 className="section-title">1. Giỏ hàng</h2>

          {!cart?.items.length ? (
            <div className="panel">
              <p>Giỏ hàng MongoDB đang trống.</p>
              <Link href="/products">Tiếp tục mua sắm</Link>
            </div>
          ) : (
            <div className="panel">
              <p>
                Số lượng sản phẩm: <strong>{cart.total_quantity}</strong>
              </p>

              <p>
                Tổng tiền: <strong>{formatVnd(cart.total_price)}</strong>
              </p>

              <Link href="/cart">Kiểm tra giỏ hàng</Link>
            </div>
          )}

          <h2 className="section-title">2. Địa chỉ giao hàng</h2>

          {!addresses.length ? (
            <div className="panel">
              <p>Bạn chưa có địa chỉ giao hàng MongoDB.</p>
              <Link href="/profile/address">Quản lý địa chỉ</Link>
            </div>
          ) : (
            <div className="panel">
              <select
                className="form-field"
                value={addressId}
                onChange={(event) => setAddressId(event.target.value)}
              >
                {addresses.map((address) => (
                  <option key={address._id} value={address._id}>
                    {address.receiver_name} - {address.address_detail},{" "}
                    {address.ward}, {address.district}, {address.province}
                  </option>
                ))}
              </select>
            </div>
          )}

          <PaymentMethodSelector
            value={paymentMethod}
            onChange={setPaymentMethod}
          />

          <h2 className="section-title">4. Ghi chú đơn hàng</h2>

          <textarea
            className="form-field"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={500}
            rows={3}
            placeholder="Ghi chú (không bắt buộc)"
          />

          <button
            type="button"
            className="pill-button dark place-order-button"
            disabled={submitting || !cart?.items.length || !addressId}
            onClick={handleSubmit}
          >
            {submitting ? "Đang tạo đơn hàng..." : "Đặt hàng"}
          </button>

          <p className="small muted">
            Đơn hàng được tạo theo giá và tồn kho do Backend xác minh. Nếu không
            nhận được phản hồi, hãy kiểm tra danh sách đơn trước khi đặt lại.
          </p>
        </>
      )}
    </section>
  );
}
