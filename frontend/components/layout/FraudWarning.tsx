export default function FraudWarning() {
  return (
    <section className="fraud-warning" aria-label="Cảnh báo lừa đảo giao hàng">
      <div className="warning-symbol" aria-hidden="true">⚠</div>
      <div>
        <h2>CẢNH BÁO</h2>
        <h3>LỪA ĐẢO GIAO HÀNG</h3>
        <p><strong>TUYỆT ĐỐI KHÔNG</strong> chuyển khoản vào tài khoản lạ hoặc tài khoản cá nhân.</p>
        <p>Chỉ thanh toán tiền mặt khi trực tiếp nhận hàng.</p>
      </div>
      <a className="pill-button red fraud-action" href="#canh-bao">Xem thêm →</a>
    </section>
  );
}
