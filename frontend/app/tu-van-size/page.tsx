"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { API_BASE_URL, readApiResponse, type ApiCategory } from "@/lib/api";
import { Suspense } from "react";

export default function SmartSizeGuidePage() {
  return <Suspense fallback={<p role="status">Đang tải tư vấn size...</p>}><SizeGuide /></Suspense>;
}

function SizeGuide() {
  const params = useSearchParams();
  const [categories, setCategories] = useState<ApiCategory[]>();
  const [categoryId, setCategoryId] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [fit, setFit] = useState("Regular");
  const [result, setResult] = useState<{ sizes: string[]; source?: string; availableSizes?: string[] }>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const defaultCategory = categories?.find((item) => item._id === params.get("categoryId"));
  const selectedCategory = categoryId || defaultCategory?._id || "";
  const productId = selectedCategory === defaultCategory?._id ? params.get("productId") : null;
  const sizes = result?.sizes;

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_BASE_URL}/catalog/categories`, { signal: controller.signal })
      .then(readApiResponse<ApiCategory[]>)
      .then((items) => { if (!controller.signal.aborted) setCategories(items); })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Không thể tải danh mục.");
      });
    return () => controller.abort();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setResult(undefined);
    try {
      const query = new URLSearchParams({ categoryId: selectedCategory, height, weight, fit });
      if (productId) query.set("productId", productId);
      const response = await fetch(`${API_BASE_URL}/catalog/size-recommendations?${query}`, { cache: "no-store" });
      const payload = await response.json() as { data?: string[]; message?: string; recommendation?: { source: string; availableSizes: string[] } };
      if (!response.ok || !Array.isArray(payload.data)) {
        throw new Error(payload.message || "Không thể tải tư vấn size.");
      }
      setResult({ sizes: payload.data, ...payload.recommendation });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể tải tư vấn size.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container" style={{ paddingBlock: "32px 64px", maxWidth: 960 }}>
      <nav className="breadcrumb"><Link href="/">Trang chủ</Link> / Tư vấn chọn size</nav>
      <h1 className="page-title">Tư vấn chọn size</h1>
      <p>Chọn danh mục, phom dáng và nhập số đo để tra bảng kích cỡ của cửa hàng.</p>
      <div className="two-column" style={{ marginTop: 24 }}>
        <form className="panel" onSubmit={handleSubmit}>
          <fieldset disabled={loading} style={{ border: 0, padding: 0, margin: 0 }}>
            <label className="form-field">
              Danh mục
              <select required value={selectedCategory} onChange={(event) => { setCategoryId(event.target.value); setResult(undefined); }}>
                <option value="">{categories ? "Chọn danh mục" : "Đang tải danh mục..."}</option>
                {categories?.map((item) => <option value={item._id} key={item._id}>{item.name}</option>)}
              </select>
            </label>
            <label className="form-field">
              Chiều cao (cm)
              <input required type="number" min="45" max="250" step="any" value={height} onChange={(event) => { setHeight(event.target.value); setResult(undefined); }} />
            </label>
            <label className="form-field">
              Cân nặng (kg)
              <input required type="number" min="3" max="300" step="any" value={weight} onChange={(event) => { setWeight(event.target.value); setResult(undefined); }} />
            </label>
            <label className="form-field">
              Phom dáng
              <select value={fit} onChange={(event) => { setFit(event.target.value); setResult(undefined); }}>
                <option value="Slim">Ôm dáng</option>
                <option value="Regular">Vừa vặn</option>
                <option value="Oversize">Rộng rãi</option>
              </select>
            </label>
            <button className="pill-button dark" disabled={!selectedCategory} type="submit">
              {loading ? "Đang tra bảng size..." : "Tìm kích cỡ"}
            </button>
          </fieldset>
        </form>
        <section className="panel" aria-live="polite">
          <h2>Kích cỡ gợi ý</h2>
          {result?.source === "estimate" && <p className="small muted">Size ước lượng theo số đo và phom đã chọn.</p>}
          {error && <p role="alert">{error}</p>}
          {!error && (sizes?.length
            ? <p className="size-suggestions">{sizes.map((size) => <strong key={size}>{size}</strong>)}</p>
            : <p>{sizes ? "Chưa có quy tắc phù hợp với số đo và phom dáng này." : "Kết quả sẽ hiện sau khi tra bảng size."}</p>)}
          {!!sizes?.length && <p className="muted small">Kích cỡ có thể khác tùy phom và chất liệu. Hãy đối chiếu với thông tin của sản phẩm bạn chọn.</p>}
          {!!result?.availableSizes?.length && <p className="muted small">Size còn hàng: {result.availableSizes.join(", ")}.</p>}
        </section>
      </div>
    </div>
  );
}
