"use client";

import Link from "next/link";
import { useStoreInfo } from "@/lib/useStoreInfo";
import { STORE_NAME } from "@/lib/store-brand";

const SHIPPING_ZONES = [
  {
    zone: "Nội thành Hà Nội & TP. HCM",
    standardTime: "1 – 2 ngày làm việc",
    standardFee: "30.000 VND (Miễn phí từ 500.000 VND)",
    expressTime: "2 – 4 giờ (khu vực hỗ trợ)",
  },
  {
    zone: "Ngoại thành Hà Nội & TP. HCM",
    standardTime: "2 – 3 ngày làm việc",
    standardFee: "30.000 VND (Miễn phí từ 500.000 VND)",
    expressTime: "Trong ngày / Hôm sau",
  },
  {
    zone: "Các tỉnh / thành phố khác",
    standardTime: "3 – 5 ngày làm việc",
    standardFee: "30.000 VND (Miễn phí từ 500.000 VND)",
    expressTime: "Theo đơn vị vận chuyển",
  },
];

const DELIVERY_STEPS = [
  { step: "01", title: "Xác nhận đơn hàng", desc: "Hệ thống ghi nhận đơn ngay sau khi bạn hoàn tất thanh toán hoặc xác nhận COD." },
  { step: "02", title: "Kiểm tra & đóng gói", desc: "Sản phẩm được kiểm tra chất lượng, giữ nguyên tem mác và đóng gói tiêu chuẩn." },
  { step: "03", title: "Bàn giao vận chuyển", desc: "Trạng thái đơn tự động chuyển sang Đang giao trong mục Đơn hàng của tôi." },
  { step: "04", title: "Nhận hàng & kiểm tra", desc: "Bạn kiểm tra ngoại quan gói hàng, đối chiếu sản phẩm và hoàn tất nhận hàng." },
];

const SHIPPING_FAQS = [
  {
    q: "Làm sao để được miễn phí vận chuyển?",
    a: "Đơn hàng giao tiêu chuẩn đạt ngưỡng tối thiểu 500.000 VND sẽ được tự động miễn phí vận chuyển ở bước Thanh toán.",
  },
  {
    q: "Tôi có thể đổi địa chỉ sau khi đã đặt hàng không?",
    a: "Nếu đơn đang ở trạng thái Chờ xác nhận, bạn có thể hủy đơn và đặt lại với địa chỉ mới, hoặc liên hệ ngay bộ phận chăm sóc khách hàng để được hỗ trợ.",
  },
  {
    q: "Tôi không có mặt lúc bưu tá gọi giao hàng thì sao?",
    a: "Đơn vị vận chuyển sẽ liên hệ lại tối đa 2–3 lần trong các ngày tiếp theo. Nếu không thể giao thành công, đơn hàng sẽ được hoàn về kho cửa hàng.",
  },
  {
    q: "Làm cách nào để theo dõi tiến trình giao hàng?",
    a: "Đăng nhập tài khoản và truy cập mục Đơn hàng của tôi để xem tiến trình chi tiết từ Chờ xác nhận đến Hoàn thành.",
  },
];

export default function ShippingPage() {
  const store = useStoreInfo();
  const brand = store?.store_name || STORE_NAME;

  return (
    <section className="info-page policy-page">
      <nav className="breadcrumb" aria-label="Điều hướng">
        <Link href="/">Trang chủ</Link> / <span aria-current="page">Chính sách giao hàng</span>
      </nav>

      <header className="policy-hero">
        <h1>Chính sách giao hàng</h1>
        <p className="info-intro">
          {brand} giao hàng toàn quốc với quy trình đóng gói chuẩn, minh bạch cước phí và cập nhật trạng thái trực tuyến theo từng bước.
        </p>
        <div className="policy-hero-actions">
          <Link href="/orders" className="pill-button dark">Theo dõi đơn hàng của tôi</Link>
          <Link href="/profile/address" className="pill-button">Quản lý sổ địa chỉ</Link>
        </div>
      </header>

      <div className="policy-highlights" aria-label="Điểm nổi bật giao hàng">
        <article className="policy-highlight-card">
          <span className="policy-eyebrow">TIÊU CHUẨN</span>
          <h2>Miễn phí từ 500.000đ</h2>
          <p>Phí giao hàng tiêu chuẩn 30.000 VND toàn quốc. Tự động miễn phí khi giá trị đơn đạt ngưỡng áp dụng.</p>
        </article>
        <article className="policy-highlight-card">
          <span className="policy-eyebrow">HỎA TỐC</span>
          <h2>Nhận nhanh 2 – 4 giờ</h2>
          <p>Áp dụng tại các khu vực nội thành được hỗ trợ trong khung giờ hành chính, phí 45.000 VND.</p>
        </article>
        <article className="policy-highlight-card">
          <span className="policy-eyebrow">AN TÂM</span>
          <h2>Kiểm tra ngoại quan</h2>
          <p>Khách hàng được kiểm tra tình trạng niêm phong, đúng mẫu mã và số lượng trước khi thanh toán COD.</p>
        </article>
      </div>

      <section className="policy-section" aria-labelledby="shipping-rates-title">
        <h2 id="shipping-rates-title">Thời gian &amp; biểu phí dự kiến</h2>
        <div className="policy-table-wrap">
          <table className="policy-table">
            <thead>
              <tr>
                <th>Khu vực giao hàng</th>
                <th>Giao tiêu chuẩn</th>
                <th>Cước phí tiêu chuẩn</th>
                <th>Giao hỏa tốc</th>
              </tr>
            </thead>
            <tbody>
              {SHIPPING_ZONES.map((row) => (
                <tr key={row.zone}>
                  <td><strong>{row.zone}</strong></td>
                  <td>{row.standardTime}</td>
                  <td>{row.standardFee}</td>
                  <td>{row.expressTime}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="policy-footnote">
          * Thời gian giao hàng thực tế có thể thay đổi vào dịp lễ, Tết hoặc điều kiện thời tiết bất khả kháng. Phí vận chuyển chính xác được tính tự động tại bước Thanh toán theo địa chỉ nhận hàng.
        </p>
      </section>

      <section className="policy-section" aria-labelledby="shipping-steps-title">
        <h2 id="shipping-steps-title">Quy trình xử lý &amp; giao nhận</h2>
        <div className="policy-steps">
          {DELIVERY_STEPS.map((item) => (
            <article className="policy-step-card" key={item.step}>
              <span className="policy-step-num">{item.step}</span>
              <h3>{item.title}</h3>
              <p>{item.desc}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="policy-section" aria-labelledby="shipping-faq-title">
        <h2 id="shipping-faq-title">Câu hỏi thường gặp về giao hàng</h2>
        <div className="policy-faq-list">
          {SHIPPING_FAQS.map((item) => (
            <details key={item.q} className="policy-faq-item">
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <div className="policy-support-strip">
        <div>
          <h3>Cần hỗ trợ thêm về đơn hàng đang giao?</h3>
          <p>
            {store?.hotline ? `Hotline: ${store.hotline}` : "Đội ngũ chăm sóc khách hàng luôn sẵn sàng hỗ trợ"}
            {store?.email ? ` · Email: ${store.email}` : ""}
          </p>
        </div>
        <div className="policy-support-actions">
          <Link href="/returns" className="pill-button">Xem chính sách đổi trả</Link>
          <Link href="/contact" className="pill-button dark">Liên hệ hỗ trợ</Link>
        </div>
      </div>
    </section>
  );
}
