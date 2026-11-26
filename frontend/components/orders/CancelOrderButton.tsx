"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { cancelBackendOrder } from "@/lib/order-api";

export default function CancelOrderButton({ orderId, token, onCancelled }: {
  orderId: string;
  token: string;
  onCancelled: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !reason.trim()) return;
    setBusy(true);
    setError("");
    try {
      await cancelBackendOrder(orderId, token, reason.trim());
      dialog.current?.close();
      onCancelled();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể hủy đơn hàng.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="pill-button small-pill"
        style={{ color: "#b42318", borderColor: "#fecaca" }}
        onClick={() => { setReason(""); setError(""); dialog.current?.showModal(); }}
      >
        Hủy đơn hàng
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        onCancel={(event) => { if (busy) event.preventDefault(); }}
        className="panel"
        style={{ margin: "auto", width: "min(440px, calc(100% - 32px))", padding: 24 }}
      >
        <h2 id={titleId}>Hủy đơn #{orderId.slice(-8).toUpperCase()}</h2>
        <form onSubmit={submit} style={{ display: "grid", gap: 16, marginTop: 16 }}>
          <label style={{ display: "grid", gap: 8 }}>
            Lý do hủy đơn
            <textarea
              className="form-field"
              required
              maxLength={500}
              rows={4}
              disabled={busy}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          {error && <p role="alert" style={{ color: "#b42318" }}>{error}</p>}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "flex-end" }}>
            <button type="button" className="pill-button small-pill" disabled={busy} onClick={() => dialog.current?.close()}>
              Giữ đơn hàng
            </button>
            <button type="submit" className="pill-button dark small-pill" disabled={busy || !reason.trim()}>
              {busy ? "Đang hủy..." : "Xác nhận hủy"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
