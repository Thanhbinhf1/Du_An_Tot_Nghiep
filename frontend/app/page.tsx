
import "./globals.css";

const categories = [
  { label: "ÁO KHOÁC", image: "/images/categories/1.jpg" },
  { label: "ÁO THUN & ÁO GIỮ ẤM", image: "/images/categories/2.jpg" },
  { label: "ÁO NỈ & QUẦN NỈ", image: "/images/categories/3.webp" },
  { label: "ÁO LEN & CARDIGAN", image: "/images/categories/4.webp" },
  { label: "ÁO SƠ MI & ÁO POLO", image: "/images/categories/5.webp" },
  { label: "QUẦN", image: "/images/categories/6.jpg" },
  { label: "ĐỒ MẶC TRONG & TẤT", image: "/images/categories/7.jpg" },
  { label: "ĐỒ MẶC NHÀ", image: "/images/categories/8.jpg" },
  { label: "PHỤ KIỆN", image: "/images/categories/9.jpg" },
];

const brands = [
  { name: "AIRism", sub: "Thoáng mát mỗi ngày", style: "airism" },
  { name: "UV PROTECTION", sub: "Bảo vệ khỏi tia UV", style: "uv" },
  { name: "SPECIAL COLLABORATION", sub: "Bộ sưu tập đặc biệt", style: "collab" },
  { name: "LIMITED", sub: "Khuyến mãi có hạn", style: "limited" },
  { name: "SALE", sub: "Giá mới", style: "sale" },
  { name: "NEW", sub: "Hàng mới về", style: "new" },
];

const products = [
  {
    name: "Áo Polo Vải Dry Pique | Kẻ Sọc",
    price: "489.000 VND",
    old: "588.000 VND",
    image: "/images/products/1.jpg",
  },
  {
    name: "Áo Khoác Harrington",
    price: "980.000 VND",
    old: "1.275.000 VND",
    image: "/images/products/2.webp",
  },
  {
    name: "Quần Jeans EZY Siêu Co Giãn",
    price: "784.000 VND",
    old: "980.000 VND",
    image: "/images/products/3.jpg",
  },
  {
    name: "Quần Nỉ",
    price: "489.000 VND",
    old: "588.000 VND",
    image: "/images/products/4.webp",
  },
];

const basics = [
  {
    name: "AIRism Cotton Áo Thun",
    price: "391.000 VND",
    image: "/images/products/5.webp",
  },
  {
    name: "Áo Thun Vải Waffle | Cổ Henley",
    price: "391.000 VND",
    image: "/images/products/6.webp",
  },
  {
    name: "AIRism Cotton Áo Thun Dáng Rộng",
    price: "391.000 VND",
    image: "/images/products/7.webp",
  },
  {
    name: "SUPIMA COTTON Áo Thun",
    price: "391.000 VND",
    image: "/images/products/8.jpg",
  },
];

function ProductCard({
  item,
}: {
  item: {
    name: string;
    price: string;
    old?: string;
    image: string;
  };
}) {
  return (
    <article className="product-card">
      <div className="product-image-wrap">
        <img src={item.image} alt={item.name} />
        <button
          className="heart"
          aria-label={`Thêm ${item.name} vào yêu thích`}
        >
          ♡
        </button>
      </div>

      <p className="product-name">{item.name}</p>

      <div className="price-line">
        <strong>{item.price}</strong>
        {item.old && <del>{item.old}</del>}
      </div>

      {item.old && (
        <p className="promo">
          Ưu đãi có giới hạn từ 2 thg 10 - 8 thg 10 2026
        </p>
      )}
    </article>
  );
}

export default function Home() {
  return (
    <main>
      <header className="site-header">
        <a className="logo" href="/" aria-label="VCS BAPD home">
          <img src="/logo-vcs.png" alt="VCS BAPD" />
        </a>

        <nav className="main-nav">
          <a href="#">NỮ</a>
          <a href="#">NAM</a>
          <a href="#">TRẺ EM</a>
          <a href="#">EM BÉ</a>
        </nav>

        <label className="search">
          <input placeholder="Bạn đang tìm sản phẩm gì?" />
          <span>⌕</span>
        </label>

        <div className="header-actions">
          <button aria-label="Yêu thích">♡</button>
          <button aria-label="Tài khoản">♙</button>
          <button aria-label="Giỏ hàng">♧</button>
          <button aria-label="Menu">☰</button>
        </div>
      </header>

      <section className="hero">
        <img
          className="hero-image"
          src="/images/banner/1.jpg"
          alt="Bộ sưu tập thời trang LifeWear trên phố"
        />

        <div className="notice">
          Cảnh giác với lừa đảo giao hàng. Vui lòng chỉ thanh toán khi nhận
          được đơn hàng. <a href="#">Xem thêm!</a>
          <button aria-label="Đóng thông báo">×</button>
        </div>

        <div className="hero-copy">
          <span>LifeWear</span>
          <h1>Bộ Sưu Tập Áo Khoác</h1>
          <p>
            Đa dạng các lựa chọn áo khoác cho mùa mới. Thiết kế hiện đại cho
            phong cách đô thị thanh lịch.
          </p>
        </div>
      </section>

      <section className="category-section section">
        <h2>Tìm theo danh mục</h2>

        <div className="category-grid">
          {categories.map((c) => (
            <a className="category" href="#" key={c.label}>
              <img src={c.image} alt={c.label} />
              <span>{c.label}</span>
            </a>
          ))}
        </div>

        <div className="brand-grid">
          {brands.map((b) => (
            <a className="brand" href="#" key={b.name}>
              <span className={`brand-mark ${b.style}`}>{b.name}</span>
              <small>{b.sub}</small>
            </a>
          ))}
        </div>

        <a className="outline-button" href="#">
          XEM TẤT CẢ DANH MỤC SẢN PHẨM
        </a>
      </section>

      <section className="feature feature-polo">
        <img
          src="/images/banner/2.jpg"
          alt="Người mẫu mặc áo polo"
        />

        <div className="feature-copy">
          <span className="red-tag">KHUYẾN MÃI CÓ HẠN</span>
          <h2>Áo Polo Vải Dry Pique</h2>
          <p>
            Công nghệ Dry nhanh khô cùng đa dạng màu sắc và họa tiết, dễ phối
            mỗi ngày.
          </p>
          <strong>489.000 VND</strong>
          <del>588.000 VND</del>
          <small>Khuyến mãi có hạn từ 02.10 - 08.10.2026</small>
        </div>
      </section>

      <section className="product-section section">
        <div className="product-grid">
          {products.map((p) => (
            <ProductCard item={p} key={p.name} />
          ))}
        </div>
      </section>

      <section className="feature people-feature">
        <img
          src="/images/banner/3.png"
          alt="Nhóm bạn mặc trang phục thường ngày"
        />

        <div className="feature-copy light">
          <h2>LifeWear cho mọi khoảnh khắc</h2>
          <p>Thoải mái thể hiện phong cách của bạn, mỗi ngày.</p>
          <a href="#" className="white-button">
            KHÁM PHÁ BỘ SƯU TẬP
          </a>
        </div>
      </section>

      <section className="section basics-section">
        <div className="section-heading">
          <h2>Những món đồ cơ bản được yêu thích</h2>
          <a href="#">Xem tất cả →</a>
        </div>

        <div className="product-grid">
          {basics.map((p) => (
            <ProductCard item={p} key={p.name} />
          ))}
        </div>
      </section>

      <section className="feature jeans-feature">
        <img
          src="/images/banner/4.jpg"
          alt="Bộ sưu tập quần jeans"
        />

        <div className="feature-copy light">
          <h2>Bộ Sưu Tập Quần Jeans</h2>
          <p>
            Đa dạng phom dáng để bạn lựa chọn. Kết hợp cùng chiếc áo yêu thích
            để tạo phong cách riêng.
          </p>
          <a href="#" className="white-button">
            KHÁM PHÁ NGAY
          </a>
        </div>
      </section>

      <section className="section basics-section">
        <div className="section-heading">
          <h2>Áo thun cơ bản</h2>
          <a href="#">Xem tất cả →</a>
        </div>

        <div className="product-grid">
          {basics.map((p) => (
            <ProductCard item={p} key={p.name} />
          ))}
        </div>
      </section>

      <section className="feature final-feature">
        <img
          src="/images/banner/5.jpg"
          alt="Phong cách LifeWear"
        />

        <div className="feature-copy light">
          <h2>LifeWear Week</h2>
          <p>
            Trang phục dành cho cuộc sống thật. Khám phá những thiết kế yêu
            thích của bạn.
          </p>
          <a href="#" className="white-button">
            TÌM HIỂU THÊM
          </a>
        </div>
      </section>

      <footer className="footer">
        <div className="footer-art">
          <div className="tiny-people">✦　♟　♟　♟　♟　♟　♟　♟　♟　✦</div>
          <strong>LifeWear Week</strong>
        </div>

        <div className="footer-content">
          <p className="muted">Về VSC_BAPD</p>

          <div className="footer-links">
            <a href="#">Thông Tin</a>
            <a href="#">Danh Sách Cửa Hàng</a>
            <a href="#">Cơ Hội Nghề Nghiệp</a>
            <a href="#">OSS</a>
          </div>

          <p className="muted">Trợ Giúp</p>

          <div className="footer-links">
            <a href="#">Câu Hỏi Thường Gặp</a>
            <a href="#">Hướng dẫn Đổi & Trả hàng</a>
            <a href="#">Chính Sách Bảo Mật</a>
            <a href="#">Khả Năng Truy Cập</a>
          </div>

          <div className="footer-links">
            <a href="#">Tài Khoản</a>
            <a href="#">Tài Khoản Của Tôi</a>
            <a href="#">Hồ Sơ</a>
            <a href="#">Mã Giảm Giá</a>
          </div>

          <p className="delivery">
            Miễn phí giao hàng cho mọi đơn hàng online nhận tại cửa hàng hoặc
            đơn hàng từ 500.000 VND trở lên.
          </p>

          <p>Điều Khoản Sử Dụng</p>

          <p className="company">
            CÔNG TY TNHH VSC_BAPD
            <br />
            Giấy chứng nhận đăng ký doanh nghiệp số 0315304731, cấp lần đầu
            ngày 02/10/2018.
            <br />
            Địa chỉ trụ sở chính: Tầng 16, Saigon Centre, 67 Đường Lê Lợi,
            Phường Sài Gòn, Thành phố Hồ Chí Minh, Việt Nam.
            <br />
            [Trung Tâm Khách Hàng] Số Điện thoại: 028 3861 4613
          </p>

          <div className="footer-bottom">
            <span>
              Bản quyền thuộc về Công ty TNHH VSC_BAPD. Bảo lưu mọi quyền.
            </span>
            <span className="socials">●　◎　▶　♪</span>
          </div>
        </div>
      </footer>
    </main>
  );
}