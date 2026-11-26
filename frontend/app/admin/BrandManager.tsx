import { useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import { resolveProductImage } from "@/lib/api";
import AdminFeedback from "./AdminFeedback";
import AdminIcon from "./AdminIcon";
import CatalogDialog from "./CatalogDialog";
import type { AdminRequest } from "./ProductVariantsManager";

const blank = { name: "", slug: "", logo: "", status: true };
type Brand = typeof blank & { _id: string };

export default function BrandManager({ request }: { request: AdminRequest }) {
  const [brands, setBrands] = useState<Brand[]>();
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    request<Brand[]>("/brands?all=true", { signal: controller.signal })
      .then((data) => { if (!controller.signal.aborted) setBrands(data); })
      .catch((cause) => { if (!controller.signal.aborted) setLoadError(cause instanceof Error ? cause.message : "Không thể tải thương hiệu."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [request, revision]);

  function open(brand?: Brand) {
    setEditing(brand?._id ?? "");
    setForm(brand ? { name: brand.name, slug: brand.slug, logo: brand.logo ?? "", status: brand.status } : blank);
    setSaveError("");
    setNotice("");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || editing === null) return;
    setBusy(true);
    setSaveError("");
    try {
      const item = await request<Brand>(editing ? "/brands/" + editing : "/brands", {
        method: editing ? "PATCH" : "POST", body: JSON.stringify(form),
      });
      setBrands((current) => [...(current ?? []).filter((brand) => brand._id !== item._id), item].sort((a, b) => a.name.localeCompare(b.name, "vi")));
      setNotice(editing ? "Đã cập nhật thương hiệu." : "Đã tạo thương hiệu.");
      setEditing(null);
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : "Không thể lưu thương hiệu.");
    } finally { setBusy(false); }
  }

  const query = search.trim().toLocaleLowerCase("vi");
  const visible = brands?.filter((brand) => (status === "all" || String(brand.status) === status)
    && (!query || [brand.name, brand.slug].some((value) => value?.toLocaleLowerCase("vi").includes(query)))) ?? [];

  return <>
    <div className="admin-adminlist-header">
      <p className="admin-muted">Quản lý logo, đường dẫn và trạng thái hiển thị của thương hiệu.</p>
      <button className="admin-button admin-inline-icon" type="button" disabled={loading || !!loadError} onClick={() => open()}><AdminIcon name="plus" /> Thêm thương hiệu</button>
    </div>
    <section className="admin-panel">
      {notice && <p role="status" className="admin-success">{notice}</p>}
      <div className="admin-filter-bar">
        <label className="admin-list-search">Tìm thương hiệu<input placeholder="Tên hoặc slug" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        <label>Trạng thái<select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="all">Tất cả trạng thái</option><option value="true">Hiển thị</option><option value="false">Đã ẩn</option>
        </select></label>
      </div>
      <div className="admin-table-wrap" role="region" aria-label="Bảng thương hiệu" tabIndex={0}>
        <table className="admin-table">
          <thead><tr><th>Logo & thương hiệu</th><th>Slug</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
          <tbody>
            {loading || loadError || visible.length === 0 ? <tr><td colSpan={4}>
              <AdminFeedback kind={loading ? "loading" : loadError ? "error" : "empty"} message={loading ? "Đang tải thương hiệu…" : loadError || "Không có thương hiệu phù hợp."} onRetry={loadError ? () => { setLoading(true); setLoadError(""); setRevision((value) => value + 1); } : undefined} />
            </td></tr> : visible.map((brand) => <tr key={brand._id}>
              <td><div className="admin-table-product">{brand.logo && /^(https?:\/\/|\/(?!\/))/i.test(brand.logo) ? <Image src={resolveProductImage(brand.logo)} width={36} height={40} alt="" unoptimized /> : <span className="admin-tile-icon tone-green"><AdminIcon name="brands" /></span>}<strong>{brand.name}</strong></div></td>
              <td>{brand.slug}</td>
              <td><span className={"admin-data-pill tone-" + (brand.status ? "green" : "neutral")}>{brand.status ? "Hiển thị" : "Đã ẩn"}</span></td>
              <td><button type="button" onClick={() => open(brand)}>Sửa</button></td>
            </tr>)}
          </tbody>
        </table>
      </div>
    </section>
    {editing !== null && <CatalogDialog title={editing ? "Sửa thương hiệu" : "Thêm thương hiệu"} close={() => { if (!busy) setEditing(null); }}>
      {saveError && <p role="alert" className="admin-alert">{saveError}</p>}
      <form onSubmit={save}>
        <fieldset className="admin-form variant-fieldset" disabled={busy}>
          <label>Tên thương hiệu<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
          <label>Slug thương hiệu<input required value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} /></label>
          <label>Đường dẫn logo<input value={form.logo} onChange={(event) => setForm({ ...form, logo: event.target.value })} /></label>
          <label>Trạng thái<select value={String(form.status)} onChange={(event) => setForm({ ...form, status: event.target.value === "true" })}><option value="true">Hiển thị</option><option value="false">Đã ẩn</option></select></label>
        </fieldset>
        <div className="admin-actions"><button className="primary" disabled={busy}>{editing ? "Lưu thương hiệu" : "Tạo thương hiệu"}</button><button type="button" disabled={busy} onClick={() => setEditing(null)}>Hủy</button></div>
      </form>
    </CatalogDialog>}
  </>;
}
