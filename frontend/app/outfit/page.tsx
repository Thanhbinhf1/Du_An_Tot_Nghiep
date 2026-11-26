"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import FashionImage from "@/components/product/FashionImage";
import { formatVnd } from "@/data/products";
import { resolveProductImage } from "@/lib/api";
import { addCartItem, type ProductVariant } from "@/lib/cart-api";
import { useDemoAuth } from "@/lib/demo-auth";
import { getColorSwatch } from "@/lib/product-colors";
import { sizeGuideHref } from "@/lib/size-guide";
import { useCatalogOutfits, type Outfit } from "@/lib/useCatalogOutfits";
import { useCatalogProducts } from "@/lib/useCatalogProducts";
import type { Product } from "@/types/product";
import "./outfit.css";

type Look = { outfit: Outfit; products: Product[] };
type Choice = { included: boolean; color: string; variantId: string };

export default function OutfitPage() {
  return <Suspense fallback={<div className="fashion-wrap outfit-skeleton" role="status" aria-label="Đang mở gợi ý phối đồ" />}><OutfitRoute /></Suspense>;
}

function OutfitRoute() {
  const selectedId = useSearchParams().get("bo-phoi") ?? "";
  const [attempt, setAttempt] = useState(0);
  return <OutfitCatalog key={attempt} selectedId={selectedId} retry={() => setAttempt((value) => value + 1)} />;
}

function OutfitMedia({ look, sizes, eager = false }: { look: Look; sizes: string; eager?: boolean }) {
  const { outfit, products } = look;
  const [broken, setBroken] = useState("");
  const image = resolveProductImage(outfit.image ?? "");
  if (image && broken !== image && /^\/(?!\/)|^https?:\/\//i.test(image)) {
    return <FashionImage src={image} alt={`Bộ phối ${outfit.title}`} sizes={sizes} eager={eager} onUnavailable={() => setBroken(image)} />;
  }
  const pieces = products.filter((item) => item.image).slice(0, 2);
  if (!pieces.length) return <FashionImage alt={outfit.title} sizes={sizes} />;
  return <div className={`outfit-collage${pieces.length === 1 ? " single" : ""}`}>
    {pieces.map((product) => <div key={product.id}><FashionImage src={product.image} alt={product.name} sizes={sizes} eager={eager} /></div>)}
  </div>;
}

function OutfitHero({ look }: { look?: Look }) {
  return <>
    <nav className="fashion-breadcrumb" aria-label="Đường dẫn"><Link href="/">Trang chủ</Link><span aria-hidden="true">/</span><span aria-current="page">Gợi ý phối đồ</span></nav>
    <section className="fashion-hero outfit-hero" aria-labelledby="outfit-page-title">
      <div className="fashion-hero-copy">
        <h1 id="outfit-page-title">Mix &amp; Match</h1>
        <p>Khám phá những bộ phối mang phong cách riêng của bạn.</p>
        <a href="#outfit-collection" className="fashion-button primary">Khám phá bộ phối <span aria-hidden="true">↓</span></a>
      </div>
      <div className="fashion-hero-photo">
        {look ? <OutfitMedia look={look} sizes="(max-width: 620px) 100vw, 55vw" eager /> :
          <FashionImage src="/images/banner/fstyle-city-walk.webp" sizes="(max-width: 620px) 100vw, 55vw"
            alt="Hai người mẫu phối áo khoác với quần sáng màu trên phố" eager />}
      </div>
    </section>
  </>;
}

const styleKey = (style?: string) => style?.trim().toLocaleLowerCase("vi") ?? "";
const outfitHref = (id: string) => `/outfit?bo-phoi=${encodeURIComponent(id)}`;

function OutfitFilter({ looks, value, onChange }: { looks: Look[]; value: string; onChange: (value: string) => void }) {
  const styles = new Map(looks.flatMap(({ outfit }) => outfit.style?.trim() ? [[styleKey(outfit.style), outfit.style.trim()] as const] : []));
  return <div className="outfit-filter" role="group" aria-label="Lọc theo phong cách">
    <button type="button" aria-pressed={!value} onClick={() => onChange("")}>Tất cả</button>
    {[...styles].map(([key, label]) => <button type="button" key={key} aria-pressed={value === key} onClick={() => onChange(key)}>{label}</button>)}
  </div>;
}

function OutfitCard({ look, active }: { look: Look; active: boolean }) {
  const { outfit, products } = look;
  const priced = products.filter((product) => Boolean(product.variants?.length));
  const total = priced.reduce((sum, product) => sum + product.price, 0);
  const href = `${outfitHref(outfit._id)}#shop-the-look`;
  return <article className="outfit-card">
    <Link className="outfit-card-photo" href={href} scroll={false} aria-label={`Khám phá ${outfit.title}`}>
      <OutfitMedia look={look} sizes="(max-width: 800px) 46vw, 32vw" />
    </Link>
    <div className="outfit-card-copy">
      <p>{[outfit.style, `${products.length} sản phẩm`].filter(Boolean).join(" · ")}</p>
      <h3>{outfit.title}</h3>
      {priced.length > 0 && <p className="outfit-card-price">Tham khảo {formatVnd(total)}</p>}
      <Link className="fashion-text-link" href={href} scroll={false} aria-current={active ? "true" : undefined}>
        Khám phá bộ phối <span aria-hidden="true">↗</span>
      </Link>
    </div>
  </article>;
}

function OutfitCatalog({ selectedId, retry }: { selectedId: string; retry: () => void }) {
  const { products, loading: catalogLoading, error: catalogError } = useCatalogProducts();
  const { outfits, error } = useCatalogOutfits();
  const [style, setStyle] = useState("");
  const byId = new Map(products.map((item) => [item.id, item]));
  const linked = (outfits ?? []).map((outfit) => ({
    outfit, products: outfit.product_ids.flatMap((id) => byId.get(id) ?? []),
  }));
  const looks = linked.filter((look) => look.products.length > 0);
  const visible = looks.filter(({ outfit }) => !style || styleKey(outfit.style) === style);
  const active = linked.find(({ outfit }) => outfit._id === selectedId);
  const failure = error || catalogError;
  const loading = !failure && (!outfits || catalogLoading);
  return <div className="fashion-wrap outfit-page">
    <OutfitHero look={looks.find(({ outfit }) => /^\/(?!\/)|^https?:\/\//i.test(outfit.image ?? ""))} />
    <section className="outfit-collection" id="outfit-collection" aria-labelledby="outfit-collection-title" aria-busy={loading}>
      <div className="outfit-collection-heading"><h2 id="outfit-collection-title">Bộ sưu tập phối đồ</h2>
        {!!looks.length && <OutfitFilter looks={looks} value={style} onChange={setStyle} />}</div>
      {failure ? <p className="fashion-notice" role="alert">{failure} <button type="button" onClick={retry}>Thử lại</button></p>
        : loading ? <div className="outfit-grid" role="status" aria-label="Đang tải bộ phối"><div className="outfit-skeleton" /><div className="outfit-skeleton" /><div className="outfit-skeleton" /></div>
          : visible.length ? <div className="outfit-grid">
            {visible.map((look) => <OutfitCard key={look.outfit._id} look={look} active={look === active} />)}
          </div> : <p className="fashion-notice">Chưa có bộ phối nào để khám phá.</p>}
    </section>
    {!loading && !failure && !!selectedId && (active ? <OutfitDetail key={selectedId} look={active} />
      : <p id="shop-the-look" className="fashion-notice" role="status">Bộ phối này không còn hiển thị.</p>)}
  </div>;
}

function available(variant: ProductVariant) {
  return variant.status && variant.stock_quantity > 0;
}

function startingChoice(product: Product): Choice {
  const choices = product.variants?.filter(available) ?? [];
  const color = choices[0]?.color ?? product.variants?.[0]?.color ?? "";
  const sizes = choices.filter((variant) => variant.color === color);
  return { included: Boolean(choices.length), color, variantId: sizes.length === 1 ? sizes[0]._id : "" };
}

function ColorSwatchSelector({ variants, color, onChange }: { variants: ProductVariant[]; color: string; onChange: (value: string) => void }) {
  const colors = [...new Set(variants.map((variant) => variant.color))];
  return <div className="outfit-options">
    <p>Màu sắc{color && <strong> · {color}</strong>}</p>
    <div className="outfit-swatches" role="group" aria-label="Màu sắc">
      {colors.map((value) => {
        const swatch = getColorSwatch(value);
        return <button type="button" key={value} title={value} aria-label={value} aria-pressed={color === value}
          disabled={!variants.some((item) => item.color === value && available(item))} onClick={() => onChange(value)}>
          <span style={swatch ? { backgroundColor: swatch } : undefined} aria-hidden="true">{!swatch && value.slice(0, 2)}</span>
        </button>;
      })}
    </div>
  </div>;
}

function SizeSelector({ variants, variantId, onChange }: { variants: ProductVariant[]; variantId: string; onChange: (value: string) => void }) {
  return <div className="outfit-options">
    <p>Kích cỡ</p>
    <div className="outfit-sizes" role="group" aria-label="Kích cỡ">
      {variants.map((variant) => <button type="button" key={variant._id} aria-pressed={variantId === variant._id}
        disabled={!available(variant)} title={available(variant) ? variant.size : `${variant.size} · Hết hàng`}
        onClick={() => onChange(variant._id)}>{variant.size}</button>)}
    </div>
  </div>;
}

function OutfitProductCard({ product, choice, variant, onChange, hasChart, busy }: {
  product: Product; choice: Choice; variant?: ProductVariant; onChange: (choice: Choice) => void; hasChart: boolean; busy: boolean;
}) {
  const variants = product.variants ?? [];
  const colorVariants = variants.filter((item) => item.color === choice.color);
  const inStock = variants.some(available);
  const photo = product.images?.find((image) => image.color === choice.color)?.url ?? product.image;
  const price = variant ? variant.sale_price ?? variant.price : product.price;
  const original = variant?.price ?? product.originalPrice;
  const href = `/product/${product.id}${choice.color ? `?color=${encodeURIComponent(choice.color)}` : ""}`;
  return <article className="outfit-product" aria-labelledby={`look-product-${product.id}`}>
    <div className="outfit-product-photo"><FashionImage src={photo} alt={product.name} sizes="96px" /></div>
    <div className="outfit-product-content">
      <div className="outfit-product-heading">
        <h3 id={`look-product-${product.id}`}><Link href={href}>{product.name}</Link></h3>
        <label className="outfit-check">
          <input type="checkbox" aria-label={`Chọn mua ${product.name}`} checked={choice.included && inStock} disabled={!inStock || busy}
            onChange={(event) => onChange({ ...choice, included: event.target.checked })} />
        </label>
      </div>
      {variants.length > 0 && <p className="outfit-product-price">{formatVnd(price)}
        {original !== undefined && original > price && <del>{formatVnd(original)}</del>}
      </p>}
      <fieldset disabled={busy || !inStock} className="outfit-variant-options">
        <legend className="sr-only">Chọn biến thể của {product.name}</legend>
        {!!variants.length && <ColorSwatchSelector variants={variants} color={choice.color} onChange={(color) => {
          const next = variants.filter((item) => item.color === color && available(item));
          const sameSize = next.find((item) => item.size === variant?.size);
          onChange({ ...choice, color, variantId: sameSize?._id ?? (next.length === 1 ? next[0]._id : "") });
        }} />}
        {!!colorVariants.length && <SizeSelector variants={colorVariants} variantId={choice.variantId} onChange={(variantId) => onChange({ ...choice, variantId })} />}
      </fieldset>
      <p className={`outfit-stock${!inStock ? " unavailable" : ""}`}>
        {!inStock ? variants.length ? "Hết hàng" : "Chưa mở bán" : variant ? "Còn hàng" : "Chọn kích cỡ để mua"}
      </p>
      <div className="outfit-product-links">
        <Link className="fashion-text-link" href={href}>Xem chi tiết ↗</Link>
        {hasChart && <Link className="fashion-text-link" href={sizeGuideHref({ productId: product.id })}>Tư vấn size ↗</Link>}
      </div>
    </div>
  </article>;
}

function OutfitPriceSummary({ rows, pending, children }: { rows: ProductVariant[]; pending: number; children: React.ReactNode }) {
  const subtotal = rows.reduce((sum, variant) => sum + variant.price, 0);
  const total = rows.reduce((sum, variant) => sum + (variant.sale_price ?? variant.price), 0);
  return <div className="outfit-summary">
    <h3>Tóm tắt giỏ hàng</h3>
    <dl>
      <div><dt>Sản phẩm đã chọn</dt><dd>{rows.length + pending}</dd></div>
      <div><dt>Tạm tính</dt><dd>{formatVnd(subtotal)}</dd></div>
      {total < subtotal && <div><dt>Giảm giá sản phẩm</dt><dd>−{formatVnd(subtotal - total)}</dd></div>}
      <div className="outfit-total"><dt>Tổng tiền</dt><dd>{formatVnd(total)}</dd></div>
    </dl>
    {pending > 0 && <p role="status">Chọn kích cỡ cho {pending} món còn lại để tính tổng.</p>}
    {children}
  </div>;
}

function OutfitDetail({ look }: { look: Look }) {
  const { outfit, products } = look;
  const section = useRef<HTMLElement>(null);
  const locked = useRef(false);
  const { token } = useDemoAuth();
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState<string[]>([]);
  const [failures, setFailures] = useState<string[]>([]);
  const [photo, setPhoto] = useState("");
  const gallery = [...new Set(outfit.gallery ?? [])].filter((image) => image !== outfit.image);
  const rows = products.map((product) => {
    const choice = choices[product.id] ?? startingChoice(product);
    const variant = product.variants?.find((item) => item._id === choice.variantId && item.color === choice.color && available(item));
    return { product, choice, variant };
  });
  const selected = rows.flatMap(({ choice, variant, product }) => choice.included && variant ? [{ product, variant }] : []);
  const pending = rows.filter(({ choice, variant, product }) => choice.included && !variant && product.inStock).length;
  const missing = outfit.product_ids.length - products.length;

  useEffect(() => {
    if (window.location.hash === "#shop-the-look") {
      section.current?.focus({ preventScroll: true });
      section.current?.scrollIntoView({ block: "start" });
    }
  }, [outfit._id]);

  async function addSelected() {
    if (locked.current || !token || !selected.length || pending) return;
    locked.current = true;
    setBusy(true); setAdded([]); setFailures([]);
    const added: string[] = [];
    const failed: string[] = [];
    const updates: Record<string, Choice> = {};
    try {
      for (const { product, variant } of selected) {
        try {
          await addCartItem(variant._id, 1, token, { id: outfit._id, productId: product.id });
          added.push(product.name);
          updates[product.id] = { included: false, color: variant.color, variantId: variant._id };
        } catch (cause) {
          failed.push(`${product.name}: ${cause instanceof Error ? cause.message : "Không thể thêm vào giỏ."}`);
        }
      }
      setChoices((current) => ({ ...current, ...updates }));
      setAdded(added); setFailures(failed);
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }

  return <section className="outfit-detail" id="shop-the-look" ref={section} tabIndex={-1} aria-labelledby="outfit-detail-title">
    <div className="outfit-detail-editorial">
      <div className="outfit-detail-photo">{photo
        ? <FashionImage src={resolveProductImage(photo)} alt={`Ảnh phụ của bộ phối ${outfit.title}`} sizes="(max-width: 800px) 100vw, 52vw" />
        : <OutfitMedia look={look} sizes="(max-width: 800px) 100vw, 52vw" />}</div>
      {!!gallery.length && <div className="outfit-gallery" role="group" aria-label="Ảnh bộ phối">
        <button type="button" aria-label="Ảnh chính" aria-pressed={!photo} onClick={() => setPhoto("")}>
          <OutfitMedia look={look} sizes="72px" />
        </button>
        {gallery.map((image, index) => <button key={image} type="button" aria-label={`Ảnh phụ ${index + 1}`} aria-pressed={photo === image} onClick={() => setPhoto(image)}>
          <FashionImage src={resolveProductImage(image)} alt="" sizes="72px" />
        </button>)}
      </div>}
      <div className="outfit-detail-copy">
        {outfit.style && <p>{outfit.style}</p>}
        <h2 id="outfit-detail-title">{outfit.title}</h2>
        {outfit.description && <p>{outfit.description}</p>}
        {outfit.occasion && <p><strong>Dịp mặc</strong> · {outfit.occasion}</p>}
      </div>
    </div>
    <div className="outfit-detail-shopping">
      <h2>Các món trong bộ phối</h2>
      {missing > 0 && <p className="fashion-notice" role="status">{missing} món đã ngừng bán hoặc không còn hiển thị.</p>}
      {rows.length ? rows.map(({ product, choice, variant }) =>
        <OutfitProductCard key={product.id} product={product} choice={choice} variant={variant} busy={busy}
          hasChart={outfit.size_guide_product_ids?.includes(product.id) ?? false}
          onChange={(next) => setChoices((current) => ({ ...current, [product.id]: next }))} />)
        : <p className="fashion-notice">Bộ phối này hiện chưa có sản phẩm đang bán.</p>}
      <OutfitPriceSummary rows={selected.map((entry) => entry.variant)} pending={pending}>
        <div className="outfit-summary-actions">
          {token || !rows.some(({ product }) => product.inStock)
            ? <button type="button" className="fashion-button primary" disabled={busy || !selected.length || pending > 0}
              onClick={() => void addSelected()}>{busy ? "Đang thêm vào giỏ…" : "Thêm sản phẩm đã chọn vào giỏ"}</button>
            : <Link href={`/dang-nhap?returnTo=${encodeURIComponent(`${outfitHref(outfit._id)}#shop-the-look`)}`}
              className="fashion-button primary">Đăng nhập để thêm vào giỏ</Link>}
          <Link href="/cart" className="fashion-button">Xem giỏ hàng</Link>
        </div>
        {!!added.length && <p className="outfit-feedback" role="status"><strong>Đã thêm vào giỏ:</strong> {added.join(", ")}.</p>}
        {!!failures.length && <div className="fashion-notice" role="alert"><strong>Chưa thêm được:</strong><ul>{failures.map((line) => <li key={line}>{line}</li>)}</ul></div>}
      </OutfitPriceSummary>
    </div>
  </section>;
}
