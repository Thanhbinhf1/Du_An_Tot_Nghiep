"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { cancelBackendOrder } from "@/lib/order-api";

const QUICK_REASONS = [
  "Muốn thay đổi địa chỉ / số điện thoại nhận hàng",
  "Muốn thay đổi kích cỡ hoặc màu sắc sản phẩm",
  "Muốn áp dụng hoặc đổi mã giảm giá",
  "Tìm thấy sản phẩm khác phù hợp hơn",
  "Đổi ý, không muốn mua nữa",
];

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

  function openModal() {
    setReason("");
    setError("");
    dialog.current?.showModal();
  }

  function closeModal() {
    if (!busy) dialog.current?.close();
  }

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
        className="pill-button small-pill cancel-order-trigger"
        onClick={openModal}
      >
        Hủy đơn hàng
      </button>

      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        className="cancel-order-dialog"
        onCancel={(event) => { if (busy) event.preventDefault(); }}
        onClick={(event) => { if (event.target === event.currentTarget) closeModal(); }}
      >
        <div className="cancel-order-sheet">
          <header className="cancel-order-header">
            <div>
              <h2 id={titleId}>Hủy đơn #{orderId.slice(-8).toUpperCase()}</h2>
              <p>Vui lòng chọn hoặc nhập lý do để cửa hàng hỗ trợ tốt hơn.</p>
            </div>
            <button
              type="button"
              className="cancel-order-close"
              aria-label="Đóng hộp thoại hủy đơn"
              disabled={busy}
              onClick={closeModal}
            >
              ×
            </button>
          </header>

          <form onSubmit={submit} className="cancel-order-form">
            <div className="cancel-reason-chips" role="group" aria-label="Lý do hủy đơn nhanh">
              {QUICK_REASONS.map((preset) => {
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
              <span>Lý do hủy đơn</span>
              <textarea
                required
                maxLength={500}
                rows={3}
                disabled={busy}
                value={reason}
                placeholder="Nhập chi tiết lý do hủy đơn hàng..."
                onChange={(event) => setReason(event.target.value)}
              />
              <small>{reason.length}/500 ký tự</small>
            </label>

            <p className="cancel-order-warning">
              Lưu ý: Đơn hàng sau khi hủy sẽ không thể khôi phục và số lượng sản phẩm sẽ được hoàn về kho.
            </p>

            {error && <p className="cancel-order-error" role="alert">{error}</p>}

            <footer className="cancel-order-actions">
              <button
                type="button"
                className="pill-button cancel-keep-btn"
                disabled={busy}
                onClick={closeModal}
              >
                Giữ lại đơn hàng
              </button>
              <button
                type="submit"
                className="pill-button cancel-confirm-btn"
                disabled={busy || !reason.trim()}
              >
                {busy ? "Đang hủy đơn..." : "Xác nhận hủy"}
              </button>
            </footer>
          </form>
        </div>
      </dialog>
    </>
  );
}
