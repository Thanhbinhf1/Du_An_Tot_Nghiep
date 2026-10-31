"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { productCategories } from "@/data/categories";
import { API_BASE_URL, readApiResponse, type ApiCategory } from "@/lib/api";
import { useCatalogProducts } from "@/lib/useCatalogProducts";
import "./home.css";
import "./home-categories.css";

const campaigns = [
 {title:"Mặc đẹp mỗi ngày", subtitle:"Những thiết kế thoải mái cho cuộc sống thường nhật.", image:"https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1800&q=85", tag:"LIFEWEAR"},
 {title:"Phong cách của riêng bạn", subtitle:"Khám phá những món đồ dễ phối cho mùa mới.", image:"https://images.unsplash.com/photo-1523398002811-999ca8dec234?auto=format&fit=crop&w=1800&q=85", tag:"NEW ARRIVALS"},
 {title:"Cùng nhau tạo nên phong cách", subtitle:"Các thiết kế đơn giản, linh hoạt cho mọi ngày.", image:"https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1800&q=85", tag:"COLLECTION"},
 {title:"Thoải mái trong từng chuyển động", subtitle:"Chất liệu và kiểu dáng phù hợp với nhịp sống năng động.", image:"https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1800&q=85", tag:"FEATURED"}
];
const categorySubcategories: Record<string, string[]> = {
  nam: ["Áo thun", "Áo sơ mi", "Áo polo", "Áo len", "Áo khoác", "Quần jeans", "Quần dài", "Quần short"],
  nu: ["Áo thun", "Áo sơ mi", "Áo len", "Áo khoác", "Váy", "Quần dài", "Quần short", "Đồ mặc nhà"],
  "tre-em": ["Áo thun", "Áo sơ mi", "Áo khoác", "Áo len", "Quần dài", "Quần short", "Đồ mặc nhà"],
  "em-be": ["Áo em bé", "Quần em bé", "Bộ đồ em bé", "Đồ liền thân", "Đồ mặc nhà", "Đồ giữ ấm"],
};
const categoryImages: Record<string, string> = {
  nam: "/images/categories/nam1.webp",
  nu: "/images/categories/nu1.jpg",
  "tre-em": "/images/categories/treem4.webp",
  "em-be": "/images/categories/embe1.jpg",
};
const categoryOrder = ["nam", "nu", "tre-em", "em-be"];
export default function HomePage(){
  const { products, error: productError } = useCatalogProducts();
  const [categories, setCategories] = useState<Array<Pick<ApiCategory, "name" | "slug">>>(
    productCategories.map(({ name, slug }) => ({ name, slug })),
  );
  const [categoryError, setCategoryError] = useState("");

  useEffect(() => {
    let active = true;
    fetch(`${API_BASE_URL}/catalog/categories`)
      .then(readApiResponse<ApiCategory[]>)
      .then((items) => {
        if (active && items.length) {
          setCategories([...items].sort((first, second) => {
            const firstOrder = categoryOrder.indexOf(first.slug);
            const secondOrder = categoryOrder.indexOf(second.slug);
            return (firstOrder < 0 ? categoryOrder.length : firstOrder)
              - (secondOrder < 0 ? categoryOrder.length : secondOrder);
          }));
        }
      })
      .catch((error: unknown) => {
        if (active) setCategoryError(error instanceof Error ? error.message : "Không thể tải danh mục.");
      });
    return () => { active = false; };
  }, []);

  return <div className="home-page">
  <section className="home-hero"><img src="https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=2000&q=90" alt="Bộ sưu tập thời trang mới"/><div className="hero-copy"><span>NEW SEASON</span><h1>LifeWear<br/>for everyone</h1><p>Thiết kế tối giản, thoải mái cho mỗi ngày.</p><Link className="hero-button" href="/product/458824">KHÁM PHÁ NGAY</Link></div></section>
  {(productError || categoryError) && <p role="status" className="catalog-result-count">Đang hiển thị dữ liệu mẫu. {productError || categoryError}</p>}
  <section className="category-section">
    <h2>Khám phá theo danh mục</h2>
    <div className="category-grid">
      {categories.map((category) => (
        <div className="category-item" key={category.slug}>
          <Link className="category-main-link" href={`/categories/${category.slug}`}>
            <img
              className="category-image"
              src={categoryImages[category.slug] ?? "/images/categories/1.jpg"}
              alt={category.name}
            />
            <span className="category-name">{category.name}</span>
          </Link>
          {(categorySubcategories[category.slug] ?? []).length > 0 && (
            <details className="category-subcategories">
              <summary>Danh mục con</summary>
              <div className="category-subcategory-list" aria-label={`Danh mục con ${category.name}`}>
                {(categorySubcategories[category.slug] ?? []).map((subcategory) => {
                  const query = new URLSearchParams({ category: category.name, q: subcategory });
                  return (
                    <Link href={`/products?${query.toString()}`} key={subcategory}>
                      {subcategory}
                    </Link>
                  );
                })}
              </div>
            </details>
          )}
        </div>
      ))}
    </div>
    <Link className="category-more" href="/products">XEM TẤT CẢ DANH MỤC SẢN PHẨM</Link>
  </section>
  {campaigns.map((c,i)=><section className={'campaign-block campaign-'+i} key={c.tag}><Link href="/products" className="campaign-banner"><img src={c.image} alt={c.title}/><div className="campaign-copy"><span>{c.tag}</span><h2>{c.title}</h2><p>{c.subtitle}</p><b>KHÁM PHÁ THÊM　→</b></div></Link>{i===0||i===1?<div className="home-products"><div className="section-heading"><h2>{i===0?"Được yêu thích":"Sản phẩm nổi bật"}</h2><Link href="/products">Xem tất cả →</Link></div><div className="home-product-grid">{products.slice(i, i+4).map((x)=><Link className="home-product" href={`/product/${x.id}`} key={x.id}><img src={x.image} alt={x.name}/><div className="home-product-meta">{x.color} · XS–XL</div><h3>{x.name}</h3><strong>{new Intl.NumberFormat("vi-VN").format(x.price)} VND</strong><div className="home-rating">★ {x.rating} <span>(99+)</span></div></Link>)}</div></div>:null}</section>)}
  <section className="lifewear-panel"><div><span>UNIQLO SPECIAL</span><h2>LifeWear Week</h2><p>Những món đồ thiết yếu để hoàn thiện phong cách của bạn.</p><Link className="hero-button" href="/products">MUA SẮM NGAY</Link></div><img src="https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1200&q=85" alt="LifeWear Week"/></section>
</div>
}
