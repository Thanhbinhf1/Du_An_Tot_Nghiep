"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import AddressLocations from "@/components/account/AddressLocations";
import { useDemoAuth } from "@/lib/demo-auth";
import { getBackendCart, notifyCartChanged, type BackendCart } from "@/lib/cart-api";
import {
  emptyShippingAddress,
  formatShippingAddress,
  getShippingAddresses,
  saveShippingAddress,
  type ShippingAddress,
  type ShippingAddressInput,
} from "@/lib/address-api";
import { createBackendOrder, getCheckoutQuote, type CheckoutQuote, type PaymentMethod, type ShippingMethod } from "@/lib/order-api";
import { createOnlineCheckout } from "@/lib/online-checkout";
import { getPaymentMethods } from "@/lib/payment-api";
import { useCatalogProducts } from "@/lib/useCatalogProducts";
import { formatVnd } from "@/data/products";
import PaymentMethodSelector from "./PaymentMethodSelector";

type CreatedOrder = {
  id: string;
  method: PaymentMethod;
};

export default function BackendCheckout() {
  const { token, isHydrated } = useDemoAuth();
  if (!isHydrated) return <div className="container" style={{ padding: 40 }}><p>Đang kiểm tra đăng nhập...</p></div>;
  if (!token) {
    return (
      <div className="container checkout-empty">
        <h1 className="page-title">Thanh toán</h1>
        <p>Vui lòng đăng nhập để tiến hành đặt hàng.</p>
        <Link href="/dang-nhap" className="pill-button dark">
          Đăng nhập ngay
        </Link>
      </div>
    );
  }
  return <CheckoutContent key={token} token={token} />;
}

function CheckoutContent({ token }: { token: string }) {
  const router = useRouter();
  const { products } = useCatalogProducts();

  const [cart, setCart] = useState<BackendCart | null>(null);
  const [addresses, setAddresses] = useState<ShippingAddress[]>([]);
  const [addressId, setAddressId] = useState("");
  const [showNewAddressModal, setShowNewAddressModal] = useState(false);
  const [newAddress, setNewAddress] = useState<ShippingAddressInput>(emptyShippingAddress);
  const [savingAddress, setSavingAddress] = useState(false);
  const [addressError, setAddressError] = useState("");

  const [deliveryMethod, setDeliveryMethod] = useState<ShippingMethod>("Standard");
  const [preferredPaymentMethod, setPaymentMethod] = useState<PaymentMethod>("COD");
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [note, setNote] = useState("");

  const [couponCode, setCouponCode] = useState("");
  const [requestedCoupon, setRequestedCoupon] = useState("");
  const [quoteResult, setQuoteResult] = useState<{ key: string; data?: CheckoutQuote; error?: string }>();
  const [quoteRevision, setQuoteRevision] = useState(0);
  const quoteKey = JSON.stringify([deliveryMethod, requestedCoupon, quoteRevision]);
  const quote = quoteResult?.key === quoteKey ? quoteResult.data : undefined;
  const availableMethods = methods.filter((method) => {
    if (quote?.final_amount === 0) return method === "COD";
    if (method === "MoMo" && quote) return quote.final_amount >= 1_000 && quote.final_amount <= 50_000_000;
    if (method === "SePay" && quote) return Number.isSafeInteger(quote.final_amount);
    return true;
  });
  const paymentMethod = availableMethods.includes(preferredPaymentMethod) ? preferredPaymentMethod : "COD";
  const quoteError = quoteResult?.key === quoteKey ? quoteResult.error : undefined;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [createdOrder, setCreatedOrder] = useState<CreatedOrder | null>(null);
  const [completedCOD, setCompletedCOD] = useState(false);

  const busy = useRef(false);

  useEffect(() => {
    let active = true;

    Promise.all([getBackendCart(token), getShippingAddresses(token), getPaymentMethods(token)])
      .then(([cartData, addressData, paymentMethods]) => {
        if (!active) return;

        setCart(cartData);
        setAddresses(addressData);
        setMethods(paymentMethods);
        const defaultAddr = addressData.find((item) => item.is_default) ?? addressData[0];
        if (defaultAddr) setAddressId(defaultAddr._id);
        setError("");
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : "Không thể tải dữ liệu Checkout.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    if (loading || !cart?.items.length || createdOrder) return;
    const controller = new AbortController();
    getCheckoutQuote({ shipping_method: deliveryMethod, coupon_code: requestedCoupon }, token, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setQuoteResult({ key: quoteKey, data });
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setQuoteResult({ key: quoteKey, error: cause instanceof Error ? cause.message : "Không thể kiểm tra tổng tiền." });
        }
      });
    return () => controller.abort();
  }, [cart, createdOrder, deliveryMethod, loading, quoteKey, requestedCoupon, token]);

  function handleApplyCoupon() {
    setRequestedCoupon(couponCode.trim().toUpperCase());
    setQuoteRevision((value) => value + 1);
  }

  async function handleSaveNewAddress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingAddress(true);
    setAddressError("");
    try {
      const saved = await saveShippingAddress(token, newAddress);
      setAddresses((prev) => [saved, ...prev]);
      setAddressId(saved._id);
      setShowNewAddressModal(false);
      setNewAddress(emptyShippingAddress);
    } catch (cause) {
      setAddressError(cause instanceof Error ? cause.message : "Không thể lưu địa chỉ.");
    } finally {
      setSavingAddress(false);
    }
  }

  const cartSubtotal = quote?.total_product_amount ?? cart?.total_price ?? 0;
  const shippingFee = quote?.shipping_fee;
  const discountAmount = quote?.discount_amount ?? 0;
  const finalTotal = quote?.final_amount;

  async function continuePayment(order: CreatedOrder) {
    if (!token) throw new Error("Phiên đăng nhập không hợp lệ.");

    if (order.method === "COD") {
      setCompletedCOD(true);
      return;
    }

    if (order.method === "BankTransfer") {
      router.push(`/payment/bank-transfer?orderId=${encodeURIComponent(order.id)}`);
      return;
    }

    const paymentUrl = await createOnlineCheckout(order.id, order.method, token);
    window.location.assign(paymentUrl);
  }

  async function handleSubmit() {
    if (busy.current || (!createdOrder && (!quote || !cart?.items.length || !addressId || !methods.includes(paymentMethod)))) {
      return;
    }

    busy.current = true;
    setSubmitting(true);
    setError("");

    try {
      let order = createdOrder;

      if (!order) {
        if (!quote) return;
        const response = await createBackendOrder(
          {
            address_id: addressId,
            payment_method: paymentMethod,
            note: note.trim(),
            shipping_method: deliveryMethod,
            coupon_code: requestedCoupon,
            expected_total: quote.final_amount,
          },
          token,
        );

        order = {
          id: response.order_id,
          method: paymentMethod,
        };

        setCreatedOrder(order);
        notifyCartChanged();
      }

      await continuePayment(order);
    } catch (cause) {
      if (!createdOrder) setQuoteRevision((value) => value + 1);
      setError(cause instanceof Error ? cause.message : "Không thể hoàn tất đơn hàng.");
    } finally {
      busy.current = false;
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="container" style={{ padding: 40 }}>
        <p role="status">Đang tải thông tin thanh toán...</p>
      </div>
    );
  }

  return (
    <section className="container checkout-page" style={{ paddingBottom: 64 }}>
      <h1 className="page-title">Xác nhận đơn hàng & Thanh toán</h1>

      {error && (
        <div className="cart-error-banner" role="alert">
          <p>{error}</p>
        </div>
      )}

      {createdOrder ? (
        <div className="panel" style={{ maxWidth: 640, margin: "24px auto", padding: 32, textAlign: "center" }}>
          <div style={{ fontSize: 44, color: "#267844", marginBottom: 12 }}>✓</div>
          <h2>{completedCOD ? "Đặt hàng thành công!" : "Đơn hàng đã được tạo thành công"}</h2>

          <p style={{ margin: "14px 0", fontSize: 16 }}>
            Mã đơn hàng: <strong>#{createdOrder.id.slice(-8).toUpperCase()}</strong>
          </p>

          <p className="small muted">Mã định danh hệ thống: {createdOrder.id}</p>

          <p style={{ marginTop: 12 }}>
            Phương thức thanh toán: <strong>{createdOrder.method}</strong>
          </p>

          <p style={{ margin: "16px 0", color: "#555" }}>
            {completedCOD
              ? "Cảm ơn bạn đã mua sắm tại F.Style! Đơn hàng COD của bạn đang chờ xác nhận."
              : "Vui lòng hoàn tất thanh toán để đơn hàng được xử lý ngay lập tức."}
          </p>

          {!completedCOD && (
            <button
              type="button"
              className="pill-button dark"
              disabled={submitting}
              onClick={handleSubmit}
              style={{ marginTop: 12 }}
            >
              {submitting ? "Đang xử lý..." : "Tiếp tục thanh toán"}
            </button>
          )}

          <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 24, flexWrap: "wrap" }}>
            <Link className="pill-button" href={`/orders/${encodeURIComponent(createdOrder.id)}`}>
              Xem chi tiết đơn hàng
            </Link>
            <Link className="pill-button" href="/products">
              Tiếp tục mua sắm
            </Link>
          </div>
        </div>
      ) : (
        <div className="two-column">
          {/* CỘT TRÁI: ĐỊA CHỈ, VẬN CHUYỂN, PHƯƠNG THỨC THANH TOÁN */}
          <div className="checkout-main-flow">
            {/* 1. ĐỊA CHỈ NHẬN HÀNG */}
            <section className="checkout-section">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h2 className="section-title" style={{ margin: 0 }}>
                  1. Địa chỉ nhận hàng
                </h2>
                <button
                  type="button"
                  className="pill-button small-pill"
                  onClick={() => setShowNewAddressModal(true)}
                >
                  + Thêm địa chỉ mới
                </button>
              </div>

              {!addresses.length ? (
                <div className="panel">
                  <p>Bạn chưa lưu địa chỉ giao hàng nào.</p>
                  <button
                    type="button"
                    className="pill-button dark small-pill"
                    onClick={() => setShowNewAddressModal(true)}
                  >
                    Nhập địa chỉ giao hàng
                  </button>
                </div>
              ) : (
                <div className="address-picker-grid" style={{ display: "grid", gap: 10 }}>
                  {addresses.map((addr) => {
                    const isSelected = addr._id === addressId;
                    return (
                      <label
                        key={addr._id}
                        className={`panel address-card${isSelected ? " selected" : ""}`}
                        style={{
                          display: "flex",
                          gap: 12,
                          alignItems: "flex-start",
                          cursor: "pointer",
                          padding: 14,
                          border: isSelected ? "2px solid #111" : "1px solid #ddd",
                          background: isSelected ? "#fffdfa" : "#fff",
                        }}
                      >
                        <input
                          type="radio"
                          name="shipping_address_id"
                          value={addr._id}
                          checked={isSelected}
                          onChange={() => setAddressId(addr._id)}
                          style={{ marginTop: 4, accentColor: "#111" }}
                        />
                        <div style={{ flex: 1, fontSize: 13 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <strong>{addr.receiver_name}</strong>
                            <span>({addr.receiver_phone})</span>
                            {addr.is_default && (
                              <span
                                style={{
                                  fontSize: 10,
                                  background: "#111",
                                  color: "#fff",
                                  padding: "2px 6px",
                                  borderRadius: 2,
                                }}
                              >
                                Mặc định
                              </span>
                            )}
                          </div>
                          <p style={{ margin: "4px 0 0", color: "#555" }}>
                            {formatShippingAddress(addr)}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </section>

            {/* 2. PHƯƠNG THỨC VẬN CHUYỂN */}
            <section className="checkout-section" style={{ marginTop: 24 }}>
              <h2 className="section-title">2. Phương thức vận chuyển</h2>
              <div style={{ display: "grid", gap: 10 }}>
                <label
                  className="panel"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    cursor: "pointer",
                    padding: 14,
                    border: deliveryMethod === "Standard" ? "2px solid #111" : "1px solid #ddd",
                  }}
                >
                  <input
                    type="radio"
                    name="delivery_method"
                    value="Standard"
                    checked={deliveryMethod === "Standard"}
                    onChange={() => setDeliveryMethod("Standard")}
                    style={{ accentColor: "#111" }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <strong>Giao hàng Tiêu chuẩn (2 - 4 ngày)</strong>
                      <strong>{quote ? (quote.standard_shipping_fee === 0 ? "Miễn phí" : formatVnd(quote.standard_shipping_fee)) : "—"}</strong>
                    </div>
                    <span className="small muted">
                      {quote ? `Miễn phí giao tiêu chuẩn từ ${formatVnd(quote.free_shipping_threshold)}` : "Phí giao hàng được cập nhật theo giỏ hàng."}
                    </span>
                  </div>
                </label>

                <label
                  className="panel"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    cursor: "pointer",
                    padding: 14,
                    border: deliveryMethod === "Express" ? "2px solid #111" : "1px solid #ddd",
                  }}
                >
                  <input
                    type="radio"
                    name="delivery_method"
                    value="Express"
                    checked={deliveryMethod === "Express"}
                    onChange={() => setDeliveryMethod("Express")}
                    style={{ accentColor: "#111" }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <strong>Giao hàng Hỏa tốc (1 - 2 ngày)</strong>
                      <strong>{quote ? formatVnd(quote.express_shipping_fee) : "—"}</strong>
                    </div>
                    <span className="small muted">Ưu tiên xử lý đóng gói và giao nhanh trong vòng 24 - 48h</span>
                  </div>
                </label>
              </div>
            </section>

            {/* 3. PHƯƠNG THỨC THANH TOÁN */}
            <PaymentMethodSelector
              value={paymentMethod}
              onChange={setPaymentMethod}
              available={availableMethods}
              configured={methods}
            />

            {/* 4. GHI CHÚ ĐƠN HÀNG */}
            <section className="checkout-section">
              <h2 className="section-title">4. Ghi chú giao hàng</h2>
              <textarea
                className="form-field"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Ghi chú về thời gian giao hàng, chỉ dẫn đường đi..."
                style={{ width: "100%", padding: 12 }}
              />
            </section>
          </div>

          {/* CỘT PHẢI: XEM LẠI SẢN PHẨM & TỔNG KẾT CHI PHÍ */}
          <aside className="summary-column">
            {/* DANH SÁCH SẢN PHẨM ĐẶT HÀNG */}
            <div className="panel" style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                <strong>Sản phẩm ({cart?.total_quantity ?? 0})</strong>
                <Link href="/cart" className="small" style={{ textDecoration: "underline" }}>
                  Sửa giỏ hàng
                </Link>
              </div>

              <div style={{ display: "grid", gap: 12, maxHeight: 320, overflowY: "auto", paddingRight: 4 }}>
                {cart?.items.map((item) => {
                  const variant = item.product_variant_id;
                  const productId =
                    typeof variant?.product_id === "string"
                      ? variant.product_id
                      : variant?.product_id
                        ? String(variant.product_id)
                        : "";
                  const product = products.find((p) => p.id === productId);
                  const title = product?.name ?? variant?.sku ?? "Sản phẩm";

                  return (
                    <div
                      key={item._id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "54px minmax(0, 1fr) auto",
                        gap: 10,
                        alignItems: "center",
                        fontSize: 12,
                        paddingBottom: 8,
                        borderBottom: "1px solid #eee",
                      }}
                    >
                      {product?.image ? (
                        <img
                          src={product.image}
                          alt={title}
                          style={{ width: 54, height: 68, objectFit: "cover" }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 54,
                            height: 68,
                            background: "#eee",
                            display: "grid",
                            placeItems: "center",
                            fontSize: 10,
                          }}
                        >
                          F.Style
                        </div>
                      )}

                      <div>
                        <strong style={{ display: "block", fontSize: 12, lineHeight: 1.3 }}>{title}</strong>
                        <span className="small muted">
                          Màu: {variant?.color} • Size: {variant?.size}
                        </span>
                        <div className="small">Số lượng: x{item.quantity}</div>
                      </div>

                      <div style={{ textAlign: "right" }}>
                        <strong>{formatVnd(item.subtotal)}</strong>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* MÃ GIẢM GIÁ */}
            <div className="panel" style={{ marginBottom: 16 }}>
              <strong style={{ display: "block", marginBottom: 8, fontSize: 13 }}>Mã giảm giá F.Style</strong>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="text"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  placeholder="Nhập mã giảm giá"
                  aria-label="Mã giảm giá"
                  maxLength={100}
                  style={{ flex: 1, padding: "8px 10px", fontSize: 12, border: "1px solid #ccc" }}
                />
                <button
                  type="button"
                  className="pill-button small-pill"
                  onClick={handleApplyCoupon}
                >
                  Áp dụng
                </button>
              </div>
              {requestedCoupon && (
                <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: "#267844" }}>{quote ? "✓ " : ""}{requestedCoupon}</span>
                  <button
                    type="button"
                    className="text-button small"
                    onClick={() => {
                      setRequestedCoupon("");
                      setCouponCode("");
                    }}
                  >
                    Gỡ
                  </button>
                </div>
              )}
              {quoteError && (
                <p role="alert" style={{ margin: "6px 0 0", color: "#b42318", fontSize: 12 }}>
                  {quoteError}{" "}
                  <button type="button" className="text-button" onClick={() => setQuoteRevision((value) => value + 1)}>Kiểm tra lại</button>
                </p>
              )}
            </div>

            {/* BẢNG TỔNG KẾT ĐƠN HÀNG */}
            <div className="panel">
              <div className="summary-row">
                <span>Tạm tính hàng hóa</span>
                <span>{formatVnd(cartSubtotal)}</span>
              </div>
              <div className="summary-row">
                <span>Phí giao hàng</span>
                <span>{shippingFee == null ? "—" : shippingFee === 0 ? "Miễn phí" : formatVnd(shippingFee)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="summary-row" style={{ color: "#e60012" }}>
                  <span>Giảm giá khuyến mãi</span>
                  <span>-{formatVnd(discountAmount)}</span>
                </div>
              )}
              <div className="summary-row total" style={{ fontSize: 17, fontWeight: 700 }}>
                <span>Tổng đơn đặt hàng</span>
                <span style={{ color: "#e60012" }}>{finalTotal == null ? "—" : formatVnd(finalTotal)}</span>
              </div>
            </div>

            {/* NÚT XÁC NHẬN ĐẶT HÀNG */}
            <button
              type="button"
              className="pill-button dark place-order-button"
              disabled={
                submitting ||
                !quote ||
                !cart?.items.length ||
                !addressId ||
                !methods.includes(paymentMethod)
              }
              onClick={handleSubmit}
              style={{
                width: "100%",
                marginTop: 18,
                padding: "14px 20px",
                fontSize: 15,
                fontWeight: 700,
              }}
            >
              {submitting
                ? "Đang xử lý đơn hàng..."
                : paymentMethod === "COD"
                  ? "Đặt hàng ngay (COD)"
                  : `Thanh toán qua ${paymentMethod}`}
            </button>

            <p className="small muted" style={{ marginTop: 12, textAlign: "center", lineHeight: 1.5 }}>
              Bằng việc bấm Đặt hàng, bạn đồng ý với các điều khoản mua sắm và chính sách giao nhận của F.Style.
            </p>
          </aside>
        </div>
      )}

      {/* MODAL THÊM ĐỊA CHỈ MỚI TRỰC TIẾP TẠI CHECKOUT */}
      {showNewAddressModal && (
        <div
          className="image-zoom-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Thêm địa chỉ nhận hàng mới"
          onClick={() => setShowNewAddressModal(false)}
        >
          <div
            className="image-zoom-dialog"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 520, width: "100%" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ margin: 0, fontSize: 18 }}>Thêm địa chỉ giao hàng</h2>
              <button
                type="button"
                className="text-button"
                onClick={() => setShowNewAddressModal(false)}
              >
                Đóng ×
              </button>
            </div>

            {addressError && <p style={{ color: "#b42318", fontSize: 12 }}>{addressError}</p>}

            <form onSubmit={handleSaveNewAddress} style={{ display: "grid", gap: 10, marginTop: 10 }}>
              <label className="form-field" style={{ margin: 0 }}>
                Họ và tên người nhận
                <input
                  required
                  value={newAddress.receiver_name}
                  onChange={(e) => setNewAddress({ ...newAddress, receiver_name: e.target.value })}
                  placeholder="Ví dụ: Nguyễn Văn A"
                />
              </label>

              <label className="form-field" style={{ margin: 0 }}>
                Số điện thoại
                <input
                  required
                  type="tel"
                  value={newAddress.receiver_phone}
                  onChange={(e) => setNewAddress({ ...newAddress, receiver_phone: e.target.value })}
                  placeholder="Ví dụ: 0912345678"
                />
              </label>

              <AddressLocations province={newAddress.province_code} ward={newAddress.ward_code} disabled={savingAddress}
                onChange={(province_code, ward_code) => setNewAddress({ ...newAddress, province_code, ward_code })} />

              <label className="form-field" style={{ margin: 0 }}>
                Địa chỉ chi tiết (Số nhà, tên đường)
                <input
                  required
                  value={newAddress.address_detail}
                  onChange={(e) => setNewAddress({ ...newAddress, address_detail: e.target.value })}
                  placeholder="Ví dụ: Số 12 ngõ 34 đường Cầu Giấy"
                />
              </label>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 12 }}>
                <button
                  type="button"
                  className="pill-button"
                  onClick={() => setShowNewAddressModal(false)}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="pill-button dark"
                  disabled={savingAddress || !newAddress.province_code || !newAddress.ward_code}
                >
                  {savingAddress ? "Đang lưu..." : "Lưu & Chọn địa chỉ này"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
