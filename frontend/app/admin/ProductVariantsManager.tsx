import { useEffect, useState, type FormEvent } from "react";

type AdminRequest = <T>(path: string, init?: RequestInit) => Promise<T>;
type Option = { _id: string; name: string };
type ManagedProduct = Option & { status: boolean };
type Variant = {
  _id: string; sku: string; size: string; color: string; price: number;
  sale_price: number | null; stock_quantity: number; status: boolean;
};
const emptyProduct = { name: "", slug: "", category_id: "", brand_id: "", description: "" };
const emptyVariant = { sku: "", size: "", color: "", price: "", sale_price: "", stock_quantity: "0", status: true };
const money = (value: number) => `${new Intl.NumberFormat("vi-VN").format(value)} ₫`;

export default function ProductVariantsManager({ request }: { request: AdminRequest }) {
  const [products, setProducts] = useState<ManagedProduct[]>([]);
  const [categories, setCategories] = useState<Option[]>([]);
  const [brands, setBrands] = useState<Option[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [loadedRevision, setLoadedRevision] = useState(-1);
  const [loadedPage, setLoadedPage] = useState(0);
  const [form, setForm] = useState(emptyProduct);
  const [showCreate, setShowCreate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [optionsError, setOptionsError] = useState("");
  const [success, setSuccess] = useState("");
  const loading = loadedPage !== page || loadedRevision !== revision;

  useEffect(() => {
    const controller = new AbortController();
    request<ManagedProduct[]>(`/products/admin?page=${page}&limit=25`, { signal: controller.signal })
      .then((data) => {
        setProducts(data);
        setSelectedId((current) => data.some((product) => product._id === current) ? current : data[0]?._id ?? "");
        setError("");
      })
      .catch((cause) => { if (!controller.signal.aborted) { setProducts([]); setSelectedId(""); setError(cause instanceof Error ? cause.message : "Không tải được sản phẩm."); } })
      .finally(() => { if (!controller.signal.aborted) { setLoadedPage(page); setLoadedRevision(revision); } });
    return () => controller.abort();
  }, [page, request, revision]);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      request<Option[]>("/categories", { signal: controller.signal }),
      request<Option[]>("/brands", { signal: controller.signal }),
    ]).then(([categoryData, brandData]) => { setCategories(categoryData); setBrands(brandData); setOptionsError(""); })
      .catch((cause) => { if (!controller.signal.aborted) setOptionsError(cause instanceof Error ? cause.message : "Không tải được danh mục/thương hiệu."); });
    return () => controller.abort();
  }, [request, revision]);

  async function createProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(""); setSuccess("");
    try {
      const product = await request<ManagedProduct>("/products", { method: "POST", body: JSON.stringify(form) });
      setForm(emptyProduct); setShowCreate(false); setSelectedId(product._id);
      setPage(1); setRevision((value) => value + 1);
      setSuccess("Đã tạo sản phẩm. Bạn có thể thêm biến thể bên dưới.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể tạo sản phẩm."); }
    finally { setBusy(false); }
  }

  const selected = products.find((product) => product._id === selectedId);
  return (
    <>
      <div className="admin-panel">
        <div className="admin-toolbar">
          <div><h2>Biến thể sản phẩm</h2><p className="admin-muted">Chọn sản phẩm để quản lý size, màu, giá và tồn kho.</p></div>
          <button className="admin-button" disabled={busy} onClick={() => setShowCreate(!showCreate)}>{showCreate ? "Đóng form" : "Tạo sản phẩm mới"}</button>
        </div>
        {error && <p className="admin-alert" role="alert">{error} <button onClick={() => setRevision((value) => value + 1)}>Tải lại</button></p>}
        {optionsError && <p className="admin-alert" role="alert">{optionsError} <button onClick={() => setRevision((value) => value + 1)}>Tải lại danh mục và thương hiệu</button></p>}
        {success && <p className="admin-success" role="status">{success}</p>}
        {showCreate && (
          <form onSubmit={createProduct}>
            <fieldset className="admin-form variant-fieldset" disabled={busy}>
              <legend>Tạo sản phẩm để thêm biến thể</legend>
              <label>Tên sản phẩm<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
              <label>Đường dẫn sản phẩm<input required placeholder="ao-thun-cotton" value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} /></label>
              <label>Danh mục<select required value={form.category_id} onChange={(event) => setForm({ ...form, category_id: event.target.value })}><option value="">Chọn danh mục</option>{categories.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</select></label>
              <label>Thương hiệu<select required value={form.brand_id} onChange={(event) => setForm({ ...form, brand_id: event.target.value })}><option value="">Chọn thương hiệu</option>{brands.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</select></label>
              <label className="wide">Mô tả<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
              <div className="admin-actions wide"><button className="admin-button" disabled={!categories.length || !brands.length}>{busy ? "Đang tạo..." : "Tạo sản phẩm"}</button></div>
              {(!categories.length || !brands.length) && <p className="admin-muted wide">Cần có danh mục và thương hiệu trước khi tạo sản phẩm.</p>}
            </fieldset>
          </form>
        )}
        <div className="admin-form variant-picker">
          <label className="wide">Sản phẩm<select value={selectedId} disabled={loading || busy} onChange={(event) => { setSelectedId(event.target.value); setSuccess(""); }}>
            <option value="">{loading ? "Đang tải sản phẩm..." : "Chọn sản phẩm"}</option>
            {products.map((product) => <option key={product._id} value={product._id}>{product.name}{product.status ? "" : " (Đã tắt)"}</option>)}
          </select></label>
        </div>
        {!loading && !products.length && !error && <p className="admin-muted">Trang này chưa có sản phẩm. Bạn có thể tạo sản phẩm mới ở trên.</p>}
        <div className="admin-actions variant-pagination">
          <button disabled={loading || busy || page === 1} onClick={() => setPage(page - 1)}>Trang trước</button>
          <span>Trang {page}</span>
          <button disabled={loading || busy || products.length < 25} onClick={() => setPage(page + 1)}>Trang sau</button>
        </div>
      </div>
      {selected && !loading && <VariantEditor key={selected._id} product={selected} request={request} />}
    </>
  );
}

function VariantEditor({ product, request }: { product: ManagedProduct; request: AdminRequest }) {
  const [variants, setVariants] = useState<Variant[]>([]);
  const [form, setForm] = useState(emptyVariant);
  const [editing, setEditing] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [revision, setRevision] = useState(0);
  const path = `/products/${product._id}/variants`;

  useEffect(() => {
    const controller = new AbortController();
    request<Variant[]>(`${path}/admin`, { signal: controller.signal })
      .then((data) => { setVariants(data); setError(""); })
      .catch((cause) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Không tải được biến thể."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [path, request, revision]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(""); setSuccess("");
    const price = Number(form.price);
    const salePrice = form.sale_price === "" ? null : Number(form.sale_price);
    const stock = Number(form.stock_quantity);
    if (!form.price.trim() || !Number.isFinite(price) || price < 0 ||
        (salePrice !== null && (!Number.isFinite(salePrice) || salePrice < 0 || salePrice > price)) ||
        !form.stock_quantity.trim() || !Number.isSafeInteger(stock) || stock < 0) {
      setError("Kiểm tra lại giá, giá khuyến mãi và số lượng tồn kho."); return;
    }
    setBusy(true);
    try {
      const saved = await request<Variant>(editing ? `${path}/${editing}` : path, {
        method: editing ? "PATCH" : "POST",
        body: JSON.stringify({ ...form, price, sale_price: salePrice, stock_quantity: stock }),
      });
      setVariants((current) => editing ? current.map((item) => item._id === saved._id ? saved : item) : [...current, saved]);
      setForm(emptyVariant); setEditing(null);
      setSuccess(editing ? "Đã lưu thay đổi biến thể." : "Đã thêm biến thể.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể lưu biến thể."); }
    finally { setBusy(false); }
  }

  async function toggleStatus(variant: Variant) {
    setBusy(true); setError(""); setSuccess("");
    try {
      const saved = await request<Variant>(`${path}/${variant._id}`, {
        method: variant.status ? "DELETE" : "PATCH",
        ...(variant.status ? {} : { body: JSON.stringify({ status: true }) }),
      });
      setVariants((current) => current.map((item) => item._id === saved._id ? saved : item));
      if (editing === saved._id) setForm((current) => ({ ...current, status: saved.status }));
      setSuccess(variant.status ? "Đã ngừng bán biến thể." : "Đã bật bán lại biến thể.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể đổi trạng thái."); }
    finally { setBusy(false); }
  }

  function edit(variant: Variant) {
    setEditing(variant._id); setError(""); setSuccess("");
    setForm({ sku: variant.sku, size: variant.size, color: variant.color, price: String(variant.price), sale_price: variant.sale_price == null ? "" : String(variant.sale_price), stock_quantity: String(variant.stock_quantity), status: variant.status });
  }

  return (
    <div className="admin-panel" aria-busy={busy || loading}>
      <h2>{product.name}</h2>
      {!product.status && <p className="admin-muted">Sản phẩm đã tắt hiển thị. Bạn vẫn có thể quản lý các biến thể bên dưới.</p>}
      {error && <p className="admin-alert" role="alert">{error} <button disabled={busy} onClick={() => { setLoading(true); setRevision((value) => value + 1); }}>Tải lại danh sách</button></p>}
      {success && <p className="admin-success" role="status">{success}</p>}
      <form onSubmit={save}>
        <fieldset className="admin-form variant-fieldset" disabled={busy || loading}>
          <legend>{editing ? "Sửa biến thể" : "Thêm biến thể"}</legend>
          <label>SKU<input required placeholder="AO-001-M-DEN" value={form.sku} onChange={(event) => setForm({ ...form, sku: event.target.value })} /></label>
          <label>Kích cỡ<input required placeholder="M" value={form.size} onChange={(event) => setForm({ ...form, size: event.target.value })} /></label>
          <label>Màu sắc<input required placeholder="Đen" value={form.color} onChange={(event) => setForm({ ...form, color: event.target.value })} /></label>
          <label>Giá gốc (VND)<input required type="number" min="0" step="any" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} /></label>
          <label>Giá khuyến mãi (VND, có thể để trống)<input type="number" min="0" max={form.price || undefined} step="any" value={form.sale_price} onChange={(event) => setForm({ ...form, sale_price: event.target.value })} /></label>
          <label>Tồn kho<input required type="number" min="0" step="1" max={Number.MAX_SAFE_INTEGER} value={form.stock_quantity} onChange={(event) => setForm({ ...form, stock_quantity: event.target.value })} /></label>
          <label>Trạng thái<select value={String(form.status)} onChange={(event) => setForm({ ...form, status: event.target.value === "true" })}><option value="true">Đang bán</option><option value="false">Ngừng bán</option></select></label>
          <div className="admin-actions wide">
            <button className="admin-button">{busy ? "Đang lưu..." : editing ? "Lưu thay đổi" : "Thêm biến thể"}</button>
            {editing && <button type="button" onClick={() => { setEditing(null); setForm(emptyVariant); setError(""); }}>Hủy sửa</button>}
          </div>
        </fieldset>
      </form>
      {loading ? <p role="status">Đang tải biến thể...</p> : (
        <div className="variant-table-wrap"><table className="admin-table">
          <caption className="variant-caption">{variants.length} biến thể</caption>
          <thead><tr><th scope="col">SKU</th><th scope="col">Size / Màu</th><th scope="col">Giá gốc</th><th scope="col">Giá giảm</th><th scope="col">Tồn kho</th><th scope="col">Trạng thái</th><th scope="col">Thao tác</th></tr></thead>
          <tbody>{variants.map((variant) => <tr key={variant._id}>
            <td>{variant.sku}</td><td>{variant.size} / {variant.color}</td><td>{money(variant.price)}</td><td>{variant.sale_price == null ? "—" : money(variant.sale_price)}</td><td>{variant.stock_quantity}</td>
            <td><span className={`variant-status ${variant.status ? "selling" : "stopped"}`}>{variant.status ? "Đang bán" : "Ngừng bán"}</span></td>
            <td><div className="admin-actions"><button disabled={busy} onClick={() => edit(variant)}>Sửa<span className="sr-only"> {variant.sku}</span></button><button disabled={busy} className={variant.status ? "danger" : ""} onClick={() => void toggleStatus(variant)}>{variant.status ? "Ngừng bán" : "Bật bán lại"}<span className="sr-only"> {variant.sku}</span></button></div></td>
          </tr>)}</tbody>
        </table>{!variants.length && <p className="admin-muted">Chưa có biến thể. Thêm size và màu đầu tiên bằng form bên trên.</p>}</div>
      )}
    </div>
  );
}
