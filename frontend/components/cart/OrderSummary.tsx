import { formatVnd } from "@/data/products";

export default function OrderSummary({ total, checkout = false }: { total: number; checkout?: boolean }) {
  return (
    <aside className="summary-column">
      <div className="panel">
        <div className="summary-row"><strong>Tổng đơn hàng</strong><strong>1 Sản phẩm</strong></div>
        <div className="summary-row"><span>Tạm tính</span><span>{formatVnd(total)}</span></div>
        <div className="summary-row"><span>Phí vận chuyển</span><span className="small">Sẽ được quyết định sau</span></div>
        <div className="summary-row total"><span>Tổng đơn đặt hàng</span><span>{formatVnd(total)}</span></div>
        <div className="summary-row small"><span>Đã bao gồm thuế giá trị gia tăng</span><span>{formatVnd(Math.round(total * 0.08))}</span></div>
      </div>
      <details style={{ borderBottom: "1px solid #ddd", padding: "14px 0" }}>
        <summary>▧ Áp dụng mã giảm giá</summary>
        <label className="form-field">
          Mã giảm giá
          <input placeholder="Nhập mã giảm giá" />
        </label>
        <button className="pill-button" type="button">Áp dụng</button>
      </details>
      {checkout ? null : <p className="small muted">Các sản phẩm bạn chọn sẽ được giữ trong giỏ hàng trong một khoảng thời gian giới hạn.</p>}
    </aside>
  );
}
