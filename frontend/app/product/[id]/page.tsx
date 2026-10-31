"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import ProductCard from "@/components/product/ProductCard";
import ProductReviews from "@/components/product/ProductReviews";
import { formatVnd, products as sampleProducts } from "@/data/products";
import { addCartItem, toggleWishlist, useWishlistIds } from "@/lib/storefront-demo";
import { useDemoAuth } from "@/lib/demo-auth";
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
  const [quantity, setQuantity] = useState(1);
  const [variantImage, setVariantImage] = useState<{ key: string; src: string } | null>(null);
  const [imageError, setImageError] = useState<{ key: string; message: string } | null>(null);
  const [added, setAdded] = useState(false);
  const wishlistIds = useWishlistIds();
  const { isLoggedIn } = useDemoAuth();
  const { products } = useCatalogProducts();
  const product = apiProduct ?? localProduct;
  const variantKey = product ? `${product.id}:${product.image}:${color}` : "";

  useEffect(() => {
    if (!product) return;

    if (product.code !== "458824" || !product.image.endsWith("/jacket-sage.jpg") || color === "55 GREEN") {
      return;
    }

    const sourceImage = new Image();
    sourceImage.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = sourceImage.naturalWidth;
        canvas.height = sourceImage.naturalHeight;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) throw new Error("Trình duyệt không hỗ trợ xử lý ảnh.");

        context.drawImage(sourceImage, 0, 0);
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);

        for (let index = 0; index < imageData.data.length; index += 4) {
          const red = imageData.data[index];
          const green = imageData.data[index + 1];
          const blue = imageData.data[index + 2];
          const max = Math.max(red, green, blue);
          const min = Math.min(red, green, blue);
          const saturation = max === 0 ? 0 : (max - min) / max;
          const brightness = (red * 0.299 + green * 0.587 + blue * 0.114) / 255;
          let hue = 0;

          if (max !== min) {
            if (max === red) hue = ((green - blue) / (max - min)) % 6;
            else if (max === green) hue = (blue - red) / (max - min) + 2;
            else hue = (red - green) / (max - min) + 4;
            hue = (hue * 60 + 360) % 360;
          }

          if (hue < 35 || hue > 165 || saturation < 0.035) continue;

          const mask = Math.min(1, (saturation - 0.035) / 0.065);
          const shade = color === "09 BLACK"
            ? 0.32 + brightness * 0.62
            : 0.72 + brightness * 0.28;
          const target = color === "09 BLACK" ? 24 : 255;
          imageData.data[index] = red * (1 - mask) + target * shade * mask;
          imageData.data[index + 1] = green * (1 - mask) + target * shade * mask;
          imageData.data[index + 2] = blue * (1 - mask) + target * shade * mask;
        }

        context.putImageData(imageData, 0, 0);
        setVariantImage({ key: variantKey, src: canvas.toDataURL("image/jpeg", 0.92) });
      } catch (error: unknown) {
        setImageError({
          key: variantKey,
          message: error instanceof Error ? error.message : "Không thể đổi màu ảnh sản phẩm.",
        });
      }
    };
    sourceImage.onerror = () => setImageError({ key: variantKey, message: "Không thể tải ảnh sản phẩm để đổi màu." });
    sourceImage.src = product.image;

    return () => {
      sourceImage.onload = null;
      sourceImage.onerror = null;
    };
  }, [color, product, variantKey]);

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
          <img
            className="product-main-image"
            src={variantImage?.key === variantKey ? variantImage.src : product.image}
            alt={`${product.name} - màu ${color}`}
          />
          <p className="product-image-caption">{product.name} · {color}</p>
          {imageError?.key === variantKey && <p className="product-image-error" role="status">{imageError.message}</p>}
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
                    <span className={`color-swatch swatch-${value.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`} />
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

          <div className="product-quantity-group">
            <p className="product-option-label">Số lượng</p>
            <div className="product-quantity-control" aria-label="Chọn số lượng sản phẩm">
              <button
                type="button"
                aria-label="Giảm số lượng"
                disabled={quantity <= 1}
                onClick={() => setQuantity((current) => Math.max(1, current - 1))}
              >
                −
              </button>
              <span aria-live="polite">{quantity}</span>
              <button
                type="button"
                aria-label="Tăng số lượng"
                onClick={() => setQuantity((current) => current + 1)}
              >
                +
              </button>
            </div>
          </div>

          {isLoggedIn ? (
            <button
              className="product-add-button"
              type="button"
              onClick={() => {
                if (addCartItem(product.id, size, color, quantity)) setAdded(true);
              }}
            >
              Thêm {quantity > 1 ? `${quantity} sản phẩm vào` : "vào"} giỏ hàng
            </button>
          ) : (
            <div className="product-login-required" role="status">
              <p>Vui lòng đăng nhập để thêm sản phẩm vào giỏ hàng.</p>
              <Link className="product-add-button" href="/dang-nhap">Đăng nhập</Link>
            </div>
          )}
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

      <ProductReviews key={product.id} productId={product.id} />

      <section className="related-products">
        <h2 className="section-title">Sản phẩm bạn có thể quan tâm</h2>
        <div className="product-grid">{products.filter((item) => item.id !== product.id).slice(0, 6).map((item) => <ProductCard key={item.id} product={item} />)}</div>
      </section>
    </div>
  );
}
