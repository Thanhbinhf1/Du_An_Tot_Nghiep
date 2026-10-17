const categories = [
  ["ÁO THUN", "Tops"], ["ÁO POLO", "Polo"], ["ÁO SƠ MI", "Shirts"],
  ["ÁO KHOÁC", "Outerwear"], ["ÁO LEN", "Knitwear"], ["QUẦN", "Bottoms"],
  ["JEANS", "Denim"], ["ĐỒ MẶC NHÀ", "Loungewear"], ["ĐỒ THỂ THAO", "Sport"],
  ["PHỤ KIỆN", "Accessories"], ["LIFEWEAR", "LifeWear"], ["ƯU ĐÃI", "Offers"],
];
const campaigns = [
  { image: "/images/campaign/green-collection.jpg", eyebrow: "NEW ARRIVALS", title: "Áo Polo Dry Pique", subtitle: "Thoải mái mỗi ngày", cta: "KHÁM PHÁ NGAY", products: true },
  { image: "/images/campaign/friends-knit.jpg", eyebrow: "LIFEWEAR", title: "Phong cách của chúng ta", subtitle: "Những thiết kế dành cho mọi khoảnh khắc", cta: "TÌM HIỂU THÊM" },
  { image: "/images/campaign/friends-outdoor.jpg", eyebrow: "SPRING / SUMMER", title: "Mặc đẹp theo cách của bạn", subtitle: "Dễ phối đồ, dễ vận động, dễ chịu cả ngày", cta: "XEM BỘ SƯU TẬP", products: true },
  { image: "/images/campaign/denim-group.jpg", eyebrow: "DENIM EDIT", title: "Denim cho mọi ngày", subtitle: "Phom dáng hiện đại, cảm giác thoải mái", cta: "KHÁM PHÁ DENIM" },
  { image: "/images/campaign/blue-shirt.jpg", eyebrow: "NEW SEASON", title: "Đơn giản là đẹp", subtitle: "Những món đồ cơ bản không thể thiếu", cta: "MUA NGAY", products: true },
  { image: "/images/campaign/guitar-style.jpg", eyebrow: "YOUR LIFEWEAR", title: "Tự do thể hiện cá tính", subtitle: "Chất liệu và kiểu dáng cho phong cách riêng", cta: "KHÁM PHÁ" },
  { image: "/images/campaign/couple-casual.jpg", eyebrow: "EVERYDAY STYLE", title: "Cùng nhau tạo nên phong cách", subtitle: "Trang phục cho những ngày bình thường thật đẹp", cta: "XEM THÊM" },
  { image: "/images/campaign/knitwear.jpg", eyebrow: "COMFORT FIRST", title: "Ấm áp từ những điều giản dị", subtitle: "Chất liệu mềm mại, kiểu dáng vượt thời gian", cta: "KHÁM PHÁ NGAY" },
  { image: "/images/campaign/winter-jacket.jpg", eyebrow: "SEASONAL PICKS", title: "Sẵn sàng cho mọi thời tiết", subtitle: "Lớp áo nhẹ, ấm và linh hoạt", cta: "XEM BỘ SƯU TẬP" },
  { image: "/images/campaign/lifewear-week.jpg", eyebrow: "UNIQLO", title: "LifeWear Week", subtitle: "Trang phục tốt hơn cho cuộc sống tốt hơn", cta: "TÌM HIỂU THÊM", gold: true },
];
const productImages = [
  ["/images/polo-brown.jpg", "Áo Polo Cotton", "588.000 VND"],
  ["/images/jacket-sage.jpg", "Áo khoác dáng ngắn", "1.471.000 VND"],
  ["/images/shirt-cream.jpg", "Áo thun tay dài", "391.000 VND"],
  ["/images/sweater-green.jpg", "Áo len LifeWear", "790.000 VND"],
];
function ProductStrip({ title = "Gợi ý dành cho bạn" }: { title?: string }) {
  return <section className="home-products"><div className="section-heading"><h2>{title}</h2><a href="/product/458824">Xem tất cả <span>→</span></a></div><div className="home-product-grid">{productImages.map(([src,name,price])=><a className="home-product" href="/product/458824" key={name}><img src={src} alt={name}/><div className="swatches"><i/><i/><i/><i/><span>♡</span></div><p className="muted">Nam, XS–XXL</p><h3>{name}</h3><strong>{price}</strong><small>★ 4.8 (120+)</small></a>)}</div></section>;
}
export default function Home() {
  return <main className="home-page">
    <section className="home-hero"><img src="/images/campaign/hero-city.jpg" alt="Bộ sưu tập thời trang đường phố"/><div className="hero-copy"><span>LifeWear / New season</span><h1>Đơn giản, thoải mái<br/>mỗi ngày</h1><p>Những thiết kế dành cho cuộc sống chuyển động.</p><a href="/product/458824" className="hero-button">KHÁM PHÁ NGAY</a></div><div className="hero-dots">●　○　○　○</div></section>
    <section className="category-section"><div className="section-heading"><h2>THỂ LOẠI</h2><a href="/product/458824">Xem tất cả →</a></div><div className="category-grid">{categories.map(([name,sub],i)=><a href="/product/458824" className="category-item" key={name}><span className={"category-icon icon-"+i}>{["◉","▱","▥","♧","♨","▤","▰","⌂","◌","◇","U","★"][i]}</span><strong>{name}</strong><small>{sub}</small></a>)}</div><a className="outline-pill" href="/product/458824">XEM TẤT CẢ SẢN PHẨM</a></section>
    {campaigns.map((c,i)=><div className="campaign-block" key={c.image}>
      <a className={"campaign-banner "+(c.gold?"gold-banner":"")} href="/product/458824"><img src={c.image} alt={c.title}/><div className="campaign-copy"><span>{c.eyebrow}</span><h2>{c.title}</h2><p>{c.subtitle}</p><b>{c.cta}　→</b></div></a>
      {c.products && <ProductStrip title={i===0?"Mới nhất":i===2?"Phong cách nổi bật":"Được yêu thích"}/>}
    </div>)}
    <section className="lifewear-panel"><div><span>LifeWear</span><h2>Trang phục tốt hơn<br/>cho cuộc sống tốt hơn.</h2><p>Thiết kế tinh giản, chất lượng bền lâu và sự thoải mái mỗi ngày.</p><a href="/product/458824">KHÁM PHÁ LIFEWEAR →</a></div><img src="/images/campaign/lifewear-week.jpg" alt="LifeWear Week"/></section>

  </main>;
}
