"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { resolveProductImage } from "@/lib/api";
import { addCartItem } from "@/lib/cart-api";
import { useDemoAuth } from "@/lib/demo-auth";
import { useCatalogProducts } from "@/lib/useCatalogProducts";
import { formatVnd } from "@/data/products";
import { useCatalogOutfits, type Outfit } from "@/lib/useCatalogOutfits";
import type { Product } from "@/types/product";

export default function OutfitPage() {
  return <Suspense fallback={<p className="home-empty" role="status">Đang tải bộ phối đồ...</p>}><OutfitRoute /></Suspense>;
}

function OutfitRoute() {
  const initialId = useSearchParams().get("bo-phoi") ?? "";
  return <OutfitCatalog key={initialId} initialId={initialId} />;
}

function OutfitCatalog({ initialId }: { initialId: string }) {
  const { products, loading: catalogLoading, error: catalogError } = useCatalogProducts();
  const { outfits, error } = useCatalogOutfits();
  const [selectedId, setSelectedId] = useState(initialId);

  const loadError = catalogError;
  const byId = new Map(products.map((product) => [product.id, product]));
  const published = outfits?.filter((outfit) => outfit.product_ids.some((id) => byId.get(id)?.inStock)) ?? [];
  const suggested = [
    { id: "goi-y-cong-so", title: "Sơ mi và quần kaki", items: ["ao-so-mi", "quan-kaki"] },
    { id: "goi-y-cuoi-tuan", title: "Hoodie và quần jeans", items: ["ao-hoodie", "quan-jeans"] },
  ].flatMap(({ id, title, items }) => {
    const matches = items.map((slug) => products.find((product) => product.categorySlug === slug && product.inStock));
    if (matches.some((item) => !item)) return [];
    return [{
      _id: id, title, description: "Gợi ý từ các sản phẩm còn hàng.",
      image: matches[0]?.image || "/images/banner/fstyle-editorial.webp",
      product_ids: matches.flatMap((product) => product ? [product.id] : []),
    }];
  });
  const collections = published.length ? published : suggested;
  const active = collections.find((item) => item._id === selectedId) ?? collections[0];
  const activeProducts = active?.product_ids.flatMap((id) => {
    const product = byId.get(id);
    return product ? [product] : [];
  }) ?? [];

  return (
    <div className="container outfit-page" style={{ paddingBlock: "16px 64px" }}>
      <nav className="breadcrumb"><Link href="/">Trang chủ</Link> / Gợi ý phối đồ</nav>
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <h1 className="page-title">Bộ sưu tập gợi ý phối đồ</h1>
        <p>Chọn bộ phối và biến thể của từng món bạn muốn mua.</p>
      </div>
      {loadError && <p role="alert">{loadError}</p>}
      {error && !catalogLoading && <p className="muted">Không thể tải bộ phối của cửa hàng. Bạn vẫn có thể xem gợi ý từ sản phẩm còn hàng.</p>}
      {!loadError && ((!outfits && !error) || catalogLoading) && <p role="status">Đang tải bộ phối đồ...</p>}
      {!loadError && (outfits || error) && !catalogLoading && !collections.length && <p>Chưa có đủ sản phẩm để tạo bộ phối.</p>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))", gap: 16, marginBottom: 32 }}>
        {collections.map((item) => (
          <button key={item._id} type="button" className="panel" aria-pressed={active?._id === item._id}
            style={{ textAlign: "left", cursor: "pointer", borderColor: active?._id === item._id ? "#111" : "#ddd" }}
            onClick={() => setSelectedId(item._id)}>
            {item.image && <img src={resolveProductImage(item.image)} alt="" style={{ display: "block", width: "100%", height: 180, objectFit: "cover", marginBottom: 12 }} />}
            <strong>{item.title}</strong>
          </button>
        ))}
      </div>
      {active && !catalogLoading && !loadError && <OutfitDetails key={active._id} outfit={active} products={activeProducts} />}
    </div>
  );
}

function OutfitDetails({ outfit, products }: { outfit: Outfit; products: Product[] }) {
  const { token } = useDemoAuth();
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const rows = products.map((product) => {
    const variants = (product.variants ?? []).filter((variant) => variant.stock_quantity > 0);
    const variantId = choices[product.id] ?? variants[0]?._id;
    return { product, variants, variant: variants.find((variant) => variant._id === variantId) };
  });
  const selected = rows.flatMap(({ product, variant }) => variant ? [{ product, variant }] : []);
  const total = selected.reduce((sum, { variant }) => sum + (variant.sale_price ?? variant.price), 0);

  async function handleAdd() {
    if (!token || busy || !selected.length) return;
    setBusy(true);
    setError("");
    setMessage("");
    const added: string[] = [];
    const failures: string[] = [];
    try {
      for (const { product, variant } of selected) {
        try {
          await addCartItem(variant._id, 1, token);
          added.push(product.id);
        } catch (cause) {
          failures.push(`${product.name} — ${cause instanceof Error ? cause.message : "Không thể thêm vào giỏ."}`);
        }
      }
      if (added.length) {
        setChoices((current) => ({ ...current, ...Object.fromEntries(added.map((id) => [id, ""])) }));
        setMessage(`Đã thêm ${added.length} món vào giỏ hàng.`);
      }
      setError(failures.join(" "));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="two-column">
      <div className="panel">
        {outfit.image && <img src={resolveProductImage(outfit.image)} alt="" style={{ width: "100%", maxHeight: 420, objectFit: "cover" }} />}
        <h2>{outfit.title}</h2>
        {outfit.description && <p>{outfit.description}</p>}
      </div>
      <div className="panel">
        <h3>Các món trong bộ phối</h3>
        {!rows.length && <p>Chưa có sản phẩm đang bán trong bộ phối này.</p>}
        {rows.map(({ product, variants, variant }) => (
          <div key={product.id} className="summary-row" style={{ alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <Link href={`/product/${product.id}`}>{product.name}</Link>
            <select aria-label={`Màu và size của ${product.name}`} value={variant?._id ?? ""} disabled={busy || !variants.length}
              onChange={(event) => setChoices({ ...choices, [product.id]: event.target.value })}>
              <option value="">{variants.length ? "Bỏ chọn" : "Hết hàng"}</option>
              {variants.map((item) => (
                <option key={item._id} value={item._id}>{item.color} / {item.size} · {formatVnd(item.sale_price ?? item.price)}</option>
              ))}
            </select>
          </div>
        ))}
        {selected.length > 0 && <p><strong>Tạm tính {formatVnd(total)}</strong></p>}
        {token ? (
          <button type="button" className="pill-button dark" disabled={busy || !selected.length} onClick={() => void handleAdd()}>
            {busy ? "Đang thêm..." : `Thêm ${selected.length} món vào giỏ hàng`}
          </button>
        ) : <Link href="/dang-nhap" className="pill-button dark">Đăng nhập để thêm vào giỏ</Link>}
        {message && <p role="status">{message} <Link href="/cart">Xem giỏ hàng</Link></p>}
        {error && <p role="alert">{error}</p>}
      </div>
    </section>
  );
}
