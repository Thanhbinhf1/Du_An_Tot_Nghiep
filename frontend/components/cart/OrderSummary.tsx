"use client";

import { useState } from "react";
import Link from "next/link";
import { formatVnd } from "@/data/products";
import type { useCouponDiscount } from "@/lib/useCouponDiscount";

export default function OrderSummary({
  total,
  checkout = false,
  itemCount = 1,
  coupon,
}: {
  total: number;
  checkout?: boolean;
  itemCount?: number;
  coupon?: ReturnType<typeof useCouponDiscount>;
}) {
  const discountAmount = coupon?.discountAmount ?? 0;
  const discountedTotal = Math.max(0, total - discountAmount);

  return (
    <aside className="summary-column">
      <div className="panel">
        <div className="summary-row"><strong>Tổng đơn hàng</strong><strong>{itemCount} sản phẩm</strong></div>
        <div className="summary-row"><span>Tạm tính</span><span>{formatVnd(total)}</span></div>
        {discountAmount > 0 && <div className="summary-row coupon-discount"><span>Giảm giá · {coupon?.coupon?.code}</span><span>−{formatVnd(discountAmount)}</span></div>}
        <div className="summary-row"><span>Phí vận chuyển</span><span className="small">Sẽ được quyết định sau</span></div>
        <div className="summary-row total"><span>Tổng đơn đặt hàng</span><span>{formatVnd(discountedTotal)}</span></div>
        <div className="summary-row small"><span>Đã bao gồm thuế giá trị gia tăng</span><span>{formatVnd(Math.round(discountedTotal * 0.08))}</span></div>
      </div>
      {checkout ? null : (
        <Link className="pill-button dark cart-checkout-button" href="/checkout">
          Tiến hành thanh toán
        </Link>
      )}
      {coupon && <details style={{ borderBottom: "1px solid #ddd", padding: "14px 0" }}>
        <summary>▧ Áp dụng mã giảm giá</summary>
        <CouponEntry key={coupon.code} coupon={coupon} />
        {coupon.error && <p className="coupon-feedback error" role="alert">{coupon.error}</p>}
        {coupon.coupon && !coupon.error && <p className="coupon-feedback success" role="status">Đã áp dụng mã {coupon.coupon.code}. Giảm {formatVnd(coupon.discountAmount)}.</p>}
      </details>}
      {checkout ? null : <p className="small muted">Các sản phẩm bạn chọn sẽ được giữ trong giỏ hàng trong một khoảng thời gian giới hạn.</p>}
    </aside>
  );
}

function CouponEntry({ coupon }: { coupon: ReturnType<typeof useCouponDiscount> }) {
  const [couponInput, setCouponInput] = useState(coupon.code);
  return (
    <>
      <label className="form-field">Mã giảm giá
        <input value={couponInput} onChange={(event) => setCouponInput(event.target.value)} placeholder="Nhập mã giảm giá" />
      </label>
      <div className="coupon-actions">
        <button className="pill-button" type="button" disabled={coupon.loading} onClick={() => coupon.applyCoupon(couponInput)}>{coupon.loading ? "Đang kiểm tra..." : "Áp dụng"}</button>
        {coupon.code && <button className="text-button" type="button" onClick={coupon.removeCoupon}>Gỡ mã</button>}
      </div>
    </>
  );
}
