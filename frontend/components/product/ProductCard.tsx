"use client";

import Link from "next/link";
import { toggleWishlist, useWishlistIds } from "@/lib/storefront-demo";
import type { Product } from "@/types/product";
import { formatVnd } from "@/data/products";

export default function ProductCard({ product }: { product: Product }) {
  const wishlistIds = useWishlistIds();
  const isFavorite = wishlistIds.includes(product.id);

  return (
    <article className="product-card">
      <Link href={`/product/${product.id}`}>
        <img src={product.image} alt={product.name} />
      </Link>
      <div className="card-actions">
        <span className="product-meta">{product.color}</span>
        <button
          className={`heart${isFavorite ? " active" : ""}`}
          type="button"
          onClick={() => toggleWishlist(product.id)}
          aria-label={isFavorite ? "Bỏ khỏi yêu thích" : "Thêm vào yêu thích"}
          aria-pressed={isFavorite}
        >
          {isFavorite ? "♥" : "♡"}
        </button>
      </div>
      <Link href={`/product/${product.id}`}>
        <p className="product-name">{product.name}</p>
      </Link>
      <div className="price">{formatVnd(product.price)}</div>
      <div className="product-meta">★ {product.rating} · {product.category}</div>
    </article>
  );
}
