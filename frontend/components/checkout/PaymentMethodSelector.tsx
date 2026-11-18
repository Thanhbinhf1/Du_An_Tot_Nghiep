"use client";

import type { PaymentMethod } from "@/lib/order-api";

const methods: { value: PaymentMethod; label: string; description: string }[] = [
  { value: "COD", label: "Thanh toán khi nhận hàng (COD)", description: "Trả tiền khi nhận được đơn hàng." },
  { value: "BankTransfer", label: "Chuyển khoản ngân hàng", description: "Thông tin tài khoản và nội dung chuyển khoản hiển thị sau khi tạo đơn." },
  { value: "VNPay", label: "Cổng thanh toán VNPay", description: "Mở trang VNPay để thanh toán bằng phương thức bạn chọn." },
  { value: "MoMo", label: "Ví điện tử MoMo", description: "Mở cổng MoMo để xác nhận thanh toán." },
];

export default function PaymentMethodSelector({ value, onChange, available, configured = available }: {
  value: PaymentMethod;
  onChange: (method: PaymentMethod) => void;
  available: PaymentMethod[];
  configured?: PaymentMethod[];
}) {
  return (
    <fieldset className="checkout-fieldset" style={{ border: 0, padding: 0, margin: "24px 0" }}>
      <legend className="section-title">Phương thức thanh toán</legend>
      <div className="payment-methods-grid">
        {methods.map((method) => {
          const enabled = available.includes(method.value);
          const selected = value === method.value;
          return (
            <label key={method.value} className={`panel payment-method-card${selected ? " selected" : ""}`}
              style={{ display: "flex", gap: 12, alignItems: "flex-start", opacity: enabled ? 1 : .72,
                cursor: enabled ? "pointer" : "default", borderColor: selected ? "var(--red)" : undefined }}>
              <input type="radio" name="payment_method" value={method.value} checked={selected} disabled={!enabled}
                onChange={() => onChange(method.value)} />
              <span>
                <strong>{method.label}</strong>
                <span className="small muted" style={{ display: "block", marginTop: 4 }}>
                  {enabled ? method.description : configured.includes(method.value) ? "Không áp dụng cho tổng tiền đơn hàng này." : "Cửa hàng chưa kích hoạt phương thức này."}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
