"use client";

import Image from "next/image";
import Link from "next/link";
import { STORE_LOGO, STORE_NAME } from "@/lib/store-brand";
import { useStoreInfo } from "@/lib/useStoreInfo";

export default function Footer() {
  const store = useStoreInfo();
  return (
    <footer className="footer">
      <div className="footer-columns">
        <section>
          <Link href="/" className="footer-brand" aria-label={`Trang chủ ${STORE_NAME}`}>
            <Image src={STORE_LOGO} alt="" width={80} height={80} />
            <strong aria-hidden="true">{STORE_NAME}</strong>
          </Link>
          <p className="footer-about-text">
            Thời trang dễ mặc, dễ phối cho cả gia đình.
          </p>
          <div className="footer-social-links">
            <a href="https://www.facebook.com/share/1Dc9YM3Mi7/?mibextid=wwXIfr" target="_blank" rel="noreferrer" aria-label={`Facebook ${STORE_NAME}`}>
              Facebook ↗
            </a>
          </div>
        </section>

        <section>
          <h2>Mua sắm</h2>
          <div className="footer-links">
            <Link href="/products">Tất cả sản phẩm</Link>
            <Link href="/search">Tìm kiếm</Link>
            <Link href="/wishlist">Yêu thích</Link>
            <Link href="/cart">Giỏ hàng</Link>
            <Link href="/outfit">Mix &amp; Match</Link>
            <Link href="/tu-van-size">Tư vấn chọn size</Link>
          </div>
        </section>

        <section>
          <h2>Chính sách &amp; hỗ trợ</h2>
          <div className="footer-links">
            <Link href="/shipping">Chính sách giao hàng</Link>
            <Link href="/returns">Chính sách đổi & trả hàng</Link>
            <Link href="/privacy">Chính sách bảo mật</Link>
            <Link href="/terms">Điều khoản sử dụng</Link>
            <Link href="/help">Trung tâm trợ giúp</Link>
          </div>
        </section>

        <section>
          <h2>Tài khoản &amp; liên hệ</h2>
          <div className="footer-links">
            <Link href="/profile">Hồ sơ cá nhân</Link>
            <Link href="/profile/address">Sổ địa chỉ</Link>
            <Link href="/orders">Theo dõi đơn hàng</Link>
            <Link href="/contact">Liên hệ cửa hàng</Link>
            {store?.hotline && <a href={`tel:${store.hotline.replace(/[^\d+]/g, "")}`}>{store.hotline}</a>}
            {store?.email && <a href={`mailto:${store.email}`}>{store.email}</a>}
          </div>
        </section>
      </div>
      <div className="footer-bottom">
        <p className="footer-copy">© 2026 {STORE_NAME}</p>
      </div>
    </footer>
  );
}
