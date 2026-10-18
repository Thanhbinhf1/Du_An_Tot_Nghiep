import Link from "next/link";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-columns">
        <section><strong>Mua sắm</strong><div className="footer-links"><Link href="/products">Tất cả sản phẩm</Link><Link href="/search">Tìm kiếm</Link><Link href="/wishlist">Yêu thích</Link><Link href="/cart">Giỏ hàng</Link></div></section>
        <section><strong>Tài khoản</strong><div className="footer-links"><Link href="/profile">Hồ sơ</Link><Link href="/profile/address">Sổ địa chỉ</Link><Link href="/orders">Đơn hàng</Link><Link href="/dang-nhap">Đăng nhập</Link></div></section>
        <section><strong>Hỗ trợ khách hàng</strong><div className="footer-links"><Link href="/help">Trung tâm trợ giúp</Link><Link href="/contact">Liên hệ</Link><Link href="/shipping">Giao hàng</Link><Link href="/returns">Đổi & Trả hàng</Link></div></section>
        <section><strong>Chính sách</strong><div className="footer-links"><Link href="/privacy">Bảo mật</Link><Link href="/terms">Điều khoản sử dụng</Link></div></section>
      </div>
      <p>Giao hàng và thanh toán hiện được mô phỏng trong phiên bản demo.</p>
      <p className="footer-copy">© BAPD · Giao diện cửa hàng thời trang demo.</p>
    </footer>
  );
}
