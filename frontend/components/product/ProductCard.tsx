"use client";

import Link from "next/link";
import { useState } from "react";
import { useWishlist } from "@/lib/wishlist";
import { getAudienceName } from "@/lib/catalog-audience";
import { getColorSwatch } from "@/lib/product-colors";
import type { Product } from "@/types/product";
import { formatVnd } from "@/data/products";

export default function ProductCard({ product, recommendedSize }: { product: Product; recommendedSize?: string }) {
  const { ids, toggle, loading, busy } = useWishlist();
  const isFavorite = ids.includes(product.id);
  const [chosenColor, setChosenColor] = useState("");
  const [failedImages, setFailedImages] = useState<string[]>([]);
  const colors = [...new Set(product.variants?.map((variant) => variant.color).filter(Boolean) ?? [])];
  const activeColor = colors.includes(chosenColor) ? chosenColor : "";
  const colorVariants = product.variants?.filter((variant) => variant.color === activeColor) ?? [];
  const availableVariants = colorVariants.filter((variant) => variant.stock_quantity > 0);
  const pricedVariants = availableVariants.length ? availableVariants : colorVariants;
  const choice = [...pricedVariants].sort((a, b) => (a.sale_price ?? a.price) - (b.sale_price ?? b.price))[0];
  const price = choice ? choice.sale_price ?? choice.price : product.price;
  const originalPrice = choice ? choice.price : product.originalPrice;
  const sizes = [...new Set(choice ? colorVariants.map((variant) => variant.size) : product.sizes)];
  const audience = product.audiences?.map(getAudienceName).filter(Boolean).join(" / ");
  const metadata = [audience || product.category || product.brand, sizes.join(" / ")].filter(Boolean).join(" · ");
  const colorImage = activeColor ? product.images?.find((image) =>
    image.color?.trim().toLocaleLowerCase("vi") === activeColor.trim().toLocaleLowerCase("vi"),
  )?.url : undefined;
  const neutralImage = product.images?.find((image) => !image.color)?.url;
  const image = (activeColor ? [colorImage, neutralImage] : [product.image, neutralImage]).find((url) => url && !failedImages.includes(url));
  const selection = new URLSearchParams();
  if (activeColor) selection.set("color", activeColor);
  if (recommendedSize) selection.set("size", recommendedSize);
  const href = `/product/${product.id}${selection.size ? `?${selection}` : ""}`;

  const hasVariants = product.variants ? product.variants.length > 0 : true;
  const isOutOfStock = !hasVariants || (choice ? !availableVariants.length : product.inStock === false);
  const isOnSale = originalPrice !== undefined && originalPrice > price;
  const discountPercent = isOnSale && originalPrice > 0 ? Math.round(100 * (1 - price / originalPrice)) : 0;
  const displayRating = product.rating;

  return (
    <article className={`product-card${isOutOfStock ? " product-card-out" : ""}`}>
      <div className="product-card-media">
        <Link href={href} aria-label={product.name}>
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element -- catalog images can use merchant URLs
            <img src={image} alt="" loading="lazy" onError={() => setFailedImages((failed) => [...failed, image])} />
          ) : (
            <span className="empty-state">Chưa có ảnh sản phẩm</span>
          )}
        </Link>
        {isOutOfStock && <div className="product-card-badges">
          <span className="badge badge-out">{hasVariants ? "Hết hàng" : "Chưa mở bán"}</span>
        </div>}
      </div>

      <div className="product-card-actions">
        <div className="card-swatches" role={colors.length ? "group" : undefined} aria-label={colors.length ? "Màu sản phẩm" : undefined}>
          {colors.slice(0, 6).map((name) => {
            const swatch = getColorSwatch(name);
            return <button key={name} type="button" className="card-swatch" aria-label={name}
              title={name} aria-pressed={name === activeColor} onClick={() => setChosenColor(name)}>
                <span style={swatch ? { backgroundColor: swatch } : undefined} />
              </button>;
          })}
          {colors.length > 6 && <Link href={href} className="card-extra-colors" aria-label={`Còn ${colors.length - 6} màu`}>+{colors.length - 6}</Link>}
        </div>
        <button
          className={`card-favorite${isFavorite ? " active" : ""}`}
          type="button"
          disabled={loading || busy}
          onClick={() => void toggle(product.id)}
          aria-label={isFavorite ? "Bỏ khỏi yêu thích" : "Thêm vào yêu thích"}
          aria-pressed={isFavorite}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20.8 8.7c0 4.1-8.8 10.1-8.8 10.1S3.2 12.8 3.2 8.7A4.7 4.7 0 0 1 12 6.2a4.7 4.7 0 0 1 8.8 2.5Z" />
          </svg>
        </button>
      </div>

      <div className="product-card-content">
        {metadata && <span className="product-meta">{metadata}</span>}
        <Link href={href}>
          <p className="product-name">{product.name}</p>
        </Link>

        <div className="product-card-price-row">
          <span className={`price${isOnSale ? " price-sale" : ""}`}>
            {product.variants?.length === 0 ? "Xem chi tiết" : formatVnd(price)}
          </span>
          {isOnSale && originalPrice !== undefined && (
            <del className="price-original">{formatVnd(originalPrice)}</del>
          )}
        </div>
        {isOnSale && discountPercent > 0 && (
          <p className="product-sale-note">Ưu đãi có giới hạn (−{discountPercent}%)</p>
        )}

        {displayRating > 0 && (
          <div className="product-card-footer">
            <span className="product-card-rating" aria-label={`Đánh giá ${displayRating.toFixed(1)} trên 5 sao`}>
              <span className="star-icon" aria-hidden="true">★</span> {displayRating.toFixed(1)}
            </span>
          </div>
        )}
      </div>
    </article>
  );
}
