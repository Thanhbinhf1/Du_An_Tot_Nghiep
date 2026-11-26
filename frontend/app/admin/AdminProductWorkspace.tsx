import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ApiError, resolveProductImage } from "@/lib/api";
import { useDemoAuth } from "@/lib/demo-auth";
import { catalogPayload, mergeMatrix, slugify, splitAttributes, validateCatalog, type CatalogState, type CatalogOption, type CatalogProduct, type CatalogVariant } from "@/lib/admin-catalog";
import type { AdminRequest, AdminPaginatedRequest } from "./ProductVariantsManager";
import CatalogDialog from "./CatalogDialog";
import AdminIcon from "./AdminIcon";
import AdminPagination from "./AdminPagination";
import type { ApiPagination } from "@/lib/api";
import "./admin-catalog.css";

const empty = (): CatalogState => ({ product: { name: "", product_code: "", slug: "", category_id: null, brand_id: null, gender: "Unisex", description: "", material: "", care_instructions: "", is_featured: false }, variants: [], images: [] });
type Listed = CatalogProduct & { _id: string; image?: string; variant_count?: number; stock?: number; available_stock?: number; min_price?: number | null; max_price?: number | null };
const catalogStates = [
  { id: "", countKey: "all", label: "Tổng sản phẩm", icon: "products", tone: "green" },
  { id: "published", countKey: "published", label: "Đang bán / đã xuất bản", icon: "store", tone: "green" },
  { id: "hidden", countKey: "hidden", label: "Ngừng bán", icon: "inventory", tone: "neutral" },
  { id: "draft", countKey: "draft", label: "Bản nháp", icon: "work", tone: "blue" },
] as const;
type Pending = { key: string; path: string; method: string; body: ReturnType<typeof catalogPayload> };
const editorSections = [
  { id: "information", title: "Thông tin", icon: "work" },
  { id: "images", title: "Hình ảnh", icon: "banners" },
  { id: "variants", title: "Biến thể", icon: "inventory" },
  { id: "review", title: "Kiểm tra", icon: "work" },
] as const;
type EditorSection = typeof editorSections[number]["id"];
const money = (n: number) => n.toLocaleString("vi-VN") + " ₫";
const inventoryLabels: Record<string, string> = { on_hand: "Thực tế tại kho", sellable: "Có thể bán", held: "Đang giữ cho đơn", in_transit: "Đang vận chuyển", awaiting_return: "Chờ hoàn", quarantine: "Cách ly", disposed_lifetime: "Đã loại bỏ (lũy kế)" };
function issueLabel(path: string) {
  const labels: Record<string,string> = { name:"Tên sản phẩm",product_code:"Mã sản phẩm",slug:"Đường dẫn",category_id:"Danh mục",brand_id:"Thương hiệu",description:"Mô tả",material:"Chất liệu",care_instructions:"Hướng dẫn bảo quản",gender:"Nhóm khách hàng",sku:"Mã SKU",size:"Kích cỡ",color:"Màu sắc",price:"Giá gốc",sale_price:"Giá giảm",stock_quantity:"Tồn ban đầu",image_url:"Đường dẫn ảnh",is_primary:"Ảnh chính",expected_version:"Phiên bản đã thay đổi" };
  const [group,index,field] = path.split(".");
  if (group === "product") return labels[index] ?? "Thông tin sản phẩm";
  if (group === "variants") return index === undefined ? "Bảng biến thể" : `Dòng SKU ${Number(index)+1} · ${labels[field] ?? "Thông tin biến thể"}`;
  if (group === "images") return index === undefined ? "Ảnh sản phẩm" : `Ảnh ${Number(index)+1} · ${labels[field] ?? "Thông tin ảnh"}`;
  return "Thông tin cần kiểm tra";
}
export default function AdminProductWorkspace({ request, paginatedRequest, initialSearch }: { request: AdminRequest; paginatedRequest: AdminPaginatedRequest; initialSearch: string }) {
  const { account } = useDemoAuth();
  const storageKey = `fstyle-catalog-pending:${account ?? "admin"}`;
  const [products, setProducts] = useState<Listed[]>([]), [categories, setCategories] = useState<CatalogOption[]>([]), [brands, setBrands] = useState<CatalogOption[]>([]);
  const [search, setSearch] = useState(initialSearch), [stateFilter, setStateFilter] = useState(""), [categoryFilter, setCategoryFilter] = useState(""), [page, setPage] = useState(1), [revision, setRevision] = useState(0);
  const [pagination, setPagination] = useState<ApiPagination>();
  const [limit, setLimit] = useState(10);
  const [sort, setSort] = useState("newest");
  const [brandFilter, setBrandFilter] = useState("");
  const [editor, setEditor] = useState<CatalogState | null>(null), [original, setOriginal] = useState(""), [slugManual, setSlugManual] = useState(false);
  const [sizes, setSizes] = useState(""), [colors, setColors] = useState(""), [basePrice, setBasePrice] = useState(""), [baseStock, setBaseStock] = useState("0"), [imageUrl, setImageUrl] = useState("");
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(""), [success, setSuccess] = useState("");
  const [submittedIssues, setSubmittedIssues] = useState<{ snapshot: CatalogState | null; fields: Record<string, string> }>();
  const [matrixError, setMatrixError] = useState("");
  const [imageError, setImageError] = useState("");
  const [pending, setPending] = useState<Pending | null>(null), [confirm, setConfirm] = useState<string | null>(null);
  const lock = useRef(false);
  const dirty = editor !== null && JSON.stringify(editor) !== original;
  const issues = submittedIssues?.snapshot === editor ? submittedIssues.fields : {};
  const category = categories.find((option) => option._id === editor?.product.category_id);
  const brand = brands.find((option) => option._id === editor?.product.brand_id);
  const publishIssues = editor ? validateCatalog(editor, true) : {};
  if (editor?.product.category_id && (!category || category.status === false)) publishIssues["product.category_id"] = "Chọn danh mục đang hoạt động.";
  if (editor?.product.brand_id && (!brand || brand.status === false)) publishIssues["product.brand_id"] = "Chọn thương hiệu đang hoạt động.";
  const missing = Object.entries(publishIssues);
  const visibleIssues = Object.keys(issues).length ? Object.entries(issues) : missing;
  const enabledVariants = editor?.variants.filter((row) => row.status) ?? [];
  const saveAction = !editor?.product._id || editor.product.publication_state === "draft" ? "draft" : "save";
  const productStatus = !editor?.product._id ? "Chưa lưu"
    : editor.product.status ? "Đã xuất bản" : editor.product.publication_state === "draft" ? "Bản nháp" : "Đang ẩn";

  function jumpTo(section: EditorSection) {
    const target = document.getElementById("product-editor-" + section);
    target?.scrollIntoView({ block: "start" });
    target?.focus({ preventScroll: true });
  }
  useEffect(() => { const timer = setTimeout(() => { try { const value = sessionStorage.getItem(storageKey); setPending(value ? JSON.parse(value) : null); } catch { /* Storage may be unavailable. */ } }, 0); return () => clearTimeout(timer); }, [storageKey]);
  useEffect(() => {
    const stop = (event: BeforeUnloadEvent) => { if (dirty || pending) event.preventDefault(); };
    window.addEventListener("beforeunload", stop); return () => window.removeEventListener("beforeunload", stop);
  }, [dirty, pending]);
  useEffect(() => {
    const controller = new AbortController();
    const filters = new URLSearchParams({ page: String(page), limit: String(limit), search, state: stateFilter, category_id: categoryFilter, brand_id: brandFilter, sort });
    paginatedRequest<Listed[]>(`/products/admin?${filters}`, { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) { setProducts(result.data); setPagination(result.pagination); setLoading(false); } })
      .catch(cause => { if (!controller.signal.aborted) { setError(String(cause.message)); setProducts([]); setPagination(undefined); setLoading(false); } });
    return () => controller.abort();
  }, [paginatedRequest, page, limit, search, stateFilter, categoryFilter, brandFilter, sort, revision]);
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([request<CatalogOption[]>("/categories?all=true", { signal: controller.signal }), request<CatalogOption[]>("/brands?all=true", { signal: controller.signal })])
      .then(([a, b]) => { if (!controller.signal.aborted) { setCategories(a); setBrands(b); } }).catch(cause => { if (!controller.signal.aborted) setError(cause.message); });
    return () => controller.abort();
  }, [request, revision]);
  function install(state: CatalogState) {
    setEditor(state);
    setOriginal(JSON.stringify(state));
    setSubmittedIssues(undefined);
    setMatrixError("");
    setImageError("");
    setSlugManual(!!state.product._id);
    setSizes("");
    setColors("");
    setBasePrice("");
    setBaseStock("0");
    setImageUrl("");
    setError("");
    setSuccess("");
  }
  async function open(id?: string) {
    if (dirty) { setConfirm(`switch:${id ?? "new"}`); return; }
    await load(id);
  }
  async function load(id?: string) {
    if (lock.current || pending) return; lock.current = true; setBusy(true);
    try { install(id ? await request<CatalogState>(`/products/${id}/admin/workspace`) : empty()); window.scrollTo(0, 0); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Không tải được sản phẩm."); }
    finally { lock.current = false; setBusy(false); }
  }
  function changeProduct(key: keyof CatalogProduct, value: string | boolean | null) {
    if (!editor) return;
    setEditor({ ...editor, product: { ...editor.product, [key]: value, ...(key === "name" && !slugManual ? { slug: slugify(String(value)) } : {}) } });
  }
  function changeRow(index: number, patch: Partial<CatalogVariant>) { if (editor) setEditor({ ...editor, variants: editor.variants.map((row, i) => i === index ? { ...row, ...patch } : row) }); }
  function fieldError(path: string) { return issues[path] ? <span id={`catalog-error-${path.replaceAll(".","-")}`} className="catalog-error" role="alert">{issues[path]}</span> : null; }
  function askSave(action: string) {
    if (!editor || pending) return;
    const found = action === "publish" ? publishIssues : validateCatalog(editor, action === "save" && editor.product.publication_state === "published");
    setSubmittedIssues({ snapshot: editor, fields: found });
    if (Object.keys(found).length) { jumpTo("review"); return; }
    setConfirm(action);
  }
  async function send(operation: Pending) {
    if (lock.current) return; lock.current = true; setBusy(true); setConfirm(null); setError(""); setSuccess(""); setPending(operation);
    try { sessionStorage.setItem(storageKey, JSON.stringify(operation)); } catch { /* In-memory recovery remains available. */ }
    try {
      const result = await request<CatalogState>(operation.path, { method: operation.method, signal: AbortSignal.timeout(20000), headers: { "Idempotency-Key": operation.key }, body: JSON.stringify(operation.body) });
      install(result); setPending(null); sessionStorage.removeItem(storageKey); setSuccess("Đã lưu thông tin, SKU và ảnh nhất quán."); setRevision(n => n + 1); window.dispatchEvent(new Event("fstyle-catalog-change"));
    } catch (cause) {
      if (cause instanceof ApiError && cause.status < 500) {
        setPending(null); sessionStorage.removeItem(storageKey);
        setSubmittedIssues({ snapshot: editor, fields: Object.fromEntries(cause.issues.map(issue => [issue.path, issue.message])) });
        if (cause.issues.length) jumpTo("review");
      }
      setError(cause instanceof Error ? cause.message : "Chưa xác định kết quả lưu. Kiểm tra hoặc gửi lại cùng yêu cầu bên dưới.");
    } finally { lock.current = false; setBusy(false); }
  }
  async function recover() {
    if (!pending || lock.current) return; lock.current = true; setBusy(true);
    try { const result = await request<CatalogState>(`/products/admin/requests/${pending.key}`, { signal: AbortSignal.timeout(20000) }); install(result); setPending(null); sessionStorage.removeItem(storageKey); setSuccess("Đã tìm thấy lần lưu thành công. Không tạo bản ghi trùng."); setRevision(n => n + 1); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Chưa tìm thấy kết quả."); }
    finally { lock.current = false; setBusy(false); }
  }
  async function upload(files: FileList | null) {
    if (!files?.length || !editor || lock.current || pending) return;
    if (files.length + editor.images.length > 30) { setImageError("Tối đa 30 ảnh."); return; }
    lock.current = true; setBusy(true); setImageError("");
    const failures: string[] = [];
    try {
      for (const file of Array.from(files)) {
        try {
          if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
            throw new Error("Chọn JPG, PNG hoặc WebP tối đa 5 MB.");
          }
          const form = new FormData();
          form.append("image", file);
          const result = await request<{ url: string }>("/admin/uploads", { method: "POST", body: form, signal: AbortSignal.timeout(20000) });
          setEditor(current => current && ({ ...current, images: [...current.images, { image_url: result.url, is_primary: !current.images.length }] }));
        } catch (cause) {
          failures.push(`${file.name} — ${cause instanceof Error ? cause.message : "Tải ảnh thất bại."}`);
        }
      }
      if (failures.length) setImageError(failures.join(" · "));
    }
    finally { lock.current = false; setBusy(false); }
  }
  function createVariants() {
    if (!editor) return;
    setMatrixError("");
    try {
      const selectedSizes = splitAttributes(sizes);
      const selectedColors = splitAttributes(colors);
      if (!selectedSizes.length || !selectedColors.length) throw new Error("Nhập ít nhất một size và một màu.");
      if ([...selectedSizes, ...selectedColors].some((value) => value.length > 60)) throw new Error("Mỗi giá trị size hoặc màu tối đa 60 ký tự.");
      const validNumber = (value: string) => /^\d+$/.test(value.trim()) && Number.isSafeInteger(Number(value));
      if (!validNumber(basePrice)) throw new Error("Nhập giá mặc định bằng số nguyên từ 0 trở lên.");
      if (!validNumber(baseStock)) throw new Error("Nhập tồn ban đầu bằng số nguyên từ 0 trở lên.");
      const variants = mergeMatrix(editor.variants, selectedSizes, selectedColors, editor.product.product_code ?? "", basePrice, baseStock);
      if (variants.length === editor.variants.length) { setMatrixError("Các tổ hợp này đã có trong bảng."); return; }
      setEditor({ ...editor, variants });
    } catch (cause) { setMatrixError((cause as Error).message); }
  }
  function addImageLink() {
    if (!editor) return;
    const url = imageUrl.trim();
    const external = URL.canParse(url) && ["http:", "https:"].includes(new URL(url).protocol);
    if (!external && !/^\/uploads\/[\w.-]+$/.test(url)) { setImageError("Nhập đường dẫn HTTP(S) hoặc đường dẫn tệp đã tải."); return; }
    if (editor.images.length >= 30) { setImageError("Tối đa 30 ảnh."); return; }
    setEditor({ ...editor, images: [...editor.images, { image_url: url, is_primary: !editor.images.length }] });
    setImageError("");
    setImageUrl("");
  }
  return <div className="catalog">
      {error && <p className="catalog-notice" role="alert">{error} <button disabled={busy} onClick={() => setRevision(n => n + 1)}>Tải lại danh sách</button></p>}{success && <p className="catalog-success" role="status">{success}</p>}
      {pending && <div className="catalog-notice catalog-recovery" role="status"><strong>Lần lưu trước chưa được xác nhận.</strong><p>Giữ nguyên yêu cầu để tránh tạo trùng. Bạn có thể kiểm tra kết quả hoặc gửi lại an toàn.</p><button disabled={busy} onClick={() => void recover()}>Kiểm tra kết quả lưu</button> <button disabled={busy} onClick={() => void send(pending)}>Gửi lại cùng yêu cầu</button></div>}
    <div className="catalog-list-panel" hidden={!!editor}>
      <div className="admin-adminlist-header"><p className="admin-muted">Quản lý sản phẩm, biến thể, giá bán và trạng thái xuất bản.</p><button className="primary admin-inline-icon" disabled={busy || !!pending} onClick={() => void open()}><AdminIcon name="plus" /> Tạo sản phẩm mới</button></div>
      <section className="admin-metric-grid" aria-label="Tình trạng xuất bản sản phẩm">
        {catalogStates.map(({ id, countKey, label, icon, tone }) => <button className="admin-metric-card" type="button" key={countKey} aria-pressed={stateFilter === id} onClick={() => { if (stateFilter !== id) { setStateFilter(id); setPage(1); setLoading(true); } }}>
          <span className={"admin-tile-icon tone-" + tone}><AdminIcon name={icon} /></span>
          <span><span>{label}</span><strong>{loading ? "—" : pagination?.statusCounts?.[countKey]?.toLocaleString("vi-VN") ?? "—"}</strong></span>
        </button>)}
      </section>
      <div className="admin-panel">
      <div className="catalog-filters"><label className="admin-list-search">Tìm sản phẩm<input placeholder="Tên hoặc mã sản phẩm" maxLength={100} value={search} onChange={e => { setSearch(e.target.value); setPage(1); setLoading(true); }} /></label><label>Trạng thái<select value={stateFilter} onChange={e => { setStateFilter(e.target.value); setPage(1); setLoading(true); }}><option value="">Tất cả</option><option value="published">Đang bán</option><option value="draft">Bản nháp</option><option value="hidden">Đã ẩn</option></select></label><label>Lọc danh mục<select value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setPage(1); setLoading(true); }}><option value="">Tất cả danh mục</option>{categories.map(row => <option key={row._id} value={row._id}>{row.name}</option>)}</select></label>
        <label>Lọc thương hiệu<select value={brandFilter} onChange={event => { setBrandFilter(event.target.value); setPage(1); setLoading(true); }}>
          <option value="">Tất cả thương hiệu</option>
          {brands.map(brand => <option key={brand._id} value={brand._id}>{brand.name}</option>)}
        </select></label>
        <label>Sắp xếp<select value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); setLoading(true); }}><option value="newest">Mới nhất</option><option value="name">Tên A–Z</option></select></label>
      </div>
      <div className="catalog-table-wrap" role="region" aria-label="Bảng sản phẩm" tabIndex={0} aria-busy={loading}>
        <table className="catalog-list"><thead><tr><th>Sản phẩm</th><th>Mã sản phẩm</th><th>Danh mục</th><th>Biến thể</th><th>Khoảng giá</th><th>Tồn chưa phân bổ</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>
          {loading || !products.length ? <tr><td className="catalog-empty" colSpan={8}>{loading ? "Đang tải sản phẩm…" : "Không có sản phẩm phù hợp."}</td></tr> : products.map((product) => {
            const out = product.status && product.available_stock === 0;
            const status = product.status ? (out ? "Hết hàng" : "Đang bán") : product.publication_state === "draft" ? "Bản nháp" : "Ngừng bán";
            const tone = product.status ? (out ? "red" : "green") : product.publication_state === "draft" ? "blue" : "neutral";
            const category = categories.find((item) => item._id === product.category_id);
            return <tr key={product._id}>
              <td><div className="admin-table-product">
                {product.image ? <Image src={resolveProductImage(product.image)} alt="" width={36} height={40} unoptimized /> : <span className="admin-tile-icon tone-neutral"><AdminIcon name="products" /></span>}
                <strong>{product.name}</strong>
              </div></td>
              <td>{product.product_code || "—"}</td><td>{category?.name ?? "—"}</td><td>{product.variant_count ?? 0} SKU</td>
              <td>{product.min_price == null ? "Chưa có giá" : product.max_price != null && product.max_price !== product.min_price ? money(product.min_price) + " – " + money(product.max_price) : money(product.min_price)}</td>
              <td>{product.stock ?? "—"}</td><td><span className={"admin-data-pill tone-" + tone}>{status}</span></td>
              <td><button disabled={busy || !!pending} onClick={() => void open(product._id)} aria-label={`Quản lý ${product.name}`}>Quản lý</button></td>
            </tr>;
          })}
        </tbody></table>
      </div>
      <div className="catalog-page"><AdminPagination page={page} pagination={{ ...pagination, totalPages: pagination?.totalPages ?? 1, limit }} loading={loading} onPage={(value) => { setPage(value); setLoading(true); }} onLimit={(value) => { setLimit(value); setPage(1); setLoading(true); }} /></div>
      </div>
    </div>
    {editor && <section className="catalog-editor product-editor" aria-label="Workspace sản phẩm">
      <div className="catalog-toolbar product-editor-header">
        <div>
          <button className="product-editor-back" disabled={busy || !!pending} onClick={() => dirty ? setConfirm("close") : setEditor(null)}>← Sản phẩm & Biến thể</button>
          <h1>{editor.product._id ? editor.product.name : "Tạo sản phẩm mới"}</h1>
          <p>Thiết lập thông tin, ảnh và ma trận biến thể trước khi xuất bản.</p>
        </div>
        <div className="product-editor-actions">
          <span className="catalog-badge">{productStatus}{dirty ? " · Có thay đổi chưa lưu" : ""}</span>
          <button disabled={busy || !!pending} onClick={() => askSave(saveAction)}>{saveAction === "draft" ? "Lưu nháp" : "Lưu thay đổi"}</button>
          {editor.product.status ? <button className="danger" disabled={busy || !!pending} onClick={() => askSave("hide")}>Ẩn sản phẩm</button> : <button className="primary" onClick={() => jumpTo("review")}>Kiểm tra & xuất bản</button>}
        </div>
      </div>
      <nav className="product-editor-nav" aria-label="Các phần sản phẩm">
        {editorSections.map(({ id, title, icon }) => <button key={id} type="button" onClick={() => jumpTo(id)}><AdminIcon name={icon} />{title}</button>)}
      </nav>
      <fieldset disabled={busy || !!pending}>
        <div className="product-editor-top">
          <section className="product-editor-card" id="product-editor-information" tabIndex={-1}>
            <h3>Thông tin sản phẩm</h3>

<div className="catalog-fields">{([['name','Tên sản phẩm'],['product_code','Mã sản phẩm'],['slug','Đường dẫn (slug)']] as const).map(([key,label]) => <label key={key}>{label}<input aria-label={label} maxLength={key === "product_code" ? 60 : 200} aria-invalid={!!issues[`product.${key}`]} aria-describedby={issues[`product.${key}`] ? `catalog-error-product-${key}` : undefined} value={editor.product[key] ?? ""} onChange={e => { if (key === "slug") setSlugManual(true); changeProduct(key, e.target.value); }} />{fieldError(`product.${key}`)}</label>)}
          <label>Danh mục<select aria-label="Danh mục" value={editor.product.category_id ?? ""} aria-invalid={!!issues['product.category_id']} aria-describedby={issues['product.category_id'] ? "catalog-error-product-category_id" : undefined} onChange={e => changeProduct("category_id", e.target.value || null)}><option value="">Chưa phân loại (bản nháp)</option>{categories.map(row => <option value={row._id} key={row._id}>{row.name}{row.status === false ? " (đã ẩn)" : ""}</option>)}</select>{fieldError('product.category_id')}</label>
          <label>Thương hiệu<select aria-label="Thương hiệu" value={editor.product.brand_id ?? ""} aria-invalid={!!issues['product.brand_id']} aria-describedby={issues['product.brand_id'] ? "catalog-error-product-brand_id" : undefined} onChange={e => changeProduct("brand_id", e.target.value || null)}><option value="">Chưa chọn (bản nháp)</option>{brands.map(row => <option value={row._id} key={row._id}>{row.name}{row.status === false ? " (đã ẩn)" : ""}</option>)}</select>{fieldError('product.brand_id')}</label>
          <label>Nhóm khách hàng<select value={editor.product.gender ?? ""} onChange={e => changeProduct("gender", e.target.value)}><option value="">Chưa phân loại</option>{["Nam","Nữ","Trẻ em","Em bé","Unisex"].map(x => <option key={x}>{x}</option>)}</select></label>
          {([['description','Mô tả'],['material','Chất liệu'],['care_instructions','Hướng dẫn bảo quản']] as const).map(([key,label]) => <label key={key} className={key === 'description' ? 'wide' : ''}>{label}<textarea maxLength={key === 'description' ? 10000 : 2000} value={editor.product[key] ?? ""} onChange={e => changeProduct(key,e.target.value)} />{fieldError(`product.${key}`)}</label>)}
          <label>Nổi bật<select value={String(!!editor.product.is_featured)} onChange={e => changeProduct('is_featured',e.target.value === 'true')}><option value="false">Bình thường</option><option value="true">Nổi bật</option></select></label>
        </div>
          </section>
          <section className="product-editor-card product-editor-media" id="product-editor-images" tabIndex={-1}>
            <div className="catalog-actions"><h3>Hình ảnh sản phẩm</h3><span className="catalog-badge">{editor.images.length}/30 ảnh</span></div>
            <label className="product-upload-zone" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void upload(event.dataTransfer.files); }}>
              <AdminIcon name="banners" />
              <strong>Tải ảnh sản phẩm</strong>
              <span>Kéo thả hoặc bấm để chọn ảnh</span>
              <small>JPG, PNG, WebP · Tối đa 5 MB mỗi ảnh</small>
              <input className="sr-only" aria-label="Tải ảnh sản phẩm" type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={(event) => { void upload(event.target.files); event.target.value = ""; }} />
            </label>
            <div className="product-image-link">
              <label>Hoặc đường dẫn ảnh<input value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} /></label>
              <button type="button" onClick={addImageLink}>Thêm ảnh từ URL</button>
            </div>
            {imageError && <p className="catalog-error" role="alert">{imageError}</p>}
            {fieldError("images")}
          <div className="catalog-images">{editor.images.map((image,i) => <article className="catalog-image" key={image._id ?? `${i}:${image.image_url}`}><Image src={resolveProductImage(image.image_url)} width={260} height={180} unoptimized alt={`Ảnh sản phẩm ${i+1}`} /><label>Màu ảnh {i+1}<select aria-label={`Màu ảnh ${i+1}`} value={image.color ?? ''} onChange={e => setEditor({...editor,images:editor.images.map((row,j) => j === i ? {...row,color:e.target.value} : row)})}><option value="">Ảnh chung</option>{[...new Set(editor.variants.map(row => row.color).filter(Boolean))].map(c => <option key={c}>{c}</option>)}</select></label>{fieldError(`images.${i}.color`)}{fieldError(`images.${i}.image_url`)}<button aria-pressed={image.is_primary} onClick={() => setEditor({...editor,images:editor.images.map((row,j) => ({...row,is_primary:i === j}))})}>{image.is_primary ? '✓ Ảnh chính' : 'Đặt ảnh chính'}</button><div className="catalog-actions"><button aria-label={`Đưa ảnh ${i+1} lên`} disabled={i===0} onClick={() => { const images=[...editor.images]; [images[i-1],images[i]]=[images[i],images[i-1]];setEditor({...editor,images}); }}>↑</button><button aria-label={`Đưa ảnh ${i+1} xuống`} disabled={i===editor.images.length-1} onClick={() => {const images=[...editor.images];[images[i],images[i+1]]=[images[i+1],images[i]];setEditor({...editor,images});}}>↓</button><button className="danger" onClick={() => {const images=editor.images.filter((_,j) => i!==j);if(image.is_primary && images.length) images[0]={...images[0],is_primary:true};setEditor({...editor,images});}}>Bỏ ảnh</button></div></article>)}</div><p>Chọn một ảnh đại diện. Có thể gắn ảnh theo màu sau khi thêm SKU.</p>
          </section>
        </div>
        <section className="product-editor-card" id="product-editor-variants" tabIndex={-1}>
          <div className="catalog-actions"><h3>Ma trận biến thể size × màu</h3><span className="catalog-badge">{editor.variants.length} SKU</span></div>
          <p>Đặt giá và tồn ban đầu cho các tổ hợp mới. Các SKU đã có giữ nguyên giá và số lượng.</p>

          <div className="catalog-matrix">
            <label>Size<input aria-label="Size (cách nhau bằng dấu phẩy)" value={sizes} onChange={(event) => setSizes(event.target.value)} placeholder="VD: S, M, L" /></label>
            <label>Màu sắc<input aria-label="Màu (cách nhau bằng dấu phẩy)" value={colors} onChange={(event) => setColors(event.target.value)} placeholder="VD: Đen, Trắng" /></label>
            <label>Giá mặc định (₫)<input aria-label="Giá mặc định" inputMode="numeric" value={basePrice} onChange={(event) => setBasePrice(event.target.value)} placeholder="VD: 199000" /></label>
            <label>Tồn ban đầu<input aria-label="Tồn đầu mặc định" inputMode="numeric" value={baseStock} onChange={(event) => setBaseStock(event.target.value)} /></label>
            <button className="primary" type="button" onClick={createVariants}>Tạo tổ hợp SKU</button>
          </div>
          {matrixError && <p className="catalog-error" role="alert">{matrixError}</p>}
          <div className="catalog-actions product-variant-actions"><strong>Danh sách SKU</strong><button onClick={() => setEditor({ ...editor, variants: [...editor.variants,{ key: crypto.randomUUID(),sku:'',size:'',color:'',price:'',sale_price:null,stock_quantity:0,status:true }] })} disabled={editor.variants.length >= 200}>Thêm dòng thủ công</button></div>{fieldError('variants')}
          <div className="catalog-table-wrap" role="region" aria-label="Bảng SKU" tabIndex={0}><table className="catalog-variants"><thead><tr><th>SKU</th><th>Size</th><th>Màu</th><th>Giá gốc</th><th>Giá giảm</th><th>Tồn chưa phân bổ</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{editor.variants.map((row,i) => <tr key={row._id ?? row.key}><td>{(['sku','size','color','price','sale_price','stock_quantity'] as const).slice(0,1).map(key => <label key={key}><span className="sr-only">{key} dòng {i+1}</span><input aria-label={`SKU dòng ${i+1}`} readOnly={!!row.order_count} value={row.sku} aria-invalid={!!issues[`variants.${i}.sku`]} aria-describedby={issues[`variants.${i}.sku`] ? `catalog-error-variants-${i}-sku` : undefined} onChange={e => changeRow(i,{sku:e.target.value})}/>{fieldError(`variants.${i}.sku`)}</label>)}{!!row.order_count && <small>Có lịch sử đơn</small>}</td>
            {(['size','color','price','sale_price','stock_quantity'] as const).map(key => <td key={key}><input aria-label={`${({size:'Size',color:'Màu',price:'Giá gốc',sale_price:'Giá giảm',stock_quantity:'Tồn'})[key]} dòng ${i+1}`} readOnly={key === 'stock_quantity' ? !!row._id : ['size','color'].includes(key) && !!row.order_count} inputMode={['price','sale_price','stock_quantity'].includes(key) ? 'numeric' : 'text'} value={row[key] ?? ''} aria-invalid={!!issues[`variants.${i}.${key}`]} aria-describedby={issues[`variants.${i}.${key}`] ? `catalog-error-variants-${i}-${key}` : undefined} onChange={e => changeRow(i,{[key]:e.target.value})}/>{fieldError(`variants.${i}.${key}`)}{key === 'stock_quantity' && row._id && <small><a href="/admin#inventory">Điều chỉnh tại kho</a></small>}</td>)}
            <td><select aria-label={`Trạng thái dòng ${i+1}`} value={String(row.status)} onChange={e => changeRow(i,{status:e.target.value === 'true'})}><option value="true">Bật bán</option><option value="false">Ngừng bán</option></select>{row.status && Number(row.stock_quantity) === 0 && <small className="product-stock-out">Hết hàng</small>}</td><td>{!row._id && <button onClick={() => setEditor({...editor,variants:editor.variants.filter((_,index) => index !== i)})}>Bỏ dòng</button>}</td></tr>)}</tbody></table>{!editor.variants.length && <p className="catalog-empty">Chưa có SKU. Nhập size, màu và giá để tạo tổ hợp hoặc thêm một dòng thủ công.</p>}</div>
        </section>
        <section className="product-editor-card product-editor-review" id="product-editor-review" tabIndex={-1}>
          <div className="catalog-actions">
            <h3>Kiểm tra trước khi xuất bản</h3>
            <span className={"admin-data-pill tone-" + (missing.length ? "amber" : "green")}>{missing.length ? missing.length + " mục cần bổ sung" : "Đủ điều kiện trên biểu mẫu"}</span>
          </div>
          <div className="product-review-grid">
            <div><span>Sản phẩm</span><strong>{editor.product.name.trim() || "Chưa nhập tên"}</strong><small>{editor.product.product_code || "Chưa nhập mã"}</small></div>
            <div><span>Phân loại</span><strong>{category?.name ?? "Chưa chọn danh mục"}</strong><small>{brand?.name ?? "Chưa chọn thương hiệu"}</small></div>
            <div><span>Hình ảnh</span><strong>{editor.images.length} ảnh</strong><small>{editor.images.some((image) => image.is_primary) ? "Đã chọn ảnh đại diện" : "Chưa có ảnh đại diện"}</small></div>
            <div><span>Biến thể</span><strong>{editor.variants.length} SKU</strong><small>{enabledVariants.length} bật bán · {enabledVariants.filter((row) => Number(row.stock_quantity) > 0).length} còn hàng</small></div>
          </div>
          {visibleIssues.length > 0 && <div className="catalog-errors">
            <strong>{Object.keys(issues).length ? "Thông tin cần sửa" : "Điều kiện còn thiếu"}</strong>
            <ul>{visibleIssues.map(([path, message]) => <li key={path}><button type="button" onClick={() => jumpTo(path.startsWith("variants") ? "variants" : path.startsWith("images") ? "images" : "information")}>{issueLabel(path)} · {message}</button></li>)}</ul>
          </div>}
          {editor.product.status
            ? <p>Thay đổi đã lưu sẽ cập nhật sản phẩm trên cửa hàng.</p>
            : <p>Bản nháp chỉ hiển thị trong Admin. SKU đã bật bán nhưng tồn bằng 0 sẽ hiển thị hết hàng.</p>}
          {!editor.product.status && <div className="product-editor-actions"><button className="primary" disabled={missing.length > 0} onClick={() => askSave("publish")}>Xuất bản sản phẩm</button></div>}
          {editor.inventory && <details className="product-editor-stock"><summary>Tồn kho theo nghiệp vụ</summary>
            <div className="catalog-inventory">{Object.entries(inventoryLabels).map(([key,label]) => <span key={key}>{label}<br /><strong>{editor.inventory?.[key] ?? 0}</strong></span>)}</div>
          </details>}
        </section>
      </fieldset>
      {busy && <p role="status">Đang xử lý…</p>}
    </section>}

    {confirm && <CatalogDialog title={confirm === 'close' || confirm.startsWith('switch:') ? 'Rời bản đang sửa?' : confirm === 'hide' ? 'Ẩn sản phẩm?' : 'Xác nhận lưu sản phẩm'} close={() => setConfirm(null)}><p>{confirm === 'hide' ? 'Khách sẽ không thể mua sản phẩm. SKU, hình ảnh và lịch sử đơn hàng được giữ nguyên.' : confirm === 'close' || confirm.startsWith('switch:') ? 'Các thay đổi chưa lưu sẽ được bỏ. Dữ liệu đã lưu không bị xóa.' : 'Thông tin sản phẩm, biến thể và hình ảnh sẽ được kiểm tra và lưu cùng nhau.'}</p><div className="catalog-actions"><button onClick={() => setConfirm(null)}>Tiếp tục chỉnh sửa</button><button className="primary" onClick={() => { const action=confirm;setConfirm(null);if(action==='close'){setEditor(null);return;}if(action.startsWith('switch:')){void load(action.slice(7)==='new'?undefined:action.slice(7));return;}if(editor)void send({key:crypto.randomUUID(),path:editor.product._id?`/products/${editor.product._id}/admin/workspace`:'/products/admin/workspace',method:editor.product._id?'PATCH':'POST',body:catalogPayload(editor,action)}); }}>Xác nhận</button></div></CatalogDialog>}
  </div>;
}
