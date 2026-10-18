"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import ProductCard from "@/components/product/ProductCard";
import { formatVnd, products as sampleProducts } from "@/data/products";
import { addCartItem, toggleWishlist, useWishlistIds } from "@/lib/storefront-demo";
import { API_BASE_URL, mapApiProduct, readApiResponse, type ApiProduct } from "@/lib/api";
import { useCatalogProducts } from "@/lib/useCatalogProducts";
import type { Product } from "@/types/product";

import "./product.css";

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const localProduct = sampleProducts.find((item) => item.id === id);
  const [apiProduct, setApiProduct] = useState<Product | null>(null);
  const [productError, setProductError] = useState("");
  const [size, setSize] = useState(localProduct?.sizes[0] ?? "");
  const [color, setColor] = useState(localProduct?.color ?? "");
  const [added, setAdded] = useState(false);
  const wishlistIds = useWishlistIds();
  const { products } = useCatalogProducts();
  const product = apiProduct ?? localProduct;

  useEffect(() => {
    if (localProduct) return;
    let active = true;
    fetch(`${API_BASE_URL}/catalog/products/${id}`)
      .then(readApiResponse<ApiProduct>)
      .then((result) => {
        if (!active) return;
        const loadedProduct = mapApiProduct(result);
        setApiProduct(loadedProduct);
        setSize(loadedProduct.sizes[0] ?? "M");
        setColor(loadedProduct.color);
      })
      .catch((error: unknown) => {
        if (active) setProductError(error instanceof Error ? error.message : "Không thể tải sản phẩm.");
      });
    return () => { active = false; };
  }, [id, localProduct]);

  if (!product) {
    return <div className="empty-state">{productError || "Đang tải sản phẩm..."}</div>;
  }
  const favorite = wishlistIds.includes(product.id);

  return (
    <div className="container">
      <div className="breadcrumb"><Link href="/">Trang chủ</Link> / <Link href={`/products?category=${encodeURIComponent(product.category)}`}>{product.category}</Link> / {product.name}</div>
      <div className="product-detail" style={{ marginTop: 20 }}>
        <div className="gallery">
          <img src={product.image} alt={product.name} />
          <img src={(products.find((item) => item.id !== product.id) ?? product).image} alt="Ảnh chi tiết sản phẩm" />
          <img src={(products.find((item) => item.id !== product.id) ?? product).image} alt="Ảnh chất liệu sản phẩm" />
          <img src={product.image} alt="Ảnh sản phẩm từ phía sau" />
        </div>
        <section>
          <p className="product-meta">{product.code}</p>
          <h1 className="page-title" style={{ marginTop: 8 }}>{product.name}</h1>
          <div className="detail-price">{formatVnd(product.price)}</div>
          <p>★ {product.rating} · Đánh giá của khách hàng</p>
          <p>Màu sắc: <strong>{product.color}</strong></p>
          <div className="option-row">
            {[product.color, "09 BLACK", "00 WHITE"].filter((value, index, values) => values.indexOf(value) === index).map(value => <button key={value} className={`option ${color === value ? "selected" : ""}`} onClick={() => setColor(value)}>{value}</button>)}
          </div>
          <p>Kích cỡ: <strong>{size}</strong></p>
          <div className="option-row">
            {product.sizes.map(s => <button key={s} className={`option ${size === s ? "selected" : ""}`} onClick={() => setSize(s)}>{s}</button>)}
          </div>
          <button className="pill-button dark" style={{ width: "100%" }} onClick={() => { addCartItem(product.id, size, color); setAdded(true); }}>Thêm vào giỏ hàng</button>
          <button className="pill-button" style={{ width: "100%", marginTop: 10 }} onClick={() => toggleWishlist(product.id)}>{favorite ? "♥ Đã thêm vào yêu thích" : "♡ Thêm vào yêu thích"}</button>
          {added && <p role="status">Đã thêm vào giỏ hàng demo · Size {size}. <Link href="/cart"><u>Xem giỏ hàng</u></Link></p>}
          <hr style={{ border: 0, borderTop: "1px solid #ddd", margin: "24px 0" }} />
          <details open><summary>Mô tả sản phẩm</summary><p className="muted">Thông tin mô tả minh họa. Thay bằng nội dung sản phẩm chính thức của nhóm.</p></details>
          <details><summary>Chất liệu và cách bảo quản</summary><p className="muted">Bổ sung thông tin từ dữ liệu sản phẩm.</p></details>
          <details><summary>Giao hàng và đổi trả</summary><p className="muted">Đọc <Link href="/shipping">chính sách giao hàng</Link> và <Link href="/returns">đổi trả</Link>.</p></details>
        </section>
      </div>
      <section>
        <h2 className="section-title">Sản phẩm bạn có thể quan tâm</h2>
        <div className="product-grid">{products.filter((item) => item.id !== product.id).slice(0, 6).map(p => <ProductCard key={p.id} product={p} />)}</div>
      </section>
    </div>
  );
}
