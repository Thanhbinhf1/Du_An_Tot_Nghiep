import { useEffect, useState } from "react";
import type { AdminRequest } from "./ProductVariantsManager";
import AdminIcon from "./AdminIcon";

type Ticket = { _id: string; name: string; email: string; topic: string; message: string; status: "new" | "resolved"; created_at: string; handled_by?: { name: string } | null; handled_at?: string };
const topics = { "don-hang": "Đơn hàng", "san-pham": "Sản phẩm", "doi-tra": "Đổi trả", "tai-khoan": "Tài khoản", khac: "Khác" } as const;
type Topic = keyof typeof topics;

export default function AdminContacts({ request, fixedTopic }: { request: AdminRequest; fixedTopic?: Topic }) {
  const [tickets, setTickets] = useState<Ticket[]>();
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [status, setStatus] = useState("new");
  const [topic, setTopic] = useState<Topic | "all">(fixedTopic ?? "all");
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({ page: String(page), status, topic });
    request<{ requests: Ticket[]; totalPages: number; total: number }>(`/admin/contacts?${query}`, { signal: controller.signal })
      .then((data) => { if (!controller.signal.aborted) { setTotal(data.total); setTotalPages(data.totalPages); if (page > Math.max(1, data.totalPages)) setPage(Math.max(1, data.totalPages)); else setTickets(data.requests); } })
      .catch((cause) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Không thể tải liên hệ."); });
    return () => controller.abort();
  }, [page, request, revision, status, topic]);

  async function update(ticket: Ticket) {
    setBusy(ticket._id);
    setError("");
    try {
      await request<Ticket>(`/admin/contacts/${ticket._id}`, {
        method: "PATCH", body: JSON.stringify({ status: ticket.status === "new" ? "resolved" : "new", expected_status: ticket.status }),
      });
      setTickets(undefined);
      setRevision(value => value + 1);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể cập nhật liên hệ."); }
    finally { setBusy(""); }
  }

  function changePage(next: number) {
    setTickets(undefined);
    setError("");
    setPage(next);
  }

  return (
    <section className="admin-panel">
      <div className="admin-toolbar">
        <p className="admin-muted">{fixedTopic ? "Tin nhắn đổi size, đổi màu và trả hàng khách gửi qua biểu mẫu liên hệ." : "Tiếp nhận yêu cầu và theo dõi kết quả hỗ trợ khách hàng."}</p>
        <button type="button" className="admin-icon-button" disabled={Boolean(busy)} aria-label="Tải lại liên hệ" title="Tải lại liên hệ" onClick={() => {
          setError("");
          setTickets(undefined);
          setRevision((value) => value + 1);
        }}><AdminIcon name="refresh" /></button>
      </div>
      <div className="admin-filter-bar"><label>Trạng thái liên hệ <select className="admin-select" value={status} disabled={Boolean(busy)} onChange={e => { changePage(1); setStatus(e.target.value); }}>
        <option value="new">Chưa xử lý</option><option value="resolved">Đã xử lý</option><option value="all">Tất cả</option>
      </select></label>
      {!fixedTopic && <label>Chủ đề<select className="admin-select" value={topic} disabled={Boolean(busy)} onChange={(event) => { changePage(1); setTopic(event.target.value as Topic | "all"); }}>
        <option value="all">Tất cả chủ đề</option>{Object.entries(topics).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
      </select></label>}
      </div>
      {tickets && <p className="admin-muted">{total} yêu cầu{status === "new" ? " · Ưu tiên yêu cầu cũ nhất" : ""}</p>}
      {error && <p className="admin-alert" role="alert">{error}</p>}
      {!tickets && !error && <p role="status">Đang tải liên hệ...</p>}
      {tickets?.length === 0 && <p>Chưa có yêu cầu liên hệ.</p>}
      {tickets?.map((ticket) => (
        <article className="admin-history-card" key={ticket._id}>
          <div className="admin-card-title"><h3>{topics[ticket.topic as Topic] ?? ticket.topic} · {ticket.name}</h3>
            <span className={"admin-data-pill tone-" + (ticket.status === "new" ? "amber" : "green")}>{ticket.status === "new" ? "Chưa xử lý" : "Đã xử lý"}</span>
          </div>
          <p><a href={`mailto:${encodeURIComponent(ticket.email)}`}>{ticket.email}</a> · {new Date(ticket.created_at).toLocaleString("vi-VN")}</p>
          <p className="small">Mã liên hệ {ticket._id}</p>
          <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{ticket.message}</p>
          {ticket.handled_at && <p className="admin-muted">Cập nhật bởi {ticket.handled_by?.name ?? "nhân viên"} · {new Date(ticket.handled_at).toLocaleString("vi-VN")}</p>}
          <button type="button" className="admin-button" disabled={Boolean(busy)} onClick={() => void update(ticket)}>
            {ticket.status === "new" ? "Đánh dấu đã xử lý" : "Mở lại"}
          </button>
        </article>
      ))}
      <div className="admin-actions">
        <button type="button" disabled={Boolean(busy) || page === 1} onClick={() => changePage(page - 1)}>Trang trước</button>
        <span>Trang {page}</span>
        <button type="button" disabled={Boolean(busy) || page >= totalPages} onClick={() => changePage(page + 1)}>Trang sau</button>
      </div>
    </section>
  );
}
