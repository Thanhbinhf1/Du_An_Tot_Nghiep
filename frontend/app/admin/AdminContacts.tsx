import { useEffect, useState } from "react";
import type { AdminRequest } from "./ProductVariantsManager";

type Ticket = { _id: string; name: string; email: string; topic: string; message: string; status: "new" | "resolved"; created_at: string };
const topics: Record<string, string> = { "don-hang": "Đơn hàng", "san-pham": "Sản phẩm", "doi-tra": "Đổi trả", khac: "Khác" };

export default function AdminContacts({ request }: { request: AdminRequest }) {
  const [tickets, setTickets] = useState<Ticket[]>();
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    request<{ requests: Ticket[]; totalPages: number }>(`/admin/contacts?page=${page}`, { signal: controller.signal })
      .then((data) => { if (!controller.signal.aborted) { setTickets(data.requests); setTotalPages(data.totalPages); } })
      .catch((cause) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Không thể tải liên hệ."); });
    return () => controller.abort();
  }, [page, request, revision]);

  async function update(ticket: Ticket) {
    setBusy(ticket._id);
    setError("");
    try {
      const updated = await request<Ticket>(`/admin/contacts/${ticket._id}`, {
        method: "PATCH", body: JSON.stringify({ status: ticket.status === "new" ? "resolved" : "new" }),
      });
      setTickets((current) => current?.map((item) => item._id === updated._id ? updated : item));
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
      <h2>Yêu cầu liên hệ</h2>
      <button type="button" className="admin-button" disabled={Boolean(busy)} onClick={() => {
        setError("");
        setTickets(undefined);
        setRevision((value) => value + 1);
      }}>Tải lại liên hệ</button>
      {error && <p className="admin-alert" role="alert">{error}</p>}
      {!tickets && !error && <p role="status">Đang tải liên hệ...</p>}
      {tickets?.length === 0 && <p>Chưa có yêu cầu liên hệ.</p>}
      {tickets?.map((ticket) => (
        <article className="admin-panel" key={ticket._id}>
          <h3>{topics[ticket.topic] ?? ticket.topic} · {ticket.name}</h3>
          <p><a href={`mailto:${encodeURIComponent(ticket.email)}`}>{ticket.email}</a> · {new Date(ticket.created_at).toLocaleString("vi-VN")}</p>
          <p className="small">Mã liên hệ {ticket._id}</p>
          <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{ticket.message}</p>
          <p>{ticket.status === "new" ? "Chưa xử lý" : "Đã xử lý"}</p>
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
