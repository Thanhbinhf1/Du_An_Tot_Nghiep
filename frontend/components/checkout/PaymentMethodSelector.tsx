import type { PaymentMethod } from "@/lib/order-api";

interface Props {
  value: PaymentMethod;
  onChange: (value: PaymentMethod) => void;
}

const methods: {
  value: PaymentMethod;
  label: string;
  description: string;
}[] = [
  {
    value: "COD",
    label: "Thanh toán khi nhận hàng (COD)",
    description: "Thanh toán khi nhận sản phẩm.",
  },
  {
    value: "BankTransfer",
    label: "Chuyển khoản ngân hàng",
    description: "Chuyển khoản theo thông tin đơn hàng.",
  },
  {
    value: "VNPay",
    label: "Thanh toán VNPay",
    description: "Thanh toán trực tuyến qua VNPay.",
  },
  {
    value: "MoMo",
    label: "Ví điện tử MoMo",
    description: "Thanh toán trực tuyến qua MoMo.",
  },
];

export default function PaymentMethodSelector({ value, onChange }: Props) {
  return (
    <fieldset
      style={{
        border: 0,
        padding: 0,
        margin: "20px 0",
      }}
    >
      <legend className="section-title">2. Phương thức thanh toán</legend>

      <div style={{ display: "grid", gap: 12 }}>
        {methods.map((method) => (
          <label
            key={method.value}
            className="panel"
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
              cursor: "pointer",
              border:
                value === method.value ? "2px solid #111" : "1px solid #ddd",
            }}
          >
            <input
              type="radio"
              name="payment_method"
              value={method.value}
              checked={value === method.value}
              onChange={() => onChange(method.value)}
            />

            <span>
              <strong>{method.label}</strong>
              <span
                className="small muted"
                style={{
                  display: "block",
                  marginTop: 5,
                }}
              >
                {method.description}
              </span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
