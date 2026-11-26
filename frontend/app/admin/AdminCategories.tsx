import { useEffect, useRef, useState, type FormEvent } from "react";
import { ApiError, resolveProductImage } from "@/lib/api";
import { categoryDescendants, slugify, type CatalogOption } from "@/lib/admin-catalog";
import { useDemoAuth } from "@/lib/demo-auth";
import type { AdminRequest } from "./ProductVariantsManager";
import CatalogDialog from "./CatalogDialog";
import "./admin-catalog.css";
type Category = CatalogOption & { slug: string; image?: string; description?: string; __v?: number; direct_products: number; branch_products: number; children: number; effective_visible: boolean; updated_at?: string; reserved_navigation?: boolean };
type Impact = { category: Category; children: number; direct_products: number; legacy_products: number; size_rules: number; reserved_navigation: boolean; can_delete: boolean; reasons: string[]; policy: string };
type CategoryOperation = {key:string;body:string;path:string;method:string};
const blank = () => ({ name: "", slug: "", parent_id: "", image: "", description: "", status: true });
const parentId = (row: CatalogOption) => typeof row.parent_id === "object" ? row.parent_id?._id ?? "" : row.parent_id ?? "";
export default function AdminCategories({ request }: { request: AdminRequest }) {
  const {account}=useDemoAuth(),storageKey=`fstyle-category-pending:${account}`;
  const [pending,setPending]=useState<CategoryOperation|null>(null);
  const [rows,setRows]=useState<Category[]>([]),[revision,setRevision]=useState(0),[search,setSearch]=useState(''),[filter,setFilter]=useState(''),[page,setPage]=useState(1);
  const [form,setForm]=useState<ReturnType<typeof blank>|null>(null),[editing,setEditing]=useState<Category|null>(null),[manual,setManual]=useState(false),[issues,setIssues]=useState<Record<string,string>>({});
  const [uploading, setUploading] = useState(false);
  const [impact,setImpact]=useState<Impact|null>(null),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[success,setSuccess]=useState(''),[discard,setDiscard]=useState(false);
  const gate=useRef(false),operation=useRef<{key:string;body:string}|null>(null);
  useEffect(()=>{const timer=setTimeout(()=>{try{const stored=sessionStorage.getItem(storageKey);setPending(stored?JSON.parse(stored):null);}catch{/* Recovery stays available in memory. */}},0);return()=>clearTimeout(timer);},[storageKey]);
  useEffect(()=>{const controller=new AbortController();request<Category[]>('/categories/admin',{signal:controller.signal}).then(data=>{if(!controller.signal.aborted){setRows(data);setLoading(false);}}).catch(cause=>{if(!controller.signal.aborted){setError(cause.message);setLoading(false);}});return()=>controller.abort();},[request,revision]);
  function start(row?:Category){if(pending)return;setEditing(row??null);setForm(row?{name:row.name,slug:row.slug,parent_id:parentId(row),image:row.image??'',description:row.description??'',status:row.status!==false}:blank());setManual(!!row);setIssues({});operation.current=null;}
  function mutate(patch:Partial<ReturnType<typeof blank>>){if(form){setForm({...form,...patch});operation.current=null;}}
  async function uploadImage(file: File) {
    if (gate.current || pending || !form) return;
    setIssues(current => ({ ...current, image: "" }));
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setIssues(current => ({ ...current, image: "Chọn ảnh JPG, PNG hoặc WebP tối đa 5 MB." }));
      return;
    }
    gate.current = true;
    setUploading(true);
    const body = new FormData();
    body.append("image", file);
    try {
      const { url } = await request<{ url: string }>("/admin/uploads", { method: "POST", body, signal: AbortSignal.timeout(20000) });
      mutate({ image: url });
    } catch (cause) {
      setIssues(current => ({ ...current, image: cause instanceof Error ? cause.message : "Không tải được ảnh danh mục." }));
    } finally {
      gate.current = false;
      setUploading(false);
    }
  }
  async function save(event:FormEvent){event.preventDefault();if(!form||gate.current)return;
    const found:Record<string,string>={};if(!form.name.trim())found.name='Nhập tên danh mục.';if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug))found.slug='Dùng chữ thường không dấu, số và gạch nối.';
    setIssues(found);if(Object.keys(found).length)return;
    const body=JSON.stringify({...form,parent_id:form.parent_id||null,expected_version:editing?.__v??0});
    if(!operation.current||operation.current.body!==body)operation.current={key:crypto.randomUUID(),body};
    await commit({...operation.current,path:`/categories${editing?`/${editing._id}`:''}`,method:editing?'PATCH':'POST'});
  }
  async function commit(next:CategoryOperation){
    if(gate.current)return;gate.current=true;setBusy(true);setError('');setPending(next);try{sessionStorage.setItem(storageKey,JSON.stringify(next));}catch{/* Keep request in memory. */}
    try{await request(next.path,{method:next.method,signal:AbortSignal.timeout(20000),headers:{'Idempotency-Key':next.key},body:next.body});setSuccess('Đã lưu danh mục. Liên kết slug cũ được giữ khi đổi tên đường dẫn.');setPending(null);sessionStorage.removeItem(storageKey);setForm(null);setRevision(n=>n+1);window.dispatchEvent(new Event('fstyle-catalog-change'));}
    catch(cause){if(cause instanceof ApiError){setIssues(Object.fromEntries(cause.issues.map(issue=>[issue.path,issue.message])));if(cause.status<500){operation.current=null;setPending(null);sessionStorage.removeItem(storageKey);}}setError(cause instanceof Error?cause.message:'Chưa xác định kết quả. Giữ nguyên nội dung và gửi lại cùng yêu cầu.');}
    finally{gate.current=false;setBusy(false);}
  }
  async function inspect(row:Category){if(gate.current||pending)return;gate.current=true;setBusy(true);setError('');try{setImpact(await request<Impact>(`/categories/${row._id}/impact`));}catch(cause){setError((cause as Error).message);}finally{gate.current=false;setBusy(false);}}
  async function remove(){if(!impact?.can_delete||gate.current)return;gate.current=true;setBusy(true);try{await request(`/categories/${impact.category._id}`,{method:'DELETE'});setSuccess('Đã xóa danh mục rỗng, không xóa sản phẩm.');setImpact(null);setRevision(n=>n+1);window.dispatchEvent(new Event('fstyle-catalog-change'));}catch(cause){setError((cause as Error).message);}finally{gate.current=false;setBusy(false);}}
  const forbidden=editing?categoryDescendants(rows,editing._id):new Set<string>();
  const ordered: {row:Category;depth:number}[]=[],seen=new Set<string>();
  const visit=(row:Category,depth:number)=>{if(seen.has(row._id))return;seen.add(row._id);ordered.push({row,depth});rows.filter(child=>parentId(child)===row._id).sort((a,b)=>a.name.localeCompare(b.name,'vi')).forEach(child=>visit(child,depth+1));};
  rows.filter(row=>!parentId(row)||!rows.some(parent=>parent._id===parentId(row))).forEach(row=>visit(row,0));rows.forEach(row=>visit(row,0));
  const filtered=ordered.filter(({row})=>(!search||`${row.name} ${row.slug}`.toLocaleLowerCase('vi').includes(search.toLocaleLowerCase('vi')))&&(!filter||(filter==='visible'?row.effective_visible:!row.effective_visible)));
  const pages=Math.max(1,Math.ceil(filtered.length/20)),current=Math.min(page,pages);
  return <section className="admin-panel catalog" aria-label="Quản lý danh mục"><div className="catalog-toolbar"><div><h2>Danh mục sản phẩm</h2><p>Quản lý cây phân loại và vị trí xuất hiện trong cửa hàng.</p></div><button className="primary" disabled={busy||!!pending} onClick={()=>start()}>Thêm danh mục</button></div>
    {pending&&<p className="catalog-notice" role="status">Lần lưu chưa được xác nhận. <button disabled={busy} onClick={()=>void commit(pending)}>Gửi lại cùng yêu cầu</button></p>}
    {error&&<p className="catalog-notice" role="alert">{error} <button onClick={()=>setRevision(n=>n+1)}>Tải lại</button></p>}{success&&<p role="status" className="catalog-success">{success}</p>}
    <p>Ẩn danh mục sẽ ẩn cả nhánh khỏi menu và trang danh mục. Trạng thái bán của từng sản phẩm được giữ; muốn dừng bán cần ẩn sản phẩm.</p>
    <div className="catalog-filters"><label>Tìm danh mục<input value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} placeholder="Tên hoặc slug"/></label><label>Hiển thị<select value={filter} onChange={e=>{setFilter(e.target.value);setPage(1);}}><option value="">Tất cả trạng thái</option><option value="visible">Hiển thị trên cửa hàng</option><option value="hidden">Không hiển thị</option></select></label></div>
    <div className="catalog-table-wrap" aria-busy={loading}><table><thead><tr><th>Cây danh mục</th><th>Trực tiếp / cả nhánh</th><th>Hiển thị</th><th>Cập nhật</th><th>Thao tác</th></tr></thead><tbody>{filtered.slice((current-1)*20,current*20).map(({row,depth})=><tr key={row._id}><td><div style={{paddingLeft:Math.min(depth,5)*18}}>{row.image&&<img className="catalog-thumb" src={resolveProductImage(row.image)} alt=""/>}<strong>{depth?'↳ ':''}{row.name}</strong><small>/{row.slug}</small></div></td><td>{row.direct_products} / {row.branch_products}<small>{row.children} danh mục con</small></td><td><span className={`catalog-status ${row.effective_visible?'':'muted'}`}>{row.effective_visible?'Hiển thị':row.status===false?'Đã ẩn':'Ẩn theo danh mục cha'}</span></td><td>{row.updated_at?new Date(row.updated_at).toLocaleDateString('vi-VN'):'—'}</td><td><div className="catalog-actions"><button disabled={busy} onClick={()=>start(row)} aria-label={`Sửa danh mục ${row.name}`}>Sửa / ẩn</button><button className="danger" disabled={busy} onClick={()=>void inspect(row)} aria-label={`Xem ảnh hưởng xóa ${row.name}`}>Xóa...</button></div></td></tr>)}</tbody></table>{!filtered.length&&<p className="catalog-empty">{loading?'Đang tải...':'Không có danh mục phù hợp.'}</p>}</div>
    <div className="catalog-page"><button disabled={current<=1} onClick={()=>setPage(current-1)}>Trang trước</button><span>Trang {current}/{pages} · {filtered.length} danh mục</span><button disabled={current>=pages} onClick={()=>setPage(current+1)}>Trang sau</button></div>
    {form&&<CatalogDialog title={editing?'Sửa danh mục':'Thêm danh mục'} close={()=>{if(!busy&&!pending&&!uploading)setDiscard(true);}}><form onSubmit={save}>
      {pending&&<button type="button" disabled={busy} onClick={()=>void commit(pending)}>Gửi lại cùng yêu cầu</button>}<fieldset disabled={busy||!!pending||uploading} style={{border:0,padding:0,display:'grid',gap:14}}>
      {error&&<p role="alert" className="catalog-error">{error}</p>}<label>Tên danh mục<input aria-label="Tên danh mục" required maxLength={120} value={form.name} aria-invalid={!!issues.name} onChange={e=>mutate({name:e.target.value,...(!manual?{slug:slugify(e.target.value)}:{})})}/>{issues.name&&<span className="catalog-error">{issues.name}</span>}</label>
      <label>Slug<input aria-label="Slug" required maxLength={150} readOnly={editing?.reserved_navigation} value={form.slug} aria-invalid={!!issues.slug} onChange={e=>{setManual(true);mutate({slug:e.target.value});}}/>{issues.slug&&<span className="catalog-error">{issues.slug}</span>}</label>
      {editing&&form.slug!==editing.slug&&<p className="catalog-notice">Đổi slug sẽ chuyển liên kết danh mục cũ sang địa chỉ mới. Đường dẫn sản phẩm theo ID không đổi.</p>}
      <label>Danh mục cha<select aria-label="Danh mục cha" value={form.parent_id} onChange={e=>mutate({parent_id:e.target.value})}><option value="">Danh mục gốc</option>{rows.filter(row=>!forbidden.has(row._id)).map(row=><option key={row._id} value={row._id} disabled={!row.effective_visible&&row._id!==form.parent_id}>{row.name}{!row.effective_visible?' (đã ẩn)':''}</option>)}</select>{issues.parent_id&&<span className="catalog-error">{issues.parent_id}</span>}</label>
      <label>Đường dẫn ảnh đại diện<input value={form.image} aria-invalid={!!issues.image} aria-describedby={issues.image ? "category-image-error" : undefined} onChange={e=>mutate({image:e.target.value})}/></label>
      <label>Tải ảnh đại diện<input type="file" accept="image/jpeg,image/png,image/webp" aria-describedby={issues.image ? "category-image-error" : undefined} onChange={event => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (file) void uploadImage(file);
      }}/></label>
      {uploading && <p role="status">Đang tải ảnh đại diện…</p>}
      {issues.image && <span id="category-image-error" role="alert" className="catalog-error">{issues.image}</span>}
      {form.image&&<img src={resolveProductImage(form.image)} width="80" height="80" alt="Xem trước ảnh danh mục"/>}
      <label>Mô tả<textarea maxLength={2000} value={form.description} onChange={e=>mutate({description:e.target.value})}/></label><label>Trạng thái<select aria-label="Trạng thái" value={String(form.status)} onChange={e=>mutate({status:e.target.value==='true'})}><option value="true">Hiển thị</option><option value="false">Ẩn danh mục</option></select></label>
      {editing&&form.status!==editing.status&&<p className="catalog-notice">Thay đổi áp dụng lên điều hướng của cả nhánh. Sản phẩm vẫn giữ trạng thái bán riêng.</p>}
      <div className="catalog-actions"><button type="button" onClick={()=>setDiscard(true)}>Hủy</button><button className="primary">{busy?'Đang lưu...':'Lưu danh mục'}</button></div>
    </fieldset></form></CatalogDialog>}
    {discard&&<CatalogDialog title="Bỏ thay đổi danh mục?" close={()=>setDiscard(false)}><p>Dữ liệu chưa lưu trong biểu mẫu sẽ bị bỏ.</p><div className="catalog-actions"><button onClick={()=>setDiscard(false)}>Tiếp tục sửa</button><button onClick={()=>{setDiscard(false);setForm(null);}}>Bỏ thay đổi</button></div></CatalogDialog>}
    {impact&&<CatalogDialog title={`Kiểm tra xóa ${impact.category.name}`} close={()=>{if(!busy)setImpact(null);}}><p>{impact.policy}</p><p>{impact.direct_products+impact.legacy_products} sản phẩm · {impact.children} danh mục con · {impact.size_rules} quy tắc size.</p>{impact.reasons.map(reason=><p key={reason} className="catalog-error">{reason}</p>)}<p>{impact.can_delete?'Chỉ xóa danh mục rỗng này. Không xóa sản phẩm hoặc lịch sử đơn.':'Chưa thể xóa. Có thể ẩn danh mục, chuyển từng sản phẩm qua workspace hoặc chuyển danh mục con sang cha khác rồi kiểm tra lại.'}</p>{error&&<p role="alert" className="catalog-error">{error}</p>}<div className="catalog-actions"><button disabled={busy} onClick={()=>{start({...impact.category,reserved_navigation:impact.reserved_navigation});setImpact(null);}}>Sửa / ẩn thay thế</button><button className="danger" disabled={busy||!impact.can_delete} onClick={()=>void remove()}>Xác nhận xóa danh mục rỗng</button></div></CatalogDialog>}
  </section>;
}
