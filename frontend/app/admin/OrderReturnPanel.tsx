"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { AdminRequest } from "./ProductVariantsManager";
import type { FullAdminOrder } from "./OrderInvoiceModal";
import { orderStatusText } from "@/lib/order-api";
import AdminFeedback from "./AdminFeedback";

export const deliveryReasons: Record<string, string> = { refused: "Khách từ chối nhận", unreachable: "Không liên hệ được", wrong_address: "Sai địa chỉ", carrier_damage: "Hàng hỏng khi vận chuyển", other: "Lý do khác" };
type Line = { order_detail_id: string; restock_quantity: number; damaged_quantity: number; missing_quantity: number };
type Receipt = { note: string; evidence_urls: string[]; received_at: string; claim_status: "none" | "pending" | "resolved"; claim_note?: string; lines: (Line & { sku: string })[] };
type Operation = { order: FullAdminOrder; receipt: Receipt | null; history: { _id: string; status: FullAdminOrder["order_status"]; note: string; created_at: string; changed_by?: { name: string } }[] };
export default function OrderReturnPanel({ order, request, isAdmin, onChanged }: { order: FullAdminOrder; request: AdminRequest; isAdmin: boolean; onChanged: () => void }) {
  const [data, setData] = useState<Operation>();
  const [lines, setLines] = useState<Line[]>(() => order.items.map((item) => ({ order_detail_id: item._id ?? "", restock_quantity: 0, damaged_quantity: 0, missing_quantity: 0 })));
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");
  const [historyError, setHistoryError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const path = "/admin/orders/" + order._id;
  useEffect(() => {
    const controller = new AbortController();
    request<Operation>(path + "/operations", { signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return;
        setData(result);
        setHistoryError("");
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setHistoryError(cause instanceof Error ? cause.message : "Không tải được lịch sử xử lý.");
      });
    return () => controller.abort();
  }, [path, request, revision, order.order_status]);
  async function submit(e: FormEvent<HTMLFormElement>, suffix: string, method: string) {
    e.preventDefault();
    if (saving.current) return;
    const fields = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
    const payload: Record<string, unknown> = Object.fromEntries(fields.entries());
    if (suffix === "return-receipt") {
      const incomplete = order.items.find((item, index) => {
        const line = lines[index];
        return !line || line.restock_quantity + line.damaged_quantity + line.missing_quantity !== item.quantity;
      });
      if (incomplete) {
        setError(`Tổng số nguyên vẹn, hỏng và thiếu của ${incomplete.sku} phải bằng ${incomplete.quantity}.`);
        setNotice("");
        return;
      }
      payload.lines = lines;
      payload.evidence_urls = String(payload.evidence ?? "").split(/\s+/).filter(Boolean);
    }
    if (suffix === "refund") { payload.amount = order.final_amount; payload.confirmed = fields.get("confirmed") === "on"; }
    saving.current = true;
    setBusy(true); setError(""); setNotice("");
    try {
      await request(path + "/" + suffix, { method, body: JSON.stringify(payload) });
      setNotice(suffix === "refund" ? "Đã ghi nhận chứng từ hoàn tiền. Hệ thống không thực hiện chuyển tiền." : "Đã ghi nhận bước xử lý và lưu lịch sử.");
      setRevision((v) => v + 1); onChanged();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể xử lý đơn."); }
    finally { saving.current = false; setBusy(false); }
  }
  const current = data?.order ?? order;
  const status = current.order_status;
  return <section className="admin-order-operations"><h3>Vận chuyển và đối soát</h3>
    {error && <AdminFeedback kind="error" message={error} />}{notice && <AdminFeedback kind="success" message={notice} />}
    {(status === "shipping" || status === "delivery_failed") && <form className="admin-form" onSubmit={(e) => void submit(e, "delivery", "PATCH")}>
      {status === "shipping" && <label>Lý do giao thất bại<select name="reason">{Object.entries(deliveryReasons).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>}
      <label className="wide">Biên bản / nội dung liên hệ khách<textarea name="note" required maxLength={1000} placeholder="Ghi nhận thời điểm giao, phản hồi của khách và phương án đã thống nhất."/></label>
      <div className="admin-actions wide">{status === "shipping" ? <button name="action" value="fail" className="admin-button" disabled={busy}>Ghi nhận giao thất bại</button> : <><button name="action" value="retry" disabled={busy}>Đã liên hệ · Giao lại</button><button name="action" value="return" className="admin-button" disabled={busy}>Yêu cầu hoàn về shop</button></>}</div>
    </form>}
    {status === "returning" && <form onSubmit={(e) => void submit(e, "return-receipt", "POST")}><h4>Biên bản nhận và kiểm hàng hoàn</h4><p>Tổng nguyên vẹn + hỏng + thiếu phải bằng số lượng đã gửi ở từng dòng. Chỉ hàng nguyên vẹn mới trở lại tồn bán được.</p><button type="button" disabled={busy} onClick={() => setLines(order.items.map((item) => ({ order_detail_id: item._id ?? "", restock_quantity: item.quantity, damaged_quantity: 0, missing_quantity: 0 })))}>Đã kiểm · Toàn bộ nguyên vẹn</button>
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Sản phẩm / SKU</th><th>Đã gửi</th><th>Nguyên vẹn</th><th>Hỏng · cách ly</th><th>Thiếu</th></tr></thead><tbody>{order.items.map((item, i) => <tr key={item._id ?? i}><td>{item.product_name}<br/>{item.sku} · {item.color}/{item.size}</td><td>{item.quantity}</td>{(["restock_quantity", "damaged_quantity", "missing_quantity"] as const).map((key) => <td key={key}><input aria-label={item.sku + " " + ({ restock_quantity: "nguyên vẹn", damaged_quantity: "hỏng", missing_quantity: "thiếu" })[key]} type="number" min={0} max={item.quantity} step={1} required value={lines[i]?.[key] ?? 0} onChange={(e) => { const value = Number(e.target.value); setLines((rows) => rows.map((row, index) => index === i ? { ...row, [key]: value } : row)); }}/></td>)}</tr>)}</tbody></table></div>
      <label className="admin-stack">Kết quả kiểm hàng / tình trạng bao bì<textarea name="note" required maxLength={2000}/></label><label className="admin-stack">Link ảnh, video hoặc biên bản (mỗi link cách nhau bằng khoảng trắng)<textarea name="evidence" placeholder="https://..."/></label><p className="admin-muted">Hàng hỏng/thiếu cần lưu bằng chứng và đối soát với bên vận chuyển. Không tự kết luận lỗi hoặc trừ tiền của khách.</p><button className="admin-button" disabled={busy}>Xác nhận đã nhận và kiểm hàng</button>
    </form>}
    {data?.receipt && <article className="admin-history-card"><h4>Biên bản hàng hoàn · {new Date(data.receipt.received_at).toLocaleString("vi-VN")}</h4><p>{data.receipt.note}</p><ul>{data.receipt.lines.map((line) => <li key={line.order_detail_id}>{line.sku}: nhập bán {line.restock_quantity}, cách ly {line.damaged_quantity}, thiếu {line.missing_quantity}</li>)}</ul>{data.receipt.evidence_urls.map((url) => <a key={url} href={url} target="_blank" rel="noreferrer">Xem bằng chứng </a>)}{data.receipt.claim_status === "pending" ? <form onSubmit={(e) => void submit(e, "return-claim", "PATCH")}><h4>Tổn thất đang chờ đối soát</h4><label className="admin-stack">Kết quả làm việc với khách / đơn vị vận chuyển<textarea name="note" required maxLength={2000}/></label><button disabled={busy}>Lưu kết quả giải quyết tổn thất</button></form> : data.receipt.claim_status === "resolved" && <p>Đã đối soát: {data.receipt.claim_note}</p>}</article>}
    {(status === "cancelled" || status === "returned") && current.payment_status === "success" && (isAdmin ? <form className="admin-history-card" onSubmit={(e) => void submit(e, "refund", "POST")}><h4>Ghi nhận hoàn tiền đã thực hiện</h4><p>Khách đã thanh toán {new Intl.NumberFormat("vi-VN").format(current.final_amount)} ₫. Shop cần hoàn tiền qua ngân hàng/cổng thanh toán trước, rồi ghi chứng từ tại đây.</p><label className="admin-stack">Mã giao dịch hoàn tiền<input name="reference" required maxLength={200}/></label><label className="admin-stack">Ghi chú đối soát<textarea name="note" required maxLength={1000}/></label><label><input name="confirmed" type="checkbox" required/> Tôi đã hoàn đủ số tiền đơn đã thu và có chứng từ xác nhận.</label><button className="admin-button" disabled={busy}>Ghi nhận đã hoàn tiền</button></form> : <p className="admin-alert">Đơn đã thu tiền, cần quản trị viên hoàn tiền và ghi nhận chứng từ.</p>)}
    {current.refund && <p className="admin-success">Đã ghi nhận hoàn {current.refund.amount.toLocaleString("vi-VN")} ₫ · Mã {current.refund.reference}</p>}
    <h4>Lịch sử từng bước</h4>
    {historyError && <AdminFeedback kind="error" message={historyError} onRetry={() => {
      setHistoryError("");
      setRevision((value) => value + 1);
    }} />}
    {!data && !historyError && <AdminFeedback kind="loading" message="Đang tải lịch sử…" />}
    {data && data.history.length === 0 && !historyError && <AdminFeedback kind="empty" message="Chưa ghi nhận lịch sử xử lý." />}
    {data && data.history.length > 0 && (
      <ol className="admin-order-history">
        {data.history.map((event) => (
          <li key={event._id}>
            <strong>{orderStatusText[event.status]}</strong> · {new Date(event.created_at).toLocaleString("vi-VN")} · {event.changed_by?.name ?? "Hệ thống"}
            <p>{event.note}</p>
          </li>
        ))}
      </ol>
    )}
  </section>;
}
