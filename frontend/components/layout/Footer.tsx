import Link from "next/link";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-columns">
        <section>
          <strong>Giới thiệu VSC_BAPD</strong>
          <p className="footer-about-text">
            VSC_BAPD là thương hiệu thời trang hiện đại mang đến các thiết kế tối giản,
            chất liệu thoải mái và dễ dàng phối đồ cho Nam, Nữ và Trẻ em mỗi ngày.
          </p>
          <div className="footer-links">
            <Link href="/products">Tất cả sản phẩm</Link>
            <Link href="/search">Tìm kiếm</Link>
            <Link href="/wishlist">Yêu thích</Link>
            <Link href="/cart">Giỏ hàng</Link>
          </div>
        </section>

        <section>
          <strong>Chính sách & Hỗ trợ</strong>
          <div className="footer-links">
            <Link href="/shipping">Chính sách giao hàng</Link>
            <Link href="/returns">Chính sách đổi & trả hàng</Link>
            <Link href="/privacy">Chính sách bảo mật</Link>
            <Link href="/terms">Điều khoản sử dụng</Link>
            <Link href="/help">Trung tâm trợ giúp</Link>
          </div>
        </section>

        <section>
          <strong>Tài khoản & Liên hệ</strong>
          <div className="footer-links">
            <Link href="/profile">Hồ sơ cá nhân</Link>
            <Link href="/profile/address">Sổ địa chỉ</Link>
            <Link href="/orders">Theo dõi đơn hàng</Link>
            <Link href="/contact">Liên hệ cửa hàng</Link>
            <span>Hotline: 1900 6868 (8:00 – 22:00)</span>
            <span>Email: cskh@fstyle.vn</span>
          </div>
        </section>

        <section>
          <strong>Kết nối mạng xã hội</strong>
          <p className="footer-about-text">
            Theo dõi VSC_BAPD để cập nhật bộ sưu tập mới và ưu đãi độc quyền mỗi tuần.
          </p>
          <div className="footer-social-links" aria-label="Mạng xã hội VSC_BAPD">
            <a href="https://www.facebook.com/share/1Dc9YM3Mi7/?mibextid=wwXIfr" target="_blank" rel="noreferrer" aria-label="Facebook VSC_BAPD">
              Facebook
            </a>
            <a href="https://www.facebook.com/share/1Dc9YM3Mi7/?mibextid=wwXIfr" target="_blank" rel="noreferrer" aria-label="Instagram VSC_BAPD">
              Instagram
            </a>
            <a href="https://www.facebook.com/share/1Dc9YM3Mi7/?mibextid=wwXIfr" target="_blank" rel="noreferrer" aria-label="TikTok VSC_BAPD">
              TikTok
            </a>
            <a href="https://www.facebook.com/share/1Dc9YM3Mi7/?mibextid=wwXIfr" target="_blank" rel="noreferrer" aria-label="YouTube VSC_BAPD">
              YouTube
            </a>
          </div>
        </section>
      </div>
      <div className="footer-bottom">
        <p className="footer-copy">© 2026 VSC_BAPD Store — Mặc đẹp mỗi ngày. Bảo lưu mọi quyền.</p>
      </div>
    </footer>
  );
}
