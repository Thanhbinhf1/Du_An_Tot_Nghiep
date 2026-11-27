"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import ProductCard from "@/components/product/ProductCard";
import CategoryTiles from "@/components/product/CategoryTiles";
import BannerCarousel, { type BannerSlide } from "@/components/product/BannerCarousel";
import { API_BASE_URL, readApiResponse, resolveProductImage } from "@/lib/api";
import { defaultStorefrontHero, type StorefrontHero } from "@/lib/storefront-content";
import { getAudienceName } from "@/lib/catalog-audience";
import { useCatalogCategories } from "@/lib/useCatalogCategories";
import { useCatalogProducts } from "@/lib/useCatalogProducts";
import { useCatalogOutfits } from "@/lib/useCatalogOutfits";
import { formatVnd } from "@/data/products";
import type { Product } from "@/types/product";
import "./home.css";

const categoryOrder = ["ao-khoac", "ao-thun", "ao-so-mi", "quan-jeans", "quan-kaki", "chan-vay", "ao-hoodie", "quan-short", "vay"];
const categoryRank = new Map(categoryOrder.map((slug, index) => [slug, index]));

const shoppingHelp = [
  { title: "Tư vấn chọn size", copy: "Tìm kích cỡ theo số đo của bạn", href: "/tu-van-size" },
  { title: "Giao hàng", copy: "Xem thời gian và phí giao hàng", href: "/shipping" },
  { title: "Đổi và trả hàng", copy: "Xem điều kiện và cách gửi yêu cầu", href: "/returns" },
];
const storefrontPhotos: BannerSlide[] = [
  { src: "/images/banner/fstyle-editorial.webp", alt: "Hai người mẫu mặc áo khoác tông đỏ rượu và than", position: "50% 2%" },
  { src: "/images/banner/fstyle-city-walk.webp", alt: "Hai người mẫu phối áo khoác với quần sáng màu trên phố", position: "50% 36%" },
  { src: "/images/auth/auth-fashion.png", alt: "Trang phục tông trung tính trên giá treo trong studio", position: "50% 56%" },
];

function collectionSlides(
  products: Product[],
  defaults: BannerSlide[],
  badge: string,
  customMedia?: string,
): BannerSlide[] {
  const resolvedMedia = customMedia ? resolveProductImage(customMedia) : "";
  const featured = products.filter((product) => product.image && product.inStock).slice(0, 3);
  if (!featured.length) {
    return resolvedMedia
      ? [{ src: resolvedMedia, alt: badge, position: "50% 50%" }]
      : defaults;
  }
  return featured.map((product, idx) => {
    const fallbackBg = defaults[idx % defaults.length];
    const isSale = Boolean(product.originalPrice && product.originalPrice > product.price);
    return {
      src: (idx === 0 && resolvedMedia) ? resolvedMedia : (fallbackBg?.src || product.image),
      alt: product.name,
      position: fallbackBg?.position || "50% 25%",
      product: {
        name: product.name,
        href: `/product/${product.id}`,
        description: product.description?.slice(0, 110) || undefined,
        price: formatVnd(product.price),
        originalPrice: isSale && product.originalPrice ? formatVnd(product.originalPrice) : undefined,
        badge: isSale ? "ƯU ĐÃI CÓ HẠN" : badge,
      },
    };
  });
}

function isAdultFashion(product: Product) {
  return product.audiences?.some((audience) => audience === "nam" || audience === "nu") ?? false;
}

function Collection({
  id, title, href, products, loading, emptyText, error, slides,
}: {
  id: string;
  title: string;
  href?: string;
  products: Product[];
  loading: boolean;
  emptyText: string;
  error?: boolean;
  slides?: BannerSlide[];
}) {
  const rail = useRef<HTMLDivElement>(null);
  const [scrollState, setScrollState] = useState({ previous: false, next: false });
  const hasProducts = products.length > 0;

  useEffect(() => {
    const element = rail.current;
    if (!element) return;
    const measure = () => setScrollState({
      previous: element.scrollLeft > 4,
      next: element.scrollWidth - element.clientWidth - element.scrollLeft > 4,
    });
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    element.addEventListener("scroll", measure, { passive: true });
    return () => {
      observer.disconnect();
      element.removeEventListener("scroll", measure);
    };
  }, [hasProducts, loading, products.length]);

  function scrollProducts(direction: number) {
    const element = rail.current;
    if (element) element.scrollBy({ left: direction * element.clientWidth * .75 });
  }

  return (
    <section className="home-collection" id={id} aria-labelledby={`${id}-title`} aria-busy={loading}>
      {slides && <BannerCarousel slides={slides} label={`banner ${title.toLocaleLowerCase("vi")}`} className="home-collection-banner" />}
      <div className={`home-section${slides ? " home-collection-content" : ""}`}>
        <div className="home-section-heading">
          <h2 id={`${id}-title`}>{title}</h2>
          <div className="home-section-controls">
            {href && <Link className="home-text-link" href={href}>Xem tất cả <span aria-hidden="true">↗</span></Link>}
            {(scrollState.previous || scrollState.next) && <div className="rail-buttons">
              <button type="button" disabled={!scrollState.previous} onClick={() => scrollProducts(-1)} aria-label={`Xem ${title.toLocaleLowerCase("vi")} trước`}>‹</button>
              <button type="button" disabled={!scrollState.next} onClick={() => scrollProducts(1)} aria-label={`Xem thêm ${title.toLocaleLowerCase("vi")}`}>›</button>
            </div>}
          </div>
        </div>
        {loading ? (
          <>
            <p className="sr-only" role="status">Đang tải sản phẩm…</p>
            <div className="home-product-skeletons" aria-hidden="true">
              {Array.from({ length: 4 }, (_, index) => (
                <div className="skeleton-card" key={index}>
                  <div className="skeleton-box skeleton-image" />
                  <div className="skeleton-box skeleton-line short" />
                  <div className="skeleton-box skeleton-line" />
                </div>
              ))}
            </div>
          </>
        ) : error ? (
          <p className="home-empty" role="alert">Chưa tải được sản phẩm. Vui lòng thử tải lại trang.</p>
        ) : products.length ? (
          <div className="product-grid home-product-rail" ref={rail} aria-label={title}>
            {products.map((product) => <ProductCard key={product.id} product={product} />)}
          </div>
        ) : <p className="home-empty">{emptyText}</p>}
      </div>
    </section>
  );
}

export default function HomePage() {
  const [hero, setHero] = useState(defaultStorefrontHero);
  useEffect(() => {
    const controller = new AbortController();
    fetch(API_BASE_URL + "/storefront-content/home", { signal: controller.signal, cache: "no-store" })
      .then((response) => readApiResponse<StorefrontHero | null>(response))
      .then((content) => { if (content && !controller.signal.aborted) setHero(content); })
      .catch(() => { /* The homepage can render its built-in content while the API is unavailable. */ });
    return () => controller.abort();
  }, []);

  const { products, error: productError, loading } = useCatalogProducts();
  const { outfits, error: outfitError } = useCatalogOutfits();
  const { categories = [], loading: loadingCategories, error: categoryError } = useCatalogCategories();

  const categoryPhotos = new Map<string, string>();
  for (const product of products) {
    if (product.categoryId && product.image && !categoryPhotos.has(product.categoryId)) {
      categoryPhotos.set(product.categoryId, product.image);
    }
  }
  const collections = categories.filter((category) =>
    !getAudienceName(category.slug) &&
    (category.audiences?.length || category.image || category.thumbnail || categoryPhotos.has(category._id)),
  ).sort((first, second) =>
    (categoryRank.get(first.slug) ?? categoryOrder.length) -
    (categoryRank.get(second.slug) ?? categoryOrder.length),
  );
  const homeCategories = collections.slice(0, 12);

  const newArrivals = products.filter((product) => product.inStock).sort((first, second) =>
    Date.parse(second.createdAt ?? "1970-01-01") - Date.parse(first.createdAt ?? "1970-01-01"),
  ).slice(0, 12);

  const saleProducts = products.filter((item) => (item.originalPrice ?? 0) > item.price).slice(0, 12);

  const productsById = new Map(products.map((product) => [product.id, product]));
  const productIds = new Set(products.filter((product) => product.inStock).map((product) => product.id));
  const publishedOutfits = outfits?.filter((outfit) => outfit.product_ids.some((id) => productIds.has(id))) ?? [];

  const heroImage = resolveProductImage(hero.image);
  const homeSlides: BannerSlide[] = [
    { src: heroImage, alt: [hero.title, hero.accent].filter(Boolean).join(" "), position: "50% 25%" },
  ];

  return (
    <div className="home-page">
      <section className="editorial-hero" aria-labelledby="home-title">
        <BannerCarousel slides={homeSlides} label="banner trang chủ" className="editorial-image" eager>
          <div className="editorial-copy">
            <h1 id="home-title">{hero.title}{hero.accent && ` ${hero.accent}`}</h1>
            {hero.description && <p>{hero.description}</p>}
            <div className="editorial-actions">
              <Link className="editorial-cta" href={hero.ctaHref}>{hero.ctaLabel} <span aria-hidden="true">↗</span></Link>
              <a className="home-text-link editorial-secondary" href="#san-pham-moi">Xem hàng mới <span aria-hidden="true">↓</span></a>
            </div>
          </div>
        </BannerCarousel>
      </section>

      <div className="home-discovery">
        {(loadingCategories || homeCategories.length > 0 || categoryError) && (
          <nav className="home-shopping" aria-labelledby="home-category-title" aria-busy={loadingCategories}>
            <div className="home-section-heading">
              <h2 id="home-category-title">Tìm theo danh mục</h2>
            </div>
            {loadingCategories ? (
              <>
                <p className="sr-only" role="status">Đang tải danh mục…</p>
                <div className="store-category-tiles home-category-skeletons" aria-hidden="true">
                  {Array.from({ length: 6 }, (_, index) => (
                    <div className="store-category-tile" key={index}>
                      <span className="store-category-image skeleton-box" />
                      <span className="skeleton-box skeleton-line" />
                    </div>
                  ))}
                </div>
              </>
            ) : homeCategories.length > 0 ? (
              <>
                <CategoryTiles categories={homeCategories} photos={categoryPhotos} />
                <div className="home-categories-cta-wrap">
                  <Link href="/products" className="home-categories-pill-cta">
                    XEM TẤT CẢ DANH MỤC SẢN PHẨM
                  </Link>
                </div>
              </>
            ) : (
              <p className="home-empty" role="alert">Chưa tải được loại trang phục. Vui lòng thử tải lại trang.</p>
            )}
          </nav>
        )}
      </div>

      <Collection
        id="san-pham-moi"
        title="Sản phẩm"
        href="/products"
        products={newArrivals}
        loading={loading}
        error={Boolean(productError)}
        emptyText="Chưa có sản phẩm."
        slides={collectionSlides(
          newArrivals,
          [storefrontPhotos[1], storefrontPhotos[0], storefrontPhotos[2]],
          "MỚI VỀ",
          hero.collectionVideos?.newArrivals,
        )}
      />

      {saleProducts.length > 0 && (
        <Collection
          id="khuyen-mai"
          title="Đang ưu đãi"
          href="/products?status=sale"
          products={saleProducts}
          loading={loading}
          error={Boolean(productError)}
          emptyText="Chưa có sản phẩm được giảm giá."
          slides={collectionSlides(
            saleProducts,
            [storefrontPhotos[2], storefrontPhotos[1]],
            "ƯU ĐÃI CÓ HẠN",
            hero.collectionVideos?.sale,
          )}
        />
      )}

      <section className="home-section home-lookbook" id="outfit" aria-labelledby="home-lookbook-title">
        <div className="home-lookbook-frame">
          <div className="home-lookbook-image">
            <Image src="/images/banner/fstyle-city-walk.webp" alt="" fill sizes="(max-width: 700px) 90vw, 52vw" />
          </div>
          <div className="home-lookbook-intro">
            <h2 id="home-lookbook-title">Mix &amp; Match</h2>
            <p>Tìm ý tưởng phối đồ và xem từng món trong bộ.</p>
            <Link href="/outfit" className="home-text-link">Khám phá cách phối <span aria-hidden="true">↗</span></Link>
          </div>
        </div>
        {outfitError && <p role="status" className="home-empty">Chưa tải được bộ phối của cửa hàng.</p>}
        {!!publishedOutfits.length && (
          <div className="home-outfit-grid">
            {publishedOutfits.slice(0, 3).map((outfit) => {
              const pieces = outfit.product_ids.flatMap((id) => productsById.get(id) ?? []);
              const photo = outfit.image ? resolveProductImage(outfit.image) : pieces.find((piece) => piece.image)?.image;
              return (
                <Link className="home-outfit-card" href={`/outfit?bo-phoi=${encodeURIComponent(outfit._id)}`} key={outfit._id}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- outfit images can come from the backend */}
                  {photo && <img src={photo} alt="" loading="lazy" />}
                  <div>
                    <h3>{outfit.title} <span aria-hidden="true">↗</span></h3>
                    <p>{pieces.map((piece) => piece.name).join(" · ")}</p>
                    {outfit.description && <p>{outfit.description}</p>}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section className="home-section home-services" aria-label="Hỗ trợ mua sắm">
        {shoppingHelp.map(({ title, copy, href }) => (
          <Link className="home-service" key={href} href={href}>
            <div><h3>{title}</h3><p>{copy}</p></div>
            <span aria-hidden="true">↗</span>
          </Link>
        ))}
      </section>
    </div>
  );
}
