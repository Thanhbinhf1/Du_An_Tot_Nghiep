import { useEffect, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import { resolveProductImage } from "@/lib/api";
import { defaultStorefrontHero, type StorefrontHero } from "@/lib/storefront-content";
import AdminFeedback from "./AdminFeedback";
import AdminIcon from "./AdminIcon";
import CatalogDialog from "./CatalogDialog";
import type { AdminRequest } from "./ProductVariantsManager";

type Content = { revision: number; hero: StorefrontHero | null };
const assets = [
  { image: defaultStorefrontHero.image, label: "F.Style Editorial" },
  { image: "/images/banner/fstyle-city-walk.webp", label: "F.Style City Walk" },
];
const textInputs = [
  { name: "title", label: "Tiêu đề", max: 50, required: true },
  { name: "accent", label: "Dòng nhấn", max: 50, required: false },
  { name: "ctaLabel", label: "Tên nút", max: 40, required: true },
  { name: "ctaHref", label: "Liên kết nút", max: 200, required: true },
] as const;

export default function AdminBanners({ request }: { request: AdminRequest }) {
  const [saved, setSaved] = useState<Content>();
  const [draft, setDraft] = useState<StorefrontHero>(defaultStorefrontHero);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const writing = useRef(false);
  const original = saved?.hero ?? defaultStorefrontHero;
  const dirty = Object.keys(original).some((name) => original[name as keyof StorefrontHero] !== draft[name as keyof StorefrontHero]);

  useEffect(() => {
    const controller = new AbortController();
    request<Content>("/admin/storefront-content/home", { signal: controller.signal })
      .then((data) => { if (!controller.signal.aborted) { setSaved(data); setDraft(data.hero ?? defaultStorefrontHero); } })
      .catch((cause: unknown) => { if (!controller.signal.aborted) setLoadError(cause instanceof Error ? cause.message : "Không tải được nội dung trang chủ."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [request, refresh]);

  function reload() {
    setLoading(true);
    setLoadError("");
    setError("");
    setRefresh((value) => value + 1);
  }
  async function publish(hero: StorefrontHero | null) {
    if (!saved || writing.current) return;
    writing.current = true;
    setBusy(true); setError(""); setNotice("");
    try {
      const data = await request<Content>("/admin/storefront-content/home", {
        method: "PUT", body: JSON.stringify({ revision: saved.revision, hero }),
      });
      setSaved(data);
      setDraft(data.hero ?? defaultStorefrontHero);
      setNotice(hero ? "Đã xuất bản banner trang chủ." : "Đã khôi phục banner mặc định.");
      setConfirmReset(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể lưu banner."); }
    finally { writing.current = false; setBusy(false); }
  }
  async function upload(file?: File) {
    if (!file || writing.current) return;
    if (file.size > 5 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Chọn ảnh JPG, PNG hoặc WebP tối đa 5 MB.");
      return;
    }
    const body = new FormData();
    body.append("image", file);
    writing.current = true;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await request<{ url: string }>("/admin/uploads", { method: "POST", body });
      setDraft((current) => ({ ...current, image: result.url }));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không tải được ảnh banner."); }
    finally { writing.current = false; setBusy(false); }
  }

  return <>
    <div className="admin-adminlist-header">
      <p className="admin-muted">Chỉnh tiêu đề, ảnh và nút mua sắm của banner đầu trang chủ.</p>
      <button type="button" className="admin-icon-button" title="Tải lại banner đang dùng" aria-label="Tải lại banner đang dùng" disabled={busy || loading}
        onClick={() => { if (!dirty || window.confirm("Tải lại banner và bỏ phần chỉnh sửa chưa xuất bản?")) reload(); }}><AdminIcon name="refresh" /></button>
    </div>
    {loading || loadError ? <section className="admin-panel"><AdminFeedback kind={loading ? "loading" : "error"} message={loading ? "Đang tải banner…" : loadError} onRetry={loadError ? reload : undefined} /></section> : <>
      {notice && <AdminFeedback kind="success" message={notice} />}
      {error && !confirmReset && <AdminFeedback kind="error" message={error} />}
      <div className="admin-banner-layout">
        <section className="admin-panel">
          <div className="admin-card-title"><h2>Xem trước banner</h2><span className={"admin-data-pill tone-" + (dirty ? "amber" : "green")}>{dirty ? "Bản đang chỉnh" : saved?.hero ? "Đang hiển thị" : "Mặc định"}</span></div>
          <div className="admin-banner-preview">
            <div className="admin-banner-copy"><h3>{draft.title}{draft.accent && <><br /><em>{draft.accent}</em></>}</h3><p>{draft.description}</p>
              <span className="admin-banner-cta">{draft.ctaLabel || "Tên nút"} ↗</span></div>
            <div className="admin-banner-image"><Image src={resolveProductImage(draft.image)} alt="" fill unoptimized={draft.image.startsWith("/uploads/")} sizes="(max-width: 700px) 50vw, 320px" /></div>
          </div>
          <a className="admin-quiet-link" href="/" target="_blank" rel="noopener">Xem trang chủ đang hiển thị <AdminIcon name="chevron" /></a>
        </section>
        <section className="admin-panel">
          <h2>Nội dung trang chủ</h2>
          <form className="admin-banner-editor" onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); void publish(draft); }}>
            <fieldset className="admin-form variant-fieldset" disabled={busy}>
              {textInputs.map(({ name, label, max, required }) => <label key={name}>{label}<input required={required} maxLength={max} value={draft[name]}
                onChange={(event) => setDraft({ ...draft, [name]: event.target.value })} placeholder={name === "ctaHref" ? "/products" : undefined} /></label>)}
              <label className="wide">Mô tả<textarea value={draft.description} required maxLength={160} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
              <label>Ảnh banner<select value={draft.image} onChange={(event) => setDraft({ ...draft, image: event.target.value })}>
                {!assets.some((item) => item.image === draft.image) && <option value={draft.image}>Ảnh đã tải lên</option>}
                {assets.map((item) => <option key={item.image} value={item.image}>{item.label}</option>)}
              </select></label>
              <label>Tải ảnh mới<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; void upload(file); }} /></label>
            </fieldset>
            <div className="admin-actions">
              <button type="button" className="admin-inline-button" disabled={busy || !saved?.hero} onClick={() => { setError(""); setConfirmReset(true); }}>Khôi phục mặc định</button>
              <button className="admin-button" type="submit" disabled={busy || !dirty}>{busy ? "Đang xử lý…" : "Lưu và xuất bản"}</button>
            </div>
          </form>
        </section>
      </div>
    </>}
    {confirmReset && <CatalogDialog title="Khôi phục banner mặc định?" close={() => { if (!busy) setConfirmReset(false); }}>
      <p>Trang chủ sẽ hiển thị lại tiêu đề, nút mua sắm và ảnh Editorial của F.Style.</p>
      {error && <AdminFeedback kind="error" message={error} />}
      <div className="admin-actions"><button type="button" disabled={busy} onClick={() => setConfirmReset(false)}>Hủy</button>
        <button type="button" className="primary" disabled={busy} onClick={() => void publish(null)}>Khôi phục</button></div>
    </CatalogDialog>}
  </>;
}
