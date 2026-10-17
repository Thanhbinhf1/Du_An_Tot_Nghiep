import Link from "next/link";

export default function Header() {
  return (
    <header className="header">
      <div className="warning-bar">
        ⚠ CẢNH GIÁC VỚI LỪA ĐẢO GIAO HÀNG. Chỉ thanh toán tiền mặt khi trực tiếp nhận hàng.
      </div>
      <div className="site-main nav">
        <Link href="/" className="logo" aria-label="Trang chủ">ユニ<br />QLO</Link>
        <nav className="nav-links" aria-label="Danh mục">
          <a href="#nu">Nữ</a><a href="#nam">Nam</a><a href="#tre-em">Trẻ em</a><a href="#em-be">Em bé</a>
        </nav>
        <div className="nav-actions">
          <Link href="/wishlist" aria-label="Yêu thích">♡</Link>
          <Link href="/product/458824" aria-label="Sản phẩm">⌕</Link>
          <Link href="/cart" aria-label="Giỏ hàng">🛒</Link>
        </div>
      </div>
    </header>
  );
}
