"use client";

import { useId, useRef, useState } from "react";
import Link from "next/link";
import { ApiError, resolveProductImage } from "@/lib/api";
import { addCartItem, getProductVariants, notifyCartChanged } from "@/lib/cart-api";
import { formatVnd } from "@/data/products";
import { orderStatusText, paymentMethodText, paymentStatusText } from "@/lib/order-api";
import type { Choice, OrderCard, OutfitCard, ProductCard } from "./chat-api";

export function ChatProduct({ item, token, onNavigate, onSelect }: {
  item: ProductCard; token: string; onNavigate: () => void; onSelect?: (choice: Choice) => void;
}) {
  const selectId = useId();
  const [choices, setChoices] = useState(item.variants);
  const [choiceId, setChoiceId] = useState(item.variants.length === 1 ? item.variants[0].id : "");
  const [quantityText, setQuantityText] = useState(item.purchase ? String(item.purchase.quantity ?? "") : "1");
  const quantity = /^\d{1,5}$/.test(quantityText) ? Number(quantityText) : 0;
  const selected = choices.find((choice) => choice.id === choiceId);
  const displayed = selected ?? choices[0];
  const [pending, setPending] = useState(false);
  const [attempts, setAttempts] = useState<Record<string, "added" | "verify">>({});
  const [feedback, setFeedback] = useState("");
  const writing = useRef(false);
  const canAdd = choices.some((choice) => choice.available);
  const attempt = selected && attempts[selected.id];
  const validQuantity = quantity > 0 && (selected?.stock === undefined || quantity <= selected.stock);

  async function add() {
    if (!token || !selected?.available || !validQuantity || writing.current || attempt) return;
    writing.current = true;
    setPending(true);
    setFeedback("");
    try {
      await addCartItem(selected.id, quantity, token, undefined, AbortSignal.timeout(15_000),
        { unitPrice: selected.price, stock: selected.stock });
      setAttempts((previous) => ({ ...previous, [selected.id]: "added" }));
      setFeedback(`Đã thêm ${quantity} sản phẩm vào giỏ.`);
    } catch (error) {
      if (error instanceof ApiError && error.status < 500) {
        notifyCartChanged();
        setFeedback(error.message);
        if ([400, 404, 409].includes(error.status)) {
          try {
            const live = await getProductVariants(item.id, AbortSignal.timeout(5000));
            const refreshed = choices.map((choice) => {
              const row = live.find((variant) => variant._id === choice.id && variant.status);
              return row ? { id: row._id, size: row.size, color: row.color, price: row.sale_price ?? row.price,
                available: row.stock_quantity > 0, stock: row.stock_quantity } : { ...choice, available: false, stock: 0 };
            });
            setChoices(refreshed);
            const updated = refreshed.find((choice) => choice.id === selected.id);
            if (updated) onSelect?.(updated);
          } catch {
            setAttempts((previous) => ({ ...previous, [selected.id]: "verify" }));
            setFeedback(`${error.message} Hãy mở trang sản phẩm để cập nhật biến thể.`);
          }
        }
      } else {
        notifyCartChanged();
        setAttempts((previous) => ({ ...previous, [selected.id]: "verify" }));
        setFeedback("Chưa xác nhận được thao tác. Bạn kiểm tra số lượng trong giỏ hàng trước khi thêm lại nhé.");
      }
    } finally {
      writing.current = false;
      setPending(false);
    }
  }

  return (
    <article className="vsc-chat-product">
      <div className="vsc-chat-product-summary">
        {item.image && (
          <Link className="vsc-chat-product-image" href={item.href} onClick={onNavigate} aria-label={item.name} prefetch={false}>
            {/* eslint-disable-next-line @next/next/no-img-element -- Catalog images use the store's existing upload/URL scheme. */}
            <img src={resolveProductImage(item.image)} alt="" loading="lazy" />
          </Link>
        )}
        <div className="vsc-chat-product-info">
          {item.category && <span className="vsc-chat-category">{item.category}</span>}
          <strong className="vsc-chat-product-name">{item.name}</strong>
          {displayed ? (
            <>
              <span className="vsc-chat-price">
                {!selected && choices.length > 1 ? "Từ " : ""}{formatVnd(displayed.price)}
              </span>
              <div className="vsc-chat-meta-row">
                <span className="vsc-chat-variant-meta">{displayed.color} · {displayed.size}</span>
                <span className={`vsc-chat-stock-pill ${displayed.available ? "is-in" : "is-out"}`}>
                  {displayed.available ? "Còn hàng" : "Hết hàng"}
                </span>
              </div>
            </>
          ) : (
            <small>Chưa có biến thể đang bán.</small>
          )}
          {item.note && <small className="vsc-chat-product-note">{item.note}</small>}
        </div>
      </div>

      {choices.length > 1 && (
        <div className="vsc-chat-choice">
          <label htmlFor={selectId}>Chọn size &amp; màu</label>
          <select id={selectId} value={choiceId} disabled={pending} onChange={(event) => {
            const choice = choices.find((variant) => variant.id === event.target.value);
            if (!choice) return;
            setChoiceId(choice.id);
            setFeedback("");
            onSelect?.(choice);
          }}>
            <option value="" disabled>{displayed && onSelect ? `Tính tổng theo ${displayed.color} · ${displayed.size}` : "Chọn biến thể"}</option>
            {choices.map((choice) => (
              <option key={choice.id} value={choice.id} disabled={Boolean(onSelect && !choice.available)}>
                {choice.color} · {choice.size} · {formatVnd(choice.price)}{choice.available ? "" : " · Hết hàng"}
              </option>
            ))}
          </select>
        </div>
      )}

      {item.purchase && canAdd && (
        <div className="vsc-chat-choice">
          <label htmlFor={`${selectId}-quantity`}>Số lượng</label>
          <input id={`${selectId}-quantity`} type="number" min={1} max={selected?.stock ?? 99999} step={1}
            value={quantityText} onChange={(event) => setQuantityText(event.target.value)} disabled={pending} />
          {selected?.available && selected.stock !== undefined && quantity > selected.stock && (
            <small className="vsc-chat-out-of-stock">Số lượng vượt quá tồn kho hiện có.</small>
          )}
        </div>
      )}

      <div className="vsc-chat-card-actions">
        <Link className="vsc-chat-btn-secondary" href={item.href} prefetch={false} onClick={onNavigate}>
          Xem chi tiết
        </Link>
        {canAdd && (token ? (
          attempt === "verify" ? (
            <Link className="vsc-chat-btn-primary" href="/cart" prefetch={false} onClick={onNavigate}>Kiểm tra giỏ</Link>
          ) : (
            <button
              type="button"
              className={`vsc-chat-btn-primary${attempt === "added" ? " is-added" : ""}`}
              disabled={pending || !selected?.available || !validQuantity || attempt === "added"}
              onClick={add}
            >
              {pending ? "Đang thêm…" : attempt === "added" ? "✓ Đã thêm" : "Thêm vào giỏ"}
            </button>
          )
        ) : (
          <Link className="vsc-chat-btn-primary" href={`/dang-nhap?returnTo=${encodeURIComponent(item.href)}`} prefetch={false} onClick={onNavigate}>
            Đăng nhập để mua
          </Link>
        ))}
      </div>

      {feedback && (
        <p className="vsc-chat-card-feedback" role="status">
          {feedback}{" "}
          <Link href="/cart" prefetch={false} onClick={onNavigate}>Xem giỏ hàng →</Link>
        </p>
      )}
    </article>
  );
}

export function ChatOutfit({ item, ...props }: { item: OutfitCard; token: string; onNavigate: () => void }) {
  const [selected, setSelected] = useState<Record<string, Choice>>({});
  const total = item.products.reduce((sum, product) => sum + ((selected[product.id] ?? product.variants[0])?.price ?? 0), 0);
  const overBudget = item.maxPrice !== undefined && (item.exclusive ? total >= item.maxPrice : total > item.maxPrice);
  return (
    <section className="vsc-chat-outfit">
      <div className="vsc-chat-card-heading">
        <strong>{item.name}</strong>
        <span className="vsc-chat-price">{formatVnd(total)}</span>
      </div>
      <p>{item.reason}</p>
      {overBudget && <p className="vsc-chat-out-of-stock">Các biến thể đã chọn hiện vượt ngân sách.</p>}
      {item.replaced && <p className="vsc-chat-out-of-stock">Đã thay món không còn biến thể phù hợp: {item.replaced}.</p>}
      {item.href && <Link className="vsc-chat-outfit-link" href={item.href} prefetch={false} onClick={props.onNavigate}>Xem bộ phối ↗</Link>}
      <div className="vsc-chat-pieces">
        {item.products.map((piece) => (
          <ChatProduct key={piece.id} item={piece} {...props} onSelect={(choice) => setSelected((previous) => ({ ...previous, [piece.id]: choice }))} />
        ))}
      </div>
    </section>
  );
}

const date = new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" });
const dateLabel = (value: string) => Number.isNaN(Date.parse(value)) ? undefined : date.format(new Date(value));

export function ChatOrder({ item, onNavigate, onSelect, showSelect }: {
  item: OrderCard; onNavigate: () => void; onSelect: (id: string) => void; showSelect: boolean;
}) {
  const method = paymentMethodText[item.paymentMethod];
  return (
    <article className="vsc-chat-order">
      <div className="vsc-chat-card-heading">
        <strong>Đơn #{item.code}</strong>
        <span className="vsc-chat-order-status">{orderStatusText[item.status]}</span>
      </div>
      <div className="vsc-chat-order-meta">
        <small>{method} · {paymentStatusText[item.paymentStatus]}</small>
        {dateLabel(item.updatedAt) && <small>Cập nhật: {dateLabel(item.updatedAt)}</small>}
        {item.trackingNumber && <small>Mã vận đơn: {item.trackingNumber}</small>}
        {item.estimatedDelivery && dateLabel(item.estimatedDelivery) && <small>Dự kiến giao: {dateLabel(item.estimatedDelivery)}</small>}
        {item.refundAmount !== undefined && <small>Đã hoàn: {formatVnd(item.refundAmount)}</small>}
      </div>
      <div className="vsc-chat-card-actions">
        <Link className="vsc-chat-btn-secondary" href={item.href} prefetch={false} onClick={onNavigate}>
          {item.actions.cancel ? "Xem / Hủy đơn" : item.actions.returnRequest ? "Xem / Đổi trả" : item.actions.pay ? "Tiếp tục thanh toán" : "Xem chi tiết đơn"}
        </Link>
        {showSelect && <button type="button" className="vsc-chat-btn-primary" onClick={() => onSelect(item.id)}>Chọn đơn</button>}
      </div>
    </article>
  );
}
