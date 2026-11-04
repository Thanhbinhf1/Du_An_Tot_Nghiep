"use client";

import { useEffect, useState } from "react";
import { API_BASE_URL, readApiResponse } from "@/lib/api";
import { saveAppliedCouponCode, useAppliedCouponCode } from "@/lib/storefront-demo";

type ValidatedCoupon = {
  code: string;
  discount_amount: number;
};

type CouponValidationState = {
  code: string;
  orderAmount: number;
  coupon?: ValidatedCoupon;
  error?: string;
};

export function useCouponDiscount(orderAmount: number) {
  const storedCode = useAppliedCouponCode();
  const [validation, setValidation] = useState<CouponValidationState | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!storedCode) return;

    const controller = new AbortController();
    fetch(`${API_BASE_URL}/coupons/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: storedCode, order_amount: orderAmount }),
      signal: controller.signal,
    })
      .then(readApiResponse<ValidatedCoupon>)
      .then((validated) => setValidation({
        code: storedCode,
        orderAmount,
        coupon: validated,
      }))
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setValidation({
          code: storedCode,
          orderAmount,
          error: cause instanceof Error ? cause.message : "Không thể kiểm tra mã giảm giá.",
        });
      });

    return () => controller.abort();
  }, [orderAmount, retry, storedCode]);

  function applyCoupon(value: string) {
    const normalizedCode = value.trim().toUpperCase();
    if (!normalizedCode) {
      setValidation({ code: storedCode, orderAmount, error: "Vui lòng nhập mã giảm giá." });
      return;
    }
    if (normalizedCode === storedCode) {
      setRetry((current) => current + 1);
      return;
    }
    setValidation(null);
    saveAppliedCouponCode(normalizedCode);
  }

  function removeCoupon() {
    setValidation(null);
    saveAppliedCouponCode("");
  }

  const currentValidation = validation?.code === storedCode
    && validation.orderAmount === orderAmount
    ? validation
    : null;
  const validatedCoupon = currentValidation?.coupon ?? null;
  return {
    code: storedCode,
    coupon: validatedCoupon,
    discountAmount: validatedCoupon?.discount_amount ?? 0,
    error: currentValidation?.error ?? "",
    loading: Boolean(storedCode) && !currentValidation,
    applyCoupon,
    removeCoupon,
  };
}
