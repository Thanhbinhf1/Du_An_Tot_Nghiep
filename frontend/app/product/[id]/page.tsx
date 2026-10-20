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
    <div className="container product-page">
      <nav className="breadcrumb product-breadcrumb" aria-label="Điều hướng">
        <Link href="/">Trang chủ</Link>
        <span aria-hidden="true">/</span>
        <Link href={`/products?category=${encodeURIComponent(product.category)}`}>{product.category}</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{product.name}</span>
      </nav>

      <div className="product-detail">
        <div className="product-gallery">
          <img className="product-main-image" src={product.image} alt={product.name} />
          <p className="product-image-caption">{product.name}</p>
        </div>

        <section className="product-info" aria-label="Thông tin sản phẩm">
          <p className="product-code">Mã sản phẩm: {product.code}</p>
          <h1 className="product-title">{product.name}</h1>
          <p className="detail-price">{formatVnd(product.price)}</p>
          <p className="product-rating" aria-label={`Đánh giá ${product.rating} trên 5`}>
            <span aria-hidden="true">★</span> {product.rating.toFixed(1)}
            <span className="rating-caption"> · Đánh giá của khách hàng</span>
          </p>

          <div className="product-option-group">
            <p className="product-option-label">Màu sắc: <strong>{color}</strong></p>
            <div className="product-color-options" role="group" aria-label="Chọn màu sắc">
              {[product.color, "09 BLACK", "00 WHITE"]
                .filter((value, index, values) => values.indexOf(value) === index)
                .map((value) => (
                  <button
                    key={value}
                    className={`product-color-option${color === value ? " selected" : ""}`}
                    type="button"
                    aria-label={value}
                    aria-pressed={color === value}
                    onClick={() => setColor(value)}
                  >
                    <span className={`color-swatch swatch-${value.toLowerCase().replace(/[^a-z]+/g, "-")}`} />
                  </button>
                ))}
            </div>
          </div>

          <div className="product-option-group">
            <div className="size-label-row">
              <p className="product-option-label">Kích cỡ: <strong>{size || "Chọn kích cỡ"}</strong></p>
              <a href="#size-guide">Hướng dẫn chọn cỡ</a>
            </div>
            <div className="product-size-options" role="group" aria-label="Chọn kích cỡ">
              {product.sizes.map((availableSize) => (
                <button
                  key={availableSize}
                  className={`product-size-option${size === availableSize ? " selected" : ""}`}
                  type="button"
                  aria-pressed={size === availableSize}
                  onClick={() => setSize(availableSize)}
                >
                  {availableSize}
                </button>
              ))}
            </div>
          </div>

          <button
            className="product-add-button"
            type="button"
            onClick={() => {
              addCartItem(product.id, size, color);
              setAdded(true);
            }}
          >
            Thêm vào giỏ hàng
          </button>
          <button
            className={`product-wishlist-button${favorite ? " active" : ""}`}
            type="button"
            aria-pressed={favorite}
            onClick={() => toggleWishlist(product.id)}
          >
            <span aria-hidden="true">{favorite ? "♥" : "♡"}</span>
            {favorite ? "Đã thêm vào yêu thích" : "Thêm vào yêu thích"}
          </button>
          {added && (
            <p className="product-added-message" role="status">
              Đã thêm vào giỏ hàng · Size {size}, màu {color}. <Link href="/cart">Xem giỏ hàng</Link>
            </p>
          )}

          <div className="product-details-list">
            <details open>
              <summary>Mô tả sản phẩm</summary>
              <p>{product.name}. Màu sắc: {product.color}. Mã sản phẩm: {product.code}.</p>
            </details>
            <details id="size-guide">
              <summary>Kích cỡ</summary>
              <p>Các kích cỡ hiện có: {product.sizes.join(", ")}. Vui lòng chọn kích cỡ phù hợp trước khi thêm vào giỏ hàng.</p>
            </details>
            <details>
              <summary>Giao hàng / Đổi trả</summary>
              <p>Xem <Link href="/shipping">chính sách giao hàng</Link> và <Link href="/returns">chính sách đổi trả</Link> của cửa hàng.</p>
            </details>
          </div>
        </section>
      </div>

      <section className="related-products">
        <h2 className="section-title">Sản phẩm bạn có thể quan tâm</h2>
        <div className="product-grid">{products.filter((item) => item.id !== product.id).slice(0, 6).map((item) => <ProductCard key={item.id} product={item} />)}</div>
      </section>
    </div>
  );
}
