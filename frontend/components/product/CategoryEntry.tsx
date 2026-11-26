import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { API_BASE_URL, readApiResponse } from "@/lib/api";
import { getAudienceName } from "@/lib/catalog-audience";
import CategoryPage from "./CategoryPage";

export default async function CategoryEntry({ slug, audience }: { slug: string; audience?: string }) {
  const response = await fetch(`${API_BASE_URL}/categories/resolve/${encodeURIComponent(slug)}`, { cache: "no-store" });
  const result = await readApiResponse<{ exists: boolean; virtual: boolean; visible: boolean; canonical_slug: string }>(response);
  if (!result.visible) {
    const audienceName = getAudienceName(slug);
    if (!result.exists || result.canonical_slug !== slug || !audienceName) notFound();

    return (
      <section className="catalog-page">
        <div className="catalog-heading">
          <div>
            <div className="breadcrumb"><Link href="/">Trang chủ</Link> / {audienceName}</div>
            <h1>{audienceName}</h1>
          </div>
        </div>
        <div className="empty-state">
          <p>Nhóm sản phẩm này hiện chưa hiển thị.</p>
          <Link className="pill-button dark" href="/products">Xem tất cả sản phẩm</Link>
        </div>
      </section>
    );
  }
  if (result.canonical_slug !== slug) permanentRedirect(`/categories/${encodeURIComponent(result.canonical_slug)}${audience ? `?nhom=${encodeURIComponent(audience)}` : ""}`);
  return <CategoryPage key={`${slug}:${audience ?? ""}`} slug={slug} audience={audience} />;
}
