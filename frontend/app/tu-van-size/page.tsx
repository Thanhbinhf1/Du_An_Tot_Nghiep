"use client";

import { Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import FashionImage from "@/components/product/FashionImage";
import ProductCard from "@/components/product/ProductCard";
import { MeasurementGuide, MeasurementIllustration, SizeChartTable, garmentRows } from "@/components/product/SizeChart";
import { resolveProductImage, type ApiCategory } from "@/lib/api";
import { getAudienceName } from "@/lib/catalog-audience";
import { bodyKeys, fieldsForFit, findSize, fits, getSizeChart, measurements, sizeRange, type Chart, type Fit, type Measurement, type SizeResult, type SizeScope } from "@/lib/size-guide";
import { useCatalogCategories } from "@/lib/useCatalogCategories";
import { useCatalogProducts } from "@/lib/useCatalogProducts";
import type { Product } from "@/types/product";

export default function SmartSizeGuidePage() {
  return <Suspense fallback={<div className="fashion-wrap size-skeleton" role="status" aria-label="Đang mở tư vấn kích cỡ" />}><SizeRoute /></Suspense>;
}

function SizeRoute() {
  const params = useSearchParams();
  const categoryId = params.get("categoryId") ?? "";
  const productId = params.get("productId") ?? "";
  return <SizeAdvisor key={`${categoryId}:${productId}`} initial={{ categoryId, productId }} />;
}

function SizeRecommendationHero() {
  return <>
    <nav className="fashion-breadcrumb" aria-label="Đường dẫn"><Link href="/">Trang chủ</Link><span aria-hidden="true">/</span><span aria-current="page">Tư vấn chọn size</span></nav>
    <section className="fashion-hero size-hero" aria-labelledby="size-page-title">
      <div className="fashion-hero-copy">
        <h1 id="size-page-title">Tìm kích cỡ<br />phù hợp với bạn</h1>
        <p>Khám phá kích cỡ phù hợp dựa trên số đo, bảng kích cỡ sản phẩm và sở thích mặc đồ của bạn.</p>
      </div>
      <div className="fashion-hero-photo"><FashionImage src="/images/auth/auth-fashion.png"
        alt="Trang phục tông trung tính trên giá treo trong studio" sizes="(max-width: 700px) 100vw, 55vw" eager /></div>
    </section>
  </>;
}

function SizeRecommendationStepper({ step }: { step: number }) {
  return <ol className="size-stepper" aria-label="Tiến trình tư vấn">
    {["Chọn sản phẩm", "Nhập số đo", "Xem kết quả"].map((label, index) => <li key={label} aria-current={index === step ? "step" : undefined}
      className={index <= step ? "step-active" : undefined}><span>{index + 1}</span>{label}</li>)}
  </ol>;
}

function CategorySelector({ categories, active, onChange }: { categories: ApiCategory[]; active?: string; onChange: (id: string) => void }) {
  return <div className="size-category-grid" role="group" aria-label="Danh mục trang phục">
    {categories.map((entry) => {
      const image = entry.image || entry.thumbnail;
      return <button key={entry._id} type="button" className="size-category" aria-pressed={active === entry._id} onClick={() => onChange(entry._id)}>
        <span className="size-category-photo">{image
          ? <FashionImage src={resolveProductImage(image)} alt="" sizes="64px" fallback={entry.name.slice(0, 1)} />
          : <MeasurementIllustration type={entry.slug.startsWith("quan") ? "trousers" : "shirt"} fit="Regular" />}</span>
        <span>{entry.name}</span>
      </button>;
    })}
  </div>;
}

function SizeAdvisor({ initial }: { initial: SizeScope }) {
  const catalog = useCatalogCategories();
  const { products, loading: productsLoading, error: productsError } = useCatalogProducts();
  const [scope, setScope] = useState<SizeScope>(initial);
  const [step, setStep] = useState(scope.productId || scope.categoryId ? 1 : 0);
  const currentProduct = products.find((item) => item.id === scope.productId);
  const currentCategory = scope.categoryId || currentProduct?.categoryId;
  const selectable = (catalog.categories ?? []).filter((item) =>
    !getAudienceName(item.slug) && (item._id === currentCategory || item.audiences?.length || !item.parent_id ||
      products.some((entry) => entry.categoryId === item._id)));
  const categoryProducts = products.filter((item) => Boolean(currentCategory) && item.categoryId === currentCategory);
  return <div className="fashion-wrap size-advisor">
    <SizeRecommendationHero />
    <SizeRecommendationStepper step={step} />
    <div className="size-workspace" id="size-workspace">
      <section className="size-selection" aria-labelledby="size-selection-title">
        <h2 id="size-selection-title">Chọn danh mục hoặc sản phẩm</h2>
        {catalog.loading && <div className="size-choice-skeletons" role="status" aria-label="Đang tải danh mục"><span /><span /><span /></div>}
        {catalog.error && <div className="fashion-notice" role="alert">{catalog.error} <button type="button" onClick={() => window.dispatchEvent(new Event("fstyle-catalog-change"))}>Thử lại</button></div>}
        {!!selectable.length && <CategorySelector categories={selectable} active={currentCategory} onChange={(categoryId) => {
          if (scope.categoryId === categoryId && !scope.productId) return;
          setScope({ categoryId }); setStep(1);
        }} />}
        {!catalog.loading && !catalog.error && !selectable.length && !scope.productId && <p className="fashion-notice">Chưa có danh mục hiển thị.</p>}
        {currentCategory && categoryProducts.length > 0 && <label className="size-specific-product">
          <span>Sản phẩm <small>(không bắt buộc)</small></span>
          <select value={scope.productId ?? ""} onChange={(event) => {
            setScope({ categoryId: currentCategory, productId: event.target.value }); setStep(1);
          }}>
            <option value="">Dùng bảng kích cỡ danh mục</option>
            {categoryProducts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>}
        {scope.productId && currentProduct && !categoryProducts.length && <p className="size-chart-source">{currentProduct.name}</p>}
      </section>
      <SizeConsultation key={`${scope.categoryId ?? ""}:${scope.productId ?? ""}`} scope={scope} products={products}
        productsLoading={productsLoading} productsError={productsError} setStep={setStep} />
    </div>
  </div>;
}

function FitPreferenceSelector({ value, onChange }: { value: Fit; onChange: (fit: Fit) => void }) {
  return <fieldset className="size-fit-fieldset"><legend>Phom dáng bạn thích</legend>
    <div className="size-fit-options">
      {(Object.keys(fits) as Fit[]).map((fit) => <label key={fit} className="size-fit">
        <input type="radio" name="fit" checked={value === fit} onChange={() => onChange(fit)} />
        <MeasurementIllustration type="shirt" fit={fit} />
        <span><strong>{fits[fit].label}</strong><small>{fits[fit].name}</small></span>
      </label>)}
    </div>
  </fieldset>;
}

function MeasurementForm({ fields, values, onChange }: {
  fields: ReturnType<typeof fieldsForFit>; values: Partial<Record<Measurement, string>>;
  onChange: (key: Measurement, value: string) => void;
}) {
  return <div className="size-fields">
    {fields.map(({ key, required }) => {
      const spec = measurements[key];
      return <label key={key}>
        <span>{spec.label}{!required && <small> (không bắt buộc)</small>}</span>
        <span className="size-input-wrap">
          <input type="number" inputMode="decimal" min={spec.min} max={spec.max} step="any" required={required}
            autoComplete="off" aria-label={`${spec.label} (${spec.unit})`} value={values[key] ?? ""}
            onChange={(event) => onChange(key, event.target.value)} />
          <span aria-hidden="true">{spec.unit}</span>
        </span>
      </label>;
    })}
  </div>;
}

function SizeConsultation({ scope, products, productsLoading, productsError, setStep }: {
  scope: SizeScope; products: Product[]; productsLoading: boolean; productsError: string; setStep: (step: number) => void;
}) {
  const [chart, setChart] = useState<Chart>();
  const [chartError, setChartError] = useState("");
  const [retry, setRetry] = useState(0);
  const [fit, setFit] = useState<Fit>("Regular");
  const [values, setValues] = useState<Partial<Record<Measurement, string>>>({});
  const [result, setResult] = useState<SizeResult>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const request = useRef<AbortController | null>(null);
  const form = useRef<HTMLFormElement>(null);
  const results = useRef<HTMLElement>(null);
  const hasScope = Boolean(scope.categoryId || scope.productId);

  useEffect(() => {
    if (!hasScope) return;
    const controller = new AbortController();
    getSizeChart(scope, controller.signal).then((value) => {
      if (!controller.signal.aborted) setChart(value);
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) setChartError(cause instanceof Error ? cause.message : "Không thể tải bảng kích cỡ.");
    });
    return () => { controller.abort(); request.current?.abort(); };
  }, [hasScope, scope, retry]);

  const fields = chart ? fieldsForFit(chart.rows, fit) : [];
  const garment = garmentRows(chart?.rows ?? [], fit);
  const body = (chart?.rows ?? []).filter((row) => row.fit_type === fit);

  function clearResult() {
    setResult(undefined); setError(""); setStep(1);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (request.current || !fields.length) return;
    const answers: Partial<Record<Measurement, number>> = {};
    for (const { key, required } of fields) {
      const value = values[key]?.trim();
      if (!value && !required) continue;
      const amount = value ? Number(value) : NaN;
      const { min, max, label } = measurements[key];
      if (!Number.isFinite(amount) || amount < min || amount > max) {
        setError(`${label} phải nằm trong khoảng ${min}–${max}.`);
        return;
      }
      answers[key] = amount;
    }
    if (!Object.keys(answers).length) {
      setError("Vui lòng nhập ít nhất một số đo để tra bảng kích cỡ.");
      return;
    }
    const controller = new AbortController();
    request.current = controller;
    setResult(undefined); setError(""); setLoading(true);
    try {
      const found = await findSize(scope, fit, answers, controller.signal);
      setResult(found); setStep(2);
      requestAnimationFrame(() => results.current?.focus());
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Không thể tra kích cỡ.");
    } finally {
      request.current = null;
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  return <>
    <section className="size-measurement-form" aria-labelledby="size-input-title">
      <h2 id="size-input-title">Nhập số đo</h2>
      {!hasScope && <p className="fashion-notice">Chọn một danh mục hoặc sản phẩm để xem các số đo cần nhập.</p>}
      {hasScope && !chart && !chartError && <div className="size-skeleton" role="status" aria-label="Đang tải bảng kích cỡ" />}
      {chartError && <div className="fashion-notice" role="alert">{chartError}{" "}
        <button type="button" onClick={() => { setChartError(""); setRetry((value) => value + 1); }}>Thử lại</button>
      </div>}
      {chart && <form ref={form} onSubmit={(event) => void submit(event)}>
        <fieldset disabled={loading} className="size-form-fieldset">
          {chart.name && <p className="size-chart-source">{chart.source === "product" ? "Bảng riêng" : chart.source === "category" ? "Bảng theo danh mục" : "Đang xem"} · {chart.name}</p>}
          {chart.rows.length > 0 && <FitPreferenceSelector value={fit} onChange={(next) => { setFit(next); clearResult(); }} />}
          {fields.length ? <MeasurementForm fields={fields} values={values} onChange={(key, value) => {
            setValues((previous) => ({ ...previous, [key]: value })); clearResult();
          }} /> : <p className="fashion-notice">{chart.rows.length
            ? "Chưa có số đo cơ thể cho phom này. Bạn có thể chọn phom khác hoặc xem bảng kích cỡ."
            : "Cửa hàng chưa có bảng kích cỡ cho lựa chọn này. Hãy chọn sản phẩm hoặc danh mục khác."}</p>}
          {!!fields.length && <button type="submit" className="fashion-button primary size-submit">
            {loading ? "Đang tra kích cỡ…" : "Tìm kích cỡ"} <span aria-hidden="true">→</span>
          </button>}
        </fieldset>
        {error && <p className="fashion-notice" role="alert">{error}</p>}
      </form>}
      {!!chart?.rows.length && <details className="size-details" id="size-reference">
        <summary>Xem bảng kích cỡ</summary>
        <SizeChartTable rows={body} kind="body" selectedSize={result?.sizes[0]} />
        {!!garment.length && <SizeChartTable rows={garment} kind="garment" selectedSize={result?.sizes[0]} />}
      </details>}
    </section>
    <aside className="size-assistance">
      <section className="size-result" ref={results} tabIndex={-1} aria-labelledby="size-result-title" aria-live="polite" aria-busy={loading}>
        <h2 id="size-result-title">Kết quả tư vấn</h2>
        {loading ? <div className="size-skeleton" role="status" aria-label="Đang tính kích cỡ" />
          : <SizeRecommendationResult result={result} fit={fit} edit={() => form.current?.querySelector<HTMLInputElement>('input[type="number"]')?.focus()} />}
      </section>
      <MeasurementGuide />
    </aside>
    {result?.sizes[0] && <RecommendedProducts result={result} products={products} loading={productsLoading} error={productsError} />}
  </>;
}

function SizeRecommendationResult({ result, fit, edit }: { result?: SizeResult; fit: Fit; edit: () => void }) {
  if (!result) return <p className="size-chart-source">Kết quả sẽ xuất hiện sau khi bạn tra bảng kích cỡ.</p>;
  const [size, ...alternatives] = result.sizes;
  return <>
    {size && result.match ? <div className="size-result-layout">
      <div className="size-suggestions"><span>Kích cỡ đề xuất</span><strong>{size}</strong></div>
      <div>
        <p><strong>{result.name}</strong><br />{fits[fit].name} · {fits[fit].label}</p>
        <p>Số đo đã nhập nằm trong khoảng áp dụng cho kích cỡ này theo {result.source === "product" ? "bảng riêng của sản phẩm" : "bảng của danh mục"}.</p>
        <ul>{bodyKeys.flatMap((key) => {
          const range = sizeRange(result.match!, key);
          return range ? [<li key={key}>{measurements[key].label} · {range.join("–")} {measurements[key].unit}</li>] : [];
        })}</ul>
        {!!alternatives.length && <p>Kích cỡ khác cũng phù hợp bảng: <strong>{alternatives.join(", ")}</strong>.</p>}
      </div>
    </div> : <p className="fashion-notice">Không tìm thấy kích cỡ khớp với số đo và phom dáng đã chọn.</p>}
    <p className="size-chart-source">Kết quả mang tính tham khảo, kích cỡ có thể khác nhau giữa các sản phẩm.</p>
    <div className="size-result-actions">
      <button type="button" className="fashion-button" onClick={edit}>Điều chỉnh thông tin</button>
      {!!result.productIds.length && <a href="#size-recommended-products" className="fashion-button primary">Xem sản phẩm phù hợp <span aria-hidden="true">↓</span></a>}
    </div>
  </>;
}

function RecommendedProducts({ result, products, loading, error }: { result: SizeResult; products: Product[]; loading: boolean; error: string }) {
  const matching = products.flatMap((product) => {
    if (!result.productIds.includes(product.id)) return [];
    const variants = product.variants?.filter((variant) =>
      variant.status && variant.stock_quantity > 0 && variant.size.trim().toUpperCase() === result.sizes[0]) ?? [];
    if (!variants.length) return [];
    const best = [...variants].sort((a, b) => (a.sale_price ?? a.price) - (b.sale_price ?? b.price))[0];
    return [{ ...product, variants, sizes: [...new Set(variants.map((variant) => variant.size))], price: best.sale_price ?? best.price, originalPrice: best.price }];
  });
  return <section className="size-recommended" id="size-recommended-products" aria-labelledby="size-recommended-title">
    <h2 id="size-recommended-title">Sản phẩm còn kích cỡ {result.sizes[0]}</h2>
    {loading ? <div className="size-skeleton" role="status" aria-label="Đang tải sản phẩm phù hợp" /> : error
      ? <p className="fashion-notice" role="alert">{error}</p> : matching.length
        ? <div className="size-product-grid">{matching.map((product) => <div key={product.id}>
          <ProductCard product={product} recommendedSize={result.sizes[0]} />
          <Link href={`/product/${product.id}?size=${encodeURIComponent(result.sizes[0])}`} className="fashion-text-link">Xem chi tiết <span aria-hidden="true">↗</span></Link>
        </div>)}</div>
        : <p className="fashion-notice">Hiện chưa có sản phẩm phù hợp còn kích cỡ này.</p>}
  </section>;
}
