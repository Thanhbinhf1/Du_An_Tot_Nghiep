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
import type { Product } from "@/types/product";
import "./home.css";

const categoryOrder = ["ao-khoac", "ao-thun", "ao-so-mi", "quan-jeans", "quan-kaki", "chan-vay", "ao-hoodie", "quan-short", "vay"];
const categoryRank = new Map(categoryOrder.map((slug, index) => [slug, index]));
const departments = [
  { label: "Nữ", slug: "nu" },
  { label: "Nam", slug: "nam" },
  { label: "Trẻ em", slug: "tre-em" },
  { label: "Em bé", slug: "em-be" },
];
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

function collectionSlides(products: Product[], defaults: BannerSlide[]) {
  const photos = products.filter((product) => product.image && product.inStock)
    .map((product) => ({ src: product.image, alt: product.name, product: { name: product.name, href: `/product/${product.id}` } }));
  return [...new Map([defaults[0], ...photos, ...defaults.slice(1)].map((slide) => [slide.src, slide])).values()].slice(0, 3);
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
  const [sales, setSales] = useState<{ ids: string[]; failed: boolean }>();
  useEffect(() => {
    const controller = new AbortController();
    fetch(API_BASE_URL + "/catalog/best-sellers", { signal: controller.signal })
      .then(readApiResponse<string[]>)
      .then((ids) => { if (!controller.signal.aborted) setSales({ ids, failed: false }); })
      .catch(() => { if (!controller.signal.aborted) setSales({ ids: [], failed: true }); });
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
  ).slice(0, 10);
  const featuredProducts = products.filter((item) => item.isFeatured)
    .sort((first, second) => Number(isAdultFashion(second)) - Number(isAdultFashion(first)))
    .slice(0, 10);
  const productsById = new Map(products.map((product) => [product.id, product]));
  const bestSellers = (sales?.ids ?? []).flatMap((id) => productsById.get(id) ?? []);
  const saleProducts = products.filter((item) => (item.originalPrice ?? 0) > item.price).slice(0, 10);
  const productIds = new Set(products.filter((product) => product.inStock).map((product) => product.id));
  const publishedOutfits = outfits?.filter((outfit) => outfit.product_ids.some((id) => productIds.has(id))) ?? [];
  const heroImage = resolveProductImage(hero.image);
  const homeSlides = heroImage === storefrontPhotos[0].src ? storefrontPhotos : [
    { src: heroImage, alt: [hero.title, hero.accent].filter(Boolean).join(" "), position: "50% 25%" },
    ...storefrontPhotos.filter((item) => item.src !== heroImage).slice(0, 2),
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
              <Link className="home-text-link" href="/products">Tất cả sản phẩm <span aria-hidden="true">↗</span></Link>
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
              <CategoryTiles categories={homeCategories} photos={categoryPhotos} />
            ) : (
              <p className="home-empty" role="alert">Chưa tải được loại trang phục. Vui lòng thử tải lại trang.</p>
            )}
          </nav>
        )}
        <nav className="home-departments" aria-label="Mua sắm theo nhóm">
          {departments.map(({ slug, label }) => (
            <Link href={`/categories/${slug}`} key={slug}>{label} <span aria-hidden="true">↗</span></Link>
          ))}
        </nav>
      </div>

      <Collection id="san-pham-moi" title="Sản phẩm mới" href="/products?sort=newest"
        products={newArrivals} loading={loading} error={Boolean(productError)} emptyText="Chưa có sản phẩm mới."
        slides={collectionSlides(newArrivals, [storefrontPhotos[2], storefrontPhotos[1]])} />

      <Collection id="ban-chay" title="Bán chạy trong 30 ngày" products={bestSellers}
        loading={loading || !sales} error={Boolean(productError || sales?.failed)}
        emptyText="Chưa có sản phẩm từ đơn hoàn tất và đã thanh toán trong 30 ngày qua." />

      <section aria-labelledby="home-collections-heading" id="bo-suu-tap">
      <div className="home-section home-collection-intro"><h2 id="home-collections-heading">Bộ sưu tập</h2></div>
      <Collection id="noi-bat" title="Sản phẩm nổi bật" href="/products?featured=true"
        products={featuredProducts} loading={loading} error={Boolean(productError)} emptyText="Chưa có sản phẩm nổi bật."
        slides={collectionSlides(featuredProducts, [{ ...storefrontPhotos[1], position: "50% 16%" }, storefrontPhotos[0]])} />
      </section>
        <Collection id="khuyen-mai" title="Đang ưu đãi" href="/products?status=sale"
          products={saleProducts} loading={loading} error={Boolean(productError)} emptyText="Chưa có sản phẩm được giảm giá." />

      <section className="home-section home-lookbook" id="outfit" aria-labelledby="home-lookbook-title">
        <div className="home-lookbook-frame">
          <div className="home-lookbook-image">
            <Image src="/images/banner/fstyle-city-walk.webp" alt="" fill sizes="(max-width: 700px) 90vw, 52vw" />
          </div>
          <div className="home-lookbook-intro">
            <h2 id="home-lookbook-title">Mix & Match</h2>
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
