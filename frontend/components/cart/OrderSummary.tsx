import Link from "next/link";
import { formatVnd } from "@/data/products";

export default function OrderSummary({
  total,
  checkout = false,
  itemCount = 1,
}: {
  total: number;
  checkout?: boolean;
  itemCount?: number;
}) {
  return (
    <aside className="summary-column">
      <div className="panel">
        <div className="summary-row">
          <strong>Giỏ hàng</strong>
          <strong>{itemCount} sản phẩm</strong>
        </div>
        <div className="summary-row total">
          <span>Tạm tính tiền hàng</span>
          <span>{formatVnd(total)}</span>
        </div>
        {!checkout && <p className="small muted">Phí giao hàng và mã giảm giá được tính ở bước thanh toán.</p>}
      </div>
      {!checkout && (
        <Link className="pill-button dark cart-checkout-button" href="/checkout">
          Tiến hành thanh toán
        </Link>
      )}
    </aside>
  );
}
