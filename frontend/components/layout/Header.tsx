import Link from "next/link";
export default function Header() {
  return <header className="header">
    <div className="warning-bar"><span>⚠</span> CẢNH GIÁC VỚI LỪA ĐẢO GIAO HÀNG. Chỉ thanh toán tiền mặt khi trực tiếp nhận hàng. <Link href="/checkout">Xem thêm ↗</Link></div>
    <div className="site-main nav">
      <Link href="/" className="logo" aria-label="UNIQLO trang chủ"><span>ユニ</span><span>QLO</span></Link>
      <nav className="nav-links" aria-label="Danh mục"><Link href="/cart">Nữ</Link><Link href="/cart">Nam</Link><Link href="/cart">Trẻ em</Link><Link href="/cart">Em bé</Link></nav>
      <div className="nav-actions"><Link href="/cart" aria-label="Tìm kiếm">⌕</Link><Link href="/wishlist" aria-label="Yêu thích">♡</Link><Link href="/wishlist" aria-label="Tài khoản">♙</Link><Link href="/cart" aria-label="Giỏ hàng">♧</Link><Link href="/cart" aria-label="Menu">☰</Link></div>
    </div>
  </header>;
}