"use client";
import { useEffect, useState, type FormEvent } from "react";
import type { AdminRequest } from "./ProductVariantsManager";
type Data = { defaults: string[]; custom: { _id: string; word: string; is_active: boolean }[] };
export default function BlockedWordsManager({ request, isAdmin }: { request: AdminRequest; isAdmin: boolean }) {
  const [data, setData] = useState<Data>();
  const [revision, setRevision] = useState(0);
  const [word, setWord] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    request<Data>("/admin/blocked-words", { signal: controller.signal }).then((value) => { if (!controller.signal.aborted) setData(value); })
      .catch((cause) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Không tải được từ cấm."); });
    return () => controller.abort();
  }, [request, revision]);
  async function mutate(path: string, body: object, method: string) {
    setBusy(true); setError("");
    try { await request(path, { method, body: JSON.stringify(body) }); setWord(""); setRevision((v) => v + 1); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể lưu từ cấm."); }
    finally { setBusy(false); }
  }
  return <section className="admin-panel"><h2>Tự động che từ cấm</h2><p className="admin-muted">Che từ/cụm từ bằng dấu *, giữ nguyên số sao và phần nhận xét còn lại. Áp dụng ngay cả đánh giá đã có. Không thêm các từ chỉ thể hiện góp ý như “xấu”, “chậm”, “không thích”.</p>
    {error && <p className="admin-alert" role="alert">{error}</p>}
    {!data ? <p>Đang tải…</p> : <><p>Từ mặc định: {data.defaults.join(", ")}</p><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Từ/cụm từ bổ sung</th><th>Trạng thái</th>{isAdmin && <th>Thao tác</th>}</tr></thead><tbody>{data.custom.map((item) => <tr key={item._id}><td>{item.word}</td><td>{item.is_active ? "Đang che" : "Đã tắt"}</td>{isAdmin && <td><button disabled={busy} onClick={() => void mutate(`/admin/blocked-words/${item._id}`, { is_active: !item.is_active }, "PATCH")}>{item.is_active ? "Tắt quy tắc" : "Bật quy tắc"}</button></td>}</tr>)}</tbody></table></div></>}
    {isAdmin && <form className="admin-form" onSubmit={(e: FormEvent) => { e.preventDefault(); void mutate("/admin/blocked-words", { word }, "POST"); }}><label>Từ/cụm từ cần che<input required maxLength={60} value={word} onChange={(e) => setWord(e.target.value)} /></label><div className="admin-actions"><button className="admin-button" disabled={busy}>Thêm quy tắc che</button></div></form>}
  </section>;
}
