import { useEffect, useState, type FormEvent } from "react";
import type { AdminRequest } from "./ProductVariantsManager";

const blank = { name: "", slug: "", logo: "", status: true };
type Brand = typeof blank & { _id: string };

export default function BrandManager({ request }: { request: AdminRequest }) {
  const [brands, setBrands] = useState<Brand[]>();
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    request<Brand[]>("/brands?all=true", { signal: controller.signal })
      .then((data) => { if (!controller.signal.aborted) setBrands(data); })
      .catch((cause) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Không thể tải thương hiệu."); });
    return () => controller.abort();
  }, [request]);

  function reset() {
    setEditing("");
    setForm(blank);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const item = await request<Brand>(editing ? `/brands/${editing}` : "/brands", {
        method: editing ? "PATCH" : "POST", body: JSON.stringify(form),
      });
      setBrands((current) => [...(current ?? []).filter((brand) => brand._id !== item._id), item].sort((a, b) => a.name.localeCompare(b.name, "vi")));
      reset();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể lưu thương hiệu."); }
    finally { setBusy(false); }
  }

  return (
    <section className="admin-panel">
      <h2>Thương hiệu</h2>
      {error && <p role="alert" className="admin-alert">{error}</p>}
      <form onSubmit={save}>
        <fieldset className="admin-form variant-fieldset" disabled={busy || !brands}>
          <legend>{editing ? "Sửa thương hiệu" : "Thêm thương hiệu"}</legend>
          <label>Tên thương hiệu<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
          <label>Slug thương hiệu<input required value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} /></label>
          <label>Đường dẫn logo<input value={form.logo} onChange={(event) => setForm({ ...form, logo: event.target.value })} /></label>
          <label>Trạng thái<select value={String(form.status)} onChange={(event) => setForm({ ...form, status: event.target.value === "true" })}><option value="true">Hoạt động</option><option value="false">Đã ẩn</option></select></label>
          <div className="admin-actions"><button className="admin-button">{editing ? "Lưu thương hiệu" : "Tạo thương hiệu"}</button>
            {editing && <button type="button" onClick={reset}>Hủy</button>}
          </div>
        </fieldset>
      </form>
      {!brands && !error && <p role="status">Đang tải thương hiệu...</p>}
      {brands?.map(({ _id, ...brand }) => (
        <div className="admin-actions" key={_id}>
          <span>{brand.name} · {brand.status ? "Hoạt động" : "Đã ẩn"}</span>
          <button type="button" disabled={busy} onClick={() => { setEditing(_id); setForm(brand); }}>Sửa</button>
        </div>
      ))}
    </section>
  );
}
