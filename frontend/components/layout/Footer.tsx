import Link from "next/link";
export default function Footer() {
  return <footer className="footer"><div className="footer-inner">
    <div className="footer-top"><Link href="/" className="footer-logo">UNIQLO</Link><span>LifeWear — Trang phục cho cuộc sống.</span></div>
    <div className="footer-columns">
      <section><h3>Về UNIQLO</h3><Link href="/">Thông tin</Link><Link href="/">Danh sách cửa hàng</Link><Link href="/">Cơ hội nghề nghiệp</Link><Link href="/">Tin tức</Link></section>
      <section><h3>Trợ giúp</h3><Link href="/">Câu hỏi thường gặp</Link><Link href="/">Hướng dẫn đổi & trả hàng</Link><Link href="/">Chính sách bảo mật</Link><Link href="/">Khả năng truy cập</Link></section>
      <section><h3>Tài khoản</h3><Link href="/wishlist">Tài khoản của tôi</Link><Link href="/wishlist">Hồ sơ</Link><Link href="/wishlist">Yêu thích</Link><Link href="/cart">Giỏ hàng</Link></section>
      <section className="footer-news"><h3>Đăng ký nhận tin</h3><p>Cập nhật bộ sưu tập mới và ưu đãi từ LifeWear.</p><form action="/cart"><label className="newsletter"><input type="email" placeholder="Địa chỉ email" aria-label="Địa chỉ email"/><button type="submit" aria-label="Đăng ký">→</button></label></form></section>
    </div>
    <p className="shipping-note">Miễn phí giao hàng cho đơn hàng online nhận tại cửa hàng hoặc đơn hàng từ 500.000 VND trở lên.</p>
    <div className="footer-bottom"><span>© Công ty TNHH UNIQLO Việt Nam. Bảo lưu mọi quyền.</span><div><Link href="/">Điều khoản sử dụng</Link><Link href="/">Cài đặt Cookie</Link><span className="socials">◎　◉　▷</span></div></div>
  </div></footer>;
}