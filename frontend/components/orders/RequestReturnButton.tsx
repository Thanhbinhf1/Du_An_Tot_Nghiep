"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { API_BASE_URL, authenticatedHeaders, readApiResponse, resolveProductImage } from "@/lib/api";

const RETURN_TYPES = [
  { id: "exchange", label: "Đổi kích cỡ / màu sắc" },
  { id: "refund", label: "Trả hàng & hoàn tiền" },
] as const;

const QUICK_RETURN_REASONS = [
  "Không vừa kích cỡ, muốn đổi size khác",
  "Muốn đổi sang màu sắc khác",
  "Sản phẩm bị lỗi kỹ thuật / đường may",
  "Giao nhầm mẫu, nhầm size hoặc nhầm màu",
  "Sản phẩm chưa đúng như kỳ vọng",
];

export default function RequestReturnButton({
  orderId,
  receiverName,
  userEmail,
  token,
  onSubmitted,
}: {
  orderId: string;
  receiverName: string;
  userEmail?: string;
  token: string;
  onSubmitted?: (ticketId: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const [returnType, setReturnType] = useState<string>(RETURN_TYPES[0].label);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [contactEmail, setContactEmail] = useState(userEmail && userEmail.includes("@") ? userEmail : "");
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ticketId, setTicketId] = useState("");

  function openModal() {
    setError("");
    setTicketId("");
    dialog.current?.showModal();
  }

  function closeModal() {
    if (!busy && !uploading) dialog.current?.close();
  }

  async function handleUploadPhotos(files: FileList | null) {
    if (!files || !files.length || !token) return;
    const remaining = 3 - photos.length;
    if (remaining <= 0) {
      setError("Tối đa đính kèm 3 ảnh minh chứng.");
      return;
    }
    setUploading(true);
    setError("");
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files).slice(0, remaining)) {
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
          throw new Error("Chỉ chấp nhận ảnh JPG, PNG hoặc WebP.");
        }
        if (file.size > 5 * 1024 * 1024) {
          throw new Error("Mỗi ảnh tối đa 5 MB.");
        }
        const formData = new FormData();
        formData.append("image", file);
        const res = await fetch(`${API_BASE_URL}/reviews/upload-image`, {
          method: "POST",
          headers: authenticatedHeaders(token),
          body: formData,
        });
        const data = await readApiResponse<{ url: string }>(res);
        if (data?.url) uploaded.push(data.url);
      }
      if (uploaded.length) setPhotos((prev) => [...prev, ...uploaded].slice(0, 3));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể tải ảnh lên.");
    } finally {
      setUploading(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || uploading || !reason.trim() || !contactEmail.trim()) return;
    setBusy(true);
    setError("");
    try {
      const code = `#${orderId.slice(-8).toUpperCase()}`;
      const messageLines = [
        `Mã đơn hàng: ${code} (${orderId})`,
        `Hình thức: ${returnType}`,
        `Lý do chính: ${reason.trim()}`,
        details.trim() ? `Chi tiết bổ sung: ${details.trim()}` : "",
        photos.length ? `Ảnh đính kèm: ${photos.join(", ")}` : "",
      ].filter(Boolean);

      const response = await fetch(`${API_BASE_URL}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: receiverName || "Khách hàng",
          email: contactEmail.trim(),
          topic: "doi-tra",
          message: messageLines.join("\n"),
        }),
      });
      const ticket = await readApiResponse<{ id: string }>(response);
      setTicketId(ticket.id);
      onSubmitted?.(ticket.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể gửi yêu cầu đổi trả.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="pill-button small-pill"
        onClick={openModal}
      >
        Yêu cầu đổi / trả hàng
      </button>

      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        className="cancel-order-dialog"
        onCancel={(event) => { if (busy || uploading) event.preventDefault(); }}
        onClick={(event) => { if (event.target === event.currentTarget) closeModal(); }}
      >
        <div className="cancel-order-sheet">
          <header className="cancel-order-header">
            <div>
              <h2 id={titleId}>Đổi / trả đơn #{orderId.slice(-8).toUpperCase()}</h2>
              <p>Hỗ trợ đổi size, đổi màu hoặc trả hàng hoàn tiền trong 30 ngày.</p>
            </div>
            <button
              type="button"
              className="cancel-order-close"
              aria-label="Đóng hộp thoại đổi trả"
              disabled={busy || uploading}
              onClick={closeModal}
            >
              ×
            </button>
          </header>

          {ticketId ? (
            <div className="cancel-order-form">
              <div className="product-added-message" role="status" style={{ margin: 0 }}>
                <strong>Đã gửi yêu cầu đổi / trả hàng thành công!</strong>
                <p style={{ margin: "6px 0 0" }}>
                  Mã hồ sơ hỗ trợ của bạn là <strong>{ticketId}</strong>. Cửa hàng sẽ liên hệ qua email <strong>{contactEmail}</strong> trong vòng 24 giờ làm việc để hướng dẫn bước tiếp theo.
                </p>
              </div>
              <footer className="cancel-order-actions" style={{ gridTemplateColumns: "1fr" }}>
                <button type="button" className="pill-button dark" onClick={closeModal}>
                  Đóng
                </button>
              </footer>
            </div>
          ) : (
            <form onSubmit={submit} className="cancel-order-form">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }} role="group" aria-label="Hình thức đổi trả">
                {RETURN_TYPES.map((item) => {
                  const active = returnType === item.label;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      disabled={busy}
                      className={`cancel-reason-chip${active ? " active" : ""}`}
                      aria-pressed={active}
                      onClick={() => setReturnType(item.label)}
                    >
                      <span className="cancel-reason-dot" aria-hidden="true" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="cancel-reason-chips" role="group" aria-label="Lý do đổi trả">
                {QUICK_RETURN_REASONS.map((preset) => {
                  const selected = reason === preset;
                  return (
                    <button
                      key={preset}
                      type="button"
                      disabled={busy}
                      className={`cancel-reason-chip${selected ? " active" : ""}`}
                      aria-pressed={selected}
                      onClick={() => setReason(preset)}
                    >
                      <span className="cancel-reason-dot" aria-hidden="true" />
                      <span>{preset}</span>
                    </button>
                  );
                })}
              </div>

              <label className="cancel-reason-field">
                <span>Email nhận phản hồi *</span>
                <input
                  type="email"
                  required
                  maxLength={254}
                  disabled={busy}
                  value={contactEmail}
                  placeholder="email@example.com"
                  onChange={(e) => setContactEmail(e.target.value)}
                  style={{ width: "100%", minHeight: "40px", padding: "8px 12px", border: "1px solid #d4d4d4", borderRadius: "6px" }}
                />
              </label>

              <label className="cancel-reason-field">
                <span>Chi tiết yêu cầu (size/màu muốn đổi, mô tả lỗi...)</span>
                <textarea
                  rows={3}
                  maxLength={1000}
                  disabled={busy}
                  value={details}
                  placeholder="VD: Muốn đổi từ size M sang size L, màu Đen..."
                  onChange={(e) => setDetails(e.target.value)}
                />
              </label>

              <div className="cancel-reason-field">
                <span>Ảnh sản phẩm thực tế (tùy chọn, tối đa 3 ảnh)</span>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  hidden
                  onChange={(e) => {
                    void handleUploadPhotos(e.target.files);
                    e.target.value = "";
                  }}
                />
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="pill-button small-pill"
                    disabled={busy || uploading || photos.length >= 3}
                    onClick={() => fileRef.current?.click()}
                  >
                    {uploading ? "Đang tải ảnh..." : "📷 Tải ảnh sản phẩm"}
                  </button>
                  {photos.map((url, idx) => (
                    <div key={`${url}-${idx}`} style={{ position: "relative", width: 48, height: 48, border: "1px solid #ddd", borderRadius: 4, overflow: "hidden" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={resolveProductImage(url)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      <button
                        type="button"
                        aria-label="Xóa ảnh"
                        onClick={() => setPhotos((prev) => prev.filter((_, i) => i !== idx))}
                        style={{ position: "absolute", top: 0, right: 0, width: 18, height: 18, border: 0, background: "#111", color: "#fff", fontSize: 11, lineHeight: 1 }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {error && <p className="cancel-order-error" role="alert">{error}</p>}

              <footer className="cancel-order-actions">
                <button type="button" className="pill-button" disabled={busy || uploading} onClick={closeModal}>
                  Đóng
                </button>
                <button type="submit" className="pill-button dark" disabled={busy || uploading || !reason.trim() || !contactEmail.trim()}>
                  {busy ? "Đang gửi..." : "Gửi yêu cầu đổi / trả"}
                </button>
              </footer>
            </form>
          )}
        </div>
      </dialog>
    </>
  );
}

