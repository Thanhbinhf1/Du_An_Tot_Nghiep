"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import ProductCard from "@/components/product/ProductCard";
import ProductReviews from "@/components/product/ProductReviews";
import { ProductSizeGuide } from "@/components/product/SizeChart";
import { formatVnd } from "@/data/products";
import { useWishlist } from "@/lib/wishlist";
import { addCartItem } from "@/lib/cart-api";
import { useDemoAuth } from "@/lib/demo-auth";
import { API_BASE_URL, mapApiProduct, readApiResponse, type ApiProduct } from "@/lib/api";
import { useCatalogProducts } from "@/lib/useCatalogProducts";
import { getColorSwatch } from "@/lib/product-colors";
import { recommendOutfitProducts } from "@/lib/product-recommendations";

import "./product.css";

type DetailProduct = ReturnType<typeof mapApiProduct>;

export default function ProductDetailPage() {
  return <Suspense fallback={<p className="product-loading" role="status">Đang tải sản phẩm…</p>}><ProductRoute /></Suspense>;
}

function ProductRoute() {
  const { id } = useParams<{ id: string }>();
  const options = useSearchParams();
  return <ProductDetail key={id} id={id} initialColor={options.get("color") ?? ""} initialSize={options.get("size") ?? ""} />;
}

function ProductDetail({ id, initialColor, initialSize }: { id: string; initialColor: string; initialSize: string }) {
  const [product, setProduct] = useState<DetailProduct>();
  const [productError, setProductError] = useState("");
  const [retrySeed, setRetrySeed] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_BASE_URL}/products/${encodeURIComponent(id)}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(readApiResponse<ApiProduct>)
      .then((data) => {
        if (!controller.signal.aborted) setProduct(mapApiProduct(data));
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setProductError(cause instanceof Error ? cause.message : "Không thể tải sản phẩm.");
        }
      });
    return () => controller.abort();
  }, [id, retrySeed]);

  if (!product) {
    return (
      <div className="container product-page">
        <div className="empty-state" role={productError ? "alert" : "status"}>
          {productError ? (
            <>
              <h2>Không thể tải dữ liệu sản phẩm</h2>
              <p>{productError}</p>
              <div className="error-recovery-actions">
                <button
                  type="button"
                  className="pill-button dark"
                  onClick={() => { setProductError(""); setRetrySeed((prev) => prev + 1); }}
                >
                  Thử tải lại
                </button>
                <Link href="/products" className="pill-button">
                  Quay lại danh sách sản phẩm
                </Link>
              </div>
            </>
          ) : (
            "Đang tải sản phẩm..."
          )}
        </div>
      </div>
    );
  }
  return <ProductDetails key={`${initialColor}:${initialSize}`} product={product} initialColor={initialColor} initialSize={initialSize} />;
}

function ProductDetails({ product, initialColor, initialSize }: { product: DetailProduct; initialColor: string; initialSize: string }) {
  const matchingColors = product.variants.filter((variant) => variant.color === initialColor);
  const requestedSize = product.variants.filter((variant) =>
    variant.size.trim().toUpperCase() === initialSize.trim().toUpperCase() && variant.stock_quantity > 0);
  const firstVariant =
    requestedSize.find((variant) => variant.color === initialColor) ?? requestedSize[0] ??
    matchingColors.find((variant) => variant.stock_quantity > 0) ?? matchingColors[0] ??
    product.variants.find((variant) => variant.stock_quantity > 0) ?? product.variants[0];
  const [selectedColor, setSelectedColor] = useState(firstVariant?.color ?? "");
  const [variantId, setVariantId] = useState(firstVariant?._id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);
  const cartRequest = useRef(false);
  const [added, setAdded] = useState(false);
  const [cartError, setCartError] = useState("");
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [zoomOpen, setZoomOpen] = useState(false);
  const zoomDialog = useRef<HTMLDialogElement>(null);
  const { token } = useDemoAuth();
  const wishlist = useWishlist();
  const { products } = useCatalogProducts();

  useEffect(() => {
    const dialog = zoomDialog.current;
    if (zoomOpen && dialog && !dialog.open) dialog.showModal();
  }, [zoomOpen]);

  const colors = [...new Set(product.variants.map((item) => item.color))];
  const variant = product.variants.find((item) => item._id === variantId);
  const activeColor = variant?.color ?? selectedColor ?? colors[0] ?? "";
  const sizesForColor = product.variants.filter((item) => item.color === activeColor);
  const stock = variant?.stock_quantity ?? 0;

  const productImages = product.images ?? [];
  const colorImages = productImages.filter((image) => image.color && image.color.trim().toLocaleLowerCase("vi") === activeColor.trim().toLocaleLowerCase("vi"));
  const unassignedImages = productImages.filter((image) => !image.color);
  const visibleImages = !activeColor
    ? productImages
    : [...colorImages, ...unassignedImages];
  const galleryImages = [...new Set(visibleImages.map((image) => image.url).filter(Boolean))];

  const currentImage = galleryImages[activeImageIndex] ?? "";

  // Giá gốc, giá giảm & % giảm
  const displayVariant = variant ?? sizesForColor[0] ?? firstVariant;
  const originalPrice = displayVariant?.price ?? product.originalPrice ?? product.price;
  const effectivePrice = displayVariant ? (displayVariant.sale_price ?? displayVariant.price) : product.price;
  const isDiscounted = originalPrice > effectivePrice && originalPrice > 0;
  const discountPercent = isDiscounted
    ? Math.round(((originalPrice - effectivePrice) / originalPrice) * 100)
    : 0;

  // Sản phẩm cùng danh mục (Liên quan)
  const related = products
    .filter((item) => item.id !== product.id && item.category === product.category)
    .slice(0, 4);

  // Phối đồ (Gợi ý các món đồ kết hợp khác loại hoặc ăn ý)
  const mixAndMatchProducts = useMemo(() => recommendOutfitProducts(product, products), [product, products]);

  const favorite = wishlist.ids.includes(product.id);
  const selection = new URLSearchParams();
  if (activeColor) selection.set("color", activeColor);
  if (variant) selection.set("size", variant.size);
  const returnTo = `/product/${product.id}${selection.size ? `?${selection}` : ""}`;

  function selectVariant(id: string) {
    const target = product.variants.find((item) => item._id === id);
    if (target) setSelectedColor(target.color);
    setVariantId(id);
    setQuantity(1);
    setAdded(false);
    setCartError("");
  }

  function handleColorChange(nextColor: string) {
    setSelectedColor(nextColor);
    setActiveImageIndex(0);
    const options = product.variants.filter((item) => item.color === nextColor);
    const next =
      options.find((item) => item.size === variant?.size && item.stock_quantity > 0) ??
      options.find((item) => item.stock_quantity > 0) ??
      options[0];
    if (next) {
      selectVariant(next._id);
    } else {
      setVariantId("");
    }
  }

  async function handleAddToCart() {
    setAdded(false);
    setCartError("");

    // Xử lý trường hợp chưa chọn size
    if (!variantId || !variant) {
      setCartError("Vui lòng chọn kích cỡ sản phẩm trước khi thêm vào giỏ hàng.");
      return;
    }

    // Xử lý trường hợp biến thể hết hàng
    if (stock <= 0) {
      setCartError("Biến thể đã chọn hiện đang hết hàng. Vui lòng chọn kích cỡ hoặc màu sắc khác.");
      return;
    }

    if (!token || cartRequest.current || quantity > stock) return;

    cartRequest.current = true;
    setAdding(true);
    try {
      await addCartItem(variant._id, quantity, token);
      setAdded(true);
    } catch (cause) {
      setCartError(
        cause instanceof Error ? cause.message : "Không thể thêm sản phẩm vào giỏ hàng.",
      );
    } finally {
      cartRequest.current = false;
      setAdding(false);
    }
  }

  return (
    <div className="container product-page">
      <nav className="breadcrumb product-breadcrumb" aria-label="Điều hướng">
        <Link href="/">Trang chủ</Link> /{" "}
        {product.category && (
          <>
            <Link href={product.categorySlug ? `/categories/${encodeURIComponent(product.categorySlug)}`
              : `/products?category=${encodeURIComponent(product.category)}`}>
              {product.category}
            </Link>{" "}
            /{" "}
          </>
        )}
        <span aria-current="page">{product.name}</span>
      </nav>

      <div className="product-detail">
        <div className="product-gallery-container">
          <div className={`product-gallery-grid${galleryImages.length === 1 ? " single" : ""}`} aria-label="Ảnh sản phẩm">
            {galleryImages.length ? (
              galleryImages.map((url, index) => (
                <button key={url} type="button" className="product-gallery-tile"
                  onClick={(event) => {
                    event.currentTarget.focus({ preventScroll: true });
                    setActiveImageIndex(index);
                    setZoomOpen(true);
                  }}
                  aria-label={`Phóng to ảnh ${index + 1} của ${product.name}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- image URLs are supplied by the catalog */}
                  <img src={url} alt="" loading={index > 1 ? "lazy" : "eager"} />
                  <span className="product-gallery-zoom" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.6}>
                      <circle cx="10.5" cy="10.5" r="6" /><path d="m15 15 5 5m-9.5-12v5m-2.5-2.5h5" />
                    </svg>
                  </span>
                </button>
              ))
            ) : (
              <p className="empty-state">{activeColor ? `Chưa có ảnh cho màu ${activeColor}` : "Chưa có ảnh sản phẩm"}</p>
            )}
          </div>
        </div>

        {/* 2. THÔNG TIN SẢN PHẨM & BIẾN THỂ */}
        <section className="product-info" aria-label="Thông tin sản phẩm">
          <h1 className="product-title">{product.name}</h1>
          <div className="product-meta-header">
            <p className="product-code">{[product.brand, variant?.sku].filter(Boolean).join(" · ")}</p>
            {product.rating > 0 && <a className="product-rating-link" href="#product-reviews" aria-label={`Xem đánh giá, ${product.rating.toFixed(1)} trên 5 sao`}>
              <span aria-hidden="true">★</span> {product.rating.toFixed(1)} {product.reviewCount ? `(${product.reviewCount})` : ""}
            </a>}
          </div>

          {product.variants.length > 0 ? (
            <>
              <fieldset className="product-option-group product-color-group" disabled={adding}>
                <legend className="product-option-label">Màu sắc {activeColor && <strong>({activeColor})</strong>}</legend>
                <div className="product-color-options">
                  {colors.map((color) => {
                    const swatch = getColorSwatch(color);
                    const soldOut = !product.variants.some((item) => item.color === color && item.stock_quantity > 0);
                    return (
                      <button key={color} type="button" className="product-color-option"
                        aria-label={`${color}${soldOut ? " · Hết hàng" : ""}`} title={color}
                        aria-pressed={color === activeColor} onClick={() => handleColorChange(color)}>
                        <span className="product-color-swatch" style={swatch ? { backgroundColor: swatch } : undefined} aria-hidden="true">
                          {!swatch && color.slice(0, 2)}
                        </span>
                      </button>
                    );
                  })}
                  {!colors.length && <p className="small muted">Chưa có màu nào đang bán.</p>}
                </div>
              </fieldset>

              {/* Chọn Kích cỡ + Tư vấn size */}
              <div className="product-option-group">
                <div className="size-label-row">
                  <p className="product-option-label">
                    Kích cỡ {variant ? <strong>({variant.size})</strong> : <span>(Chưa chọn)</span>}
                  </p>
                  <ProductSizeGuide id={product.id} name={product.name} activeSize={variant?.size} sizes={product.sizes} />
                </div>

                <div className="product-size-options" role="group" aria-label="Chọn kích cỡ">
                  {sizesForColor.map((item) => (
                    <button
                      key={item._id}
                      type="button"
                      className={`product-size-option${item._id === variantId ? " selected" : ""}${
                        item.stock_quantity <= 0 ? " out-of-stock" : ""
                      }`}
                      aria-pressed={item._id === variantId}
                      disabled={adding || item.stock_quantity <= 0}
                      onClick={() => {
                        if (item._id === variantId) {
                          setVariantId("");
                          setAdded(false);
                          setCartError("");
                        } else {
                          selectVariant(item._id);
                        }
                      }}
                    >
                      {item.size}
                      {item.stock_quantity <= 0 ? " (hết hàng)" : ""}
                    </button>
                  ))}
                </div>
              </div>

              <div className="detail-price-box">
                <p className={`detail-price${isDiscounted ? " detail-price-sale" : ""}`}>
                  {formatVnd(effectivePrice)}
                  {isDiscounted && <> <del>{formatVnd(originalPrice)}</del></>}
                </p>
                {isDiscounted && discountPercent > 0 && (
                  <span className="detail-discount-badge">-{discountPercent}%</span>
                )}
              </div>

              {/* Trạng thái tồn kho theo biến thể */}
              <p
                role="status"
                className={`stock-status-badge ${
                  !variant ? "stock-warning" : stock > 0 ? "stock-in" : "stock-out"
                }`}
              >
                {!variant
                  ? "Vui lòng chọn kích cỡ để kiểm tra tồn kho"
                  : stock > 0
                    ? `Còn ${stock} sản phẩm`
                    : "Biến thể này đã hết hàng"}
              </p>

            </>
          ) : (
            <p role="status" className="stock-status-badge stock-out">
              Sản phẩm chưa có biến thể đang bán.
            </p>
          )}

          <div className="product-option-group product-action-buttons">
            <div className="product-buy-row">
              {variant && stock > 0 && (
                <div className="product-quantity-control" aria-label="Chọn số lượng sản phẩm">
                  <button type="button" aria-label="Giảm số lượng"
                    disabled={adding || quantity <= 1} onClick={() => setQuantity(quantity - 1)}>−</button>
                  <span aria-live="polite">{quantity}</span>
                  <button type="button" aria-label="Tăng số lượng"
                    disabled={adding || quantity >= stock} onClick={() => setQuantity(quantity + 1)}>+</button>
                </div>
              )}
              {token ? (
                <button type="button" className="pill-button dark"
                  disabled={adding || !variant || stock <= 0} onClick={handleAddToCart}>
                  {adding ? "Đang thêm..." : variant && stock <= 0 ? "Hết hàng" : "Thêm vào giỏ hàng"}
                </button>
              ) : (
                <Link className="pill-button dark" href={`/dang-nhap?returnTo=${encodeURIComponent(returnTo)}`}>Đăng nhập để mua hàng</Link>
              )}
            </div>
            <button
              type="button"
              className={`product-wishlist-button${favorite ? " active" : ""}`}
              aria-pressed={favorite}
              disabled={wishlist.loading || wishlist.busy}
              onClick={() => void wishlist.toggle(product.id)}
            >
              {favorite ? "♥ Bỏ yêu thích" : "♡ Thêm vào yêu thích"}
            </button>
          </div>

          {wishlist.error && <p role="alert">{wishlist.error}</p>}
          {cartError && (
            <p className="product-image-error" role="alert">
              {cartError}
            </p>
          )}
          {added && (
            <p className="product-added-message" role="status">
              Đã thêm vào giỏ hàng. <Link href="/cart">Xem giỏ hàng</Link>
            </p>
          )}

          <div className="product-details-list">
            <details open>
              <summary>Mô tả & Chất liệu</summary>
              <p>
                {product.description || "Chưa có mô tả sản phẩm."}
              </p>
              {product.material && <p>Chất liệu: {product.material}</p>}
              {product.careInstructions && <p>Bảo quản: {product.careInstructions}</p>}
            </details>
            <details>
              <summary>Giao hàng / Đổi trả</summary>
              <p>
                Phí giao hàng được tính khi thanh toán. Xem{" "}
                <Link href="/shipping">chính sách giao hàng</Link> và{" "}
                <Link href="/returns">chính sách đổi trả</Link>.
              </p>
            </details>
          </div>
        </section>

        <ProductReviews productId={product.id} />
      </div>

      {/* 3. PHỐI ĐỒ: Gợi ý sản phẩm kết hợp (Mix & Match) */}
      {mixAndMatchProducts.length > 0 && (
        <section className="mix-match-section" aria-label="Gợi ý phối đồ">
          <div className="section-heading">
            <div>
              <h2 className="section-title">Gợi ý phối đồ</h2>
            </div>
          </div>
          <div className="mix-match-grid">
            {mixAndMatchProducts.map((item) => (
              <div className="mix-match-card" key={item.id}>
                <Link href={`/product/${item.id}`} className="mix-match-img-link">
                  {item.image ? (
                    <img src={item.image} alt={item.name} loading="lazy" />
                  ) : (
                    <span className="empty-state">Ảnh SP</span>
                  )}
                </Link>
                <div className="mix-match-info">
                  <span className="product-meta">{item.category || "Phối đồ VSC_BAPD"}</span>
                  <Link href={`/product/${item.id}`}>
                    <strong>{item.name}</strong>
                  </Link>
                  <p className="price">{formatVnd(item.price)}</p>
                  <Link href={`/product/${item.id}`} className="pill-button small-pill">
                    Xem kết hợp →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 4. SẢN PHẨM LIÊN QUAN */}
      {related.length > 0 && (
        <section className="related-products">
          <h2 className="section-title">Sản phẩm liên quan</h2>
          <div className="product-grid">
            {related.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      )}

      {/* MODAL PHÓNG TO ẢNH (ZOOM LIGHTBOX) */}
      {zoomOpen && currentImage && (
        <dialog
          ref={zoomDialog}
          className="image-zoom-backdrop"
          aria-label="Phóng to hình ảnh sản phẩm"
          onClose={() => setZoomOpen(false)}
          onClick={(event) => {
            if (event.target === event.currentTarget) event.currentTarget.close();
          }}
        >
          <div className="image-zoom-dialog">
            <button
              type="button"
              className="image-zoom-close"
              onClick={() => zoomDialog.current?.close()}
              aria-label="Đóng phóng to"
            >
              × Đóng
            </button>
            <img src={currentImage} alt={product.name} />
            {galleryImages.length > 1 && (
              <div className="image-zoom-controls">
                <button
                  type="button"
                  className="pill-button"
                  onClick={() =>
                    setActiveImageIndex((prev) => (prev - 1 + galleryImages.length) % galleryImages.length)
                  }
                >
                  ← Ảnh trước
                </button>
                <span>
                  {activeImageIndex + 1} / {galleryImages.length}
                </span>
                <button
                  type="button"
                  className="pill-button"
                  onClick={() => setActiveImageIndex((prev) => (prev + 1) % galleryImages.length)}
                >
                  Ảnh tiếp →
                </button>
              </div>
            )}
          </div>
        </dialog>
      )}
    </div>
  );
}
