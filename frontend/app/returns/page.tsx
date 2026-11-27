"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { API_BASE_URL, readApiResponse } from "@/lib/api";
import { useDemoAuth } from "@/lib/demo-auth";
import { useStoreInfo } from "@/lib/useStoreInfo";
import { STORE_NAME } from "@/lib/store-brand";

const ELIGIBLE_CONDITIONS = [
  "Sản phẩm còn nguyên tem, nhãn mác, hóa đơn hoặc mã đơn hàng.",
  "Chưa qua sử dụng, chưa giặt ủi, không bám mùi lạ hoặc hư hại.",
  "Yêu cầu gửi trong vòng 30 ngày kể từ ngày giao hàng thành công.",
  "Sản phẩm bị lỗi từ nhà sản xuất (rách, bung chỉ, phai màu) hoặc giao sai mẫu/size/màu.",
];

const EXCLUDED_CONDITIONS = [
  "Đồ lót, tất/vớ hoặc phụ kiện nhạy cảm đã mở niêm phong vì lý do vệ sinh.",
  "Sản phẩm đã cắt tem mác, đã chỉnh sửa dáng (lên lai, bóp eo) theo yêu cầu riêng.",
  "Sản phẩm hư hỏng do bảo quản hoặc giặt sai hướng dẫn trên nhãn sản phẩm.",
  "Quá thời hạn 30 ngày kể từ ngày nhận hàng thành công.",
];

const RETURN_STEPS = [
  { step: "01", title: "Gửi yêu cầu đổi / trả", desc: "Điền mã đơn hàng, chọn hình thức đổi size/màu hoặc trả hàng hoàn tiền ngay tại biểu mẫu bên dưới." },
  { step: "02", title: "Xác nhận điều kiện", desc: "Bộ phận CSKH kiểm tra đơn hàng và phản hồi hướng dẫn gửi hàng trong vòng 24 giờ làm việc." },
  { step: "03", title: "Gửi hàng về cửa hàng", desc: "Đóng gói sản phẩm nguyên tem mác và gửi về địa chỉ kho theo hướng dẫn." },
  { step: "04", title: "Đổi mới hoặc hoàn tiền", desc: "Sau khi kiểm tra đạt điều kiện, cửa hàng gửi sản phẩm đổi mới hoặc hoàn tiền trong 3–7 ngày làm việc." },
];

export default function ReturnsPage() {
  const { isHydrated, account } = useDemoAuth();
  const store = useStoreInfo();
  const brand = store?.store_name || STORE_NAME;

  const [name, setName] = useState("");
  const [email, setEmail] = useState(account && account.includes("@") ? account : "");
  const [orderCode, setOrderCode] = useState("");
  const [requestType, setRequestType] = useState("Đổi kích cỡ / màu sắc");
  const [details, setDetails] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [ticketId, setTicketId] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;
    setSending(true);
    setError("");
    setTicketId("");
    try {
      const composedMessage = [
        `Hình thức yêu cầu: ${requestType}`,
        `Mã đơn hàng: ${orderCode.trim().toUpperCase()}`,
        `Chi tiết: ${details.trim()}`,
      ].join("\n");

      const response = await fetch(`${API_BASE_URL}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          topic: "doi-tra",
          message: composedMessage,
        }),
      });
      const ticket = await readApiResponse<{ id: string }>(response);
      setTicketId(ticket.id);
      setOrderCode("");
      setDetails("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể gửi yêu cầu đổi trả. Vui lòng thử lại.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="info-page policy-page">
      <nav className="breadcrumb" aria-label="Điều hướng">
        <Link href="/">Trang chủ</Link> / <span aria-current="page">Chính sách đổi &amp; trả hàng</span>
      </nav>

      <header className="policy-hero">
        <h1>Chính sách đổi &amp; trả hàng</h1>
        <p className="info-intro">
          {brand} hỗ trợ đổi kích cỡ, đổi màu sắc hoặc trả hàng hoàn tiền linh hoạt trong vòng 30 ngày để bạn yên tâm mua sắm trực tuyến.
        </p>
        <div className="policy-hero-actions">
          <a href="#gui-yeu-cau-doi-tra" className="pill-button dark">Gửi yêu cầu đổi / trả</a>
          <Link href="/orders" className="pill-button">Xem đơn hàng đã mua</Link>
        </div>
      </header>

      <div className="policy-highlights" aria-label="Cam kết đổi trả">
        <article className="policy-highlight-card">
          <span className="policy-eyebrow">30 NGÀY</span>
          <h2>Đổi size &amp; màu dễ dàng</h2>
          <p>Hỗ trợ đổi kích cỡ hoặc màu sắc trong 30 ngày kể từ ngày nhận hàng với sản phẩm còn nguyên tem mác.</p>
        </article>
        <article className="policy-highlight-card">
          <span className="policy-eyebrow">MIỄN PHÍ</span>
          <h2>Lỗi từ cửa hàng / NSX</h2>
          <p>Miễn 100% chi phí vận chuyển 2 chiều nếu sản phẩm lỗi kỹ thuật hoặc giao nhầm mẫu, nhầm size.</p>
        </article>
        <article className="policy-highlight-card">
          <span className="policy-eyebrow">MINH BẠCH</span>
          <h2>Hoàn tiền 3 – 7 ngày</h2>
          <p>Hoàn tiền theo phương thức thanh toán ban đầu hoặc chuyển khoản ngân hàng sau khi kho xác nhận hàng hoàn.</p>
        </article>
      </div>

      <section className="policy-section" aria-labelledby="return-conditions-title">
        <h2 id="return-conditions-title">Điều kiện áp dụng đổi trả</h2>
        <div className="policy-two-col">
          <article className="policy-condition-card eligible">
            <h3>✓ Trường hợp được hỗ trợ</h3>
            <ul>
              {ELIGIBLE_CONDITIONS.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
          <article className="policy-condition-card excluded">
            <h3>✕ Trường hợp không áp dụng</h3>
            <ul>
              {EXCLUDED_CONDITIONS.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        </div>
      </section>

      <section className="policy-section" aria-labelledby="return-steps-title">
        <h2 id="return-steps-title">Quy trình đổi trả 4 bước</h2>
        <div className="policy-steps">
          {RETURN_STEPS.map((item) => (
            <article className="policy-step-card" key={item.step}>
              <span className="policy-step-num">{item.step}</span>
              <h3>{item.title}</h3>
              <p>{item.desc}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="policy-section" id="gui-yeu-cau-doi-tra" aria-labelledby="return-form-title">
        <h2 id="return-form-title">Gửi yêu cầu đổi / trả hàng trực tuyến</h2>
        <p className="policy-section-sub">
          Điền thông tin đơn hàng bên dưới. Yêu cầu sẽ được chuyển trực tiếp tới bộ phận Chăm sóc khách hàng của {brand}.
        </p>

        <form className="policy-return-form" onSubmit={handleSubmit}>
          <div className="policy-form-grid">
            <label className="policy-field">
              <span>Họ và tên *</span>
              <input
                required
                maxLength={120}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nguyễn Văn A"
              />
            </label>

            <label className="policy-field">
              <span>Email liên hệ *</span>
              <input
                type="email"
                required
                maxLength={254}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
              />
            </label>

            <label className="policy-field">
              <span>Mã đơn hàng *</span>
              <input
                required
                maxLength={50}
                value={orderCode}
                onChange={(e) => setOrderCode(e.target.value)}
                placeholder="VD: #D1DA1747"
              />
            </label>

            <label className="policy-field">
              <span>Hình thức yêu cầu *</span>
              <select value={requestType} onChange={(e) => setRequestType(e.target.value)}>
                <option value="Đổi kích cỡ / màu sắc">Đổi kích cỡ / màu sắc</option>
                <option value="Trả hàng & hoàn tiền">Trả hàng &amp; hoàn tiền</option>
                <option value="Sản phẩm lỗi / giao sai mẫu">Sản phẩm lỗi / giao sai mẫu</option>
              </select>
            </label>
          </div>

          <label className="policy-field">
            <span>Chi tiết sản phẩm &amp; lý do đổi trả *</span>
            <textarea
              required
              rows={4}
              maxLength={2500}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Ghi rõ tên sản phẩm, size/màu muốn đổi hoặc mô tả tình trạng sản phẩm..."
            />
          </label>

          {error && <p className="cancel-order-error" role="alert">{error}</p>}
          {ticketId && (
            <p className="product-added-message" role="status">
              Đã tiếp nhận yêu cầu đổi trả thành công! Mã hồ sơ hỗ trợ: <strong>{ticketId}</strong>. Cửa hàng sẽ liên hệ qua email trong 24 giờ làm việc.
            </p>
          )}

          <div className="policy-form-footer">
            <button type="submit" className="pill-button dark" disabled={!isHydrated || sending}>
              {sending ? "Đang gửi yêu cầu..." : "Gửi yêu cầu đổi / trả"}
            </button>
            <Link href="/shipping" className="pill-button">Xem chính sách giao hàng</Link>
          </div>
        </form>
      </section>
    </section>
  );
}
