"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { usePathname } from "next/navigation";
import { useDemoAuth } from "@/lib/demo-auth";
import { STORE_LOGO, STORE_NAME } from "@/lib/store-brand";
import { ApiError } from "@/lib/api";
import { sendChat, type ChatResponse } from "./chat-api";
import { ChatOrder, ChatOutfit, ChatProduct } from "./ChatCards";
import { readChatProductColor } from "./product-context";
import "./storefront-chat.css";

const goals = [
  {
    id: "Tìm sản phẩm",
    label: "Tìm sản phẩm",
    desc: "Lọc theo màu, giá, size",
  },
  {
    id: "Tư vấn size",
    label: "Tư vấn size",
    desc: "Theo chiều cao, cân nặng",
  },
  {
    id: "Phối đồ",
    label: "Phối đồ",
    desc: "Gợi ý set đồ hợp gu",
  },
  {
    id: "Tra đơn hàng",
    label: "Tra đơn hàng",
    desc: "Kiểm tra trạng thái giao",
  },
] as const;

const prompts: Record<string, { message: string; example?: string }> = {
  "Tìm sản phẩm": { message: "Bạn đang tìm món gì? Có thể thêm màu, size hoặc ngân sách.", example: "Tìm áo thun đen size L dưới 300k" },
  "Tư vấn size": { message: "Bạn nhập chiều cao và cân nặng. Nếu chưa mở trang sản phẩm, bạn có thể ghi thêm tên mẫu hoặc danh mục.", example: "Mình cao 1m68, nặng 57kg" },
  "Phối đồ": { message: "Bạn muốn phối với món nào, diện đi đâu và có ngân sách bao nhiêu?", example: "Phối đồ đi học với quần jean, tổng dưới 700k" },
};

type Entry = { id: number; side: "user"; text: string } | { id: number; side: "assistant"; response: ChatResponse };
type Pending = { text: string; display: string; page: { productId?: string; color?: string; orderId?: string }; context: ChatResponse["context"] };

function SparkleChatIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3.2c.4 3.4 2.1 5.1 5.5 5.5-3.4.4-5.1 2.1-5.5 5.5-.4-3.4-2.1-5.1-5.5-5.5 3.4-.4 5.1-2.1 5.5-5.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M18.6 14.4c.2 1.6 1 2.4 2.6 2.6-1.6.2-2.4 1-2.6 2.6-.2-1.6-1-2.4-2.6-2.6 1.6-.2 2.4-1 2.6-2.6Z"
        fill="currentColor"
      />
    </svg>
  );
}

function GoalIcon({ id }: { id: string }) {
  switch (id) {
    case "Tìm sản phẩm":
      return (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.7" />
          <path d="m16 16 4.2 4.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      );
    case "Tư vấn size":
      return (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4 15.5 15.5 4 20 8.5 8.5 20 4 15.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="m12.5 7 2 2M9.5 10l2 2M6.5 13l2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "Phối đồ":
      return (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 3.5c.3 2.8 1.7 4.2 4.5 4.5-2.8.3-4.2 1.7-4.5 4.5-.3-2.8-1.7-4.2-4.5-4.5 2.8-.3 4.2-1.7 4.5-4.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M18 14.5c.2 1.4.9 2.1 2.3 2.3-1.4.2-2.1.9-2.3 2.3-.2-1.4-.9-2.1-2.3-2.3 1.4-.2 2.1-.9 2.3-2.3Z" fill="currentColor" />
        </svg>
      );
    default:
      return (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 3 4.5 7v10L12 21l7.5-4V7L12 3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M4.5 7 12 11l7.5-4M12 11v10" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
      );
  }
}

function ChatPane({ token }: { token: string }) {
  const pathname = usePathname();
  const routeMatch = pathname.match(/^\/product\/([a-f\d]{24})\/?$/i);
  const productId = routeMatch?.[1];
  const orderId = pathname.match(/^\/orders\/([a-f\d]{24})\/?$/i)?.[1];
  const modal = useRef<HTMLDialogElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const messages = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const composing = useRef(false);
  const inFlight = useRef<AbortController | null>(null);
  const latestAnswer = useRef<{ id: number; previousContext: ChatResponse["context"] } | null>(null);
  const context = useRef<ChatResponse["context"]>({});
  const sequence = useRef(0);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [canHideAnswer, setCanHideAnswer] = useState(false);
  const [scrollTarget, setScrollTarget] = useState<number | "status">();
  const [failed, setFailed] = useState<{ request: Pending; message: string }>();
  const [prompt, setPrompt] = useState<(typeof prompts)[string]>();
  const [ai, setAi] = useState<ChatResponse["aiStatus"]>();

  useEffect(() => () => {
    const request = inFlight.current;
    inFlight.current = null;
    request?.abort();
  }, []);

  useEffect(() => {
    if (!open) return;
    const dialog = modal.current;
    if (!dialog?.open) dialog?.showModal();
    const viewport = window.visualViewport;
    if (!dialog || !viewport) return;
    function resize() {
      dialog?.style.setProperty("--chat-viewport-height", `${viewport?.height ?? window.innerHeight}px`);
      dialog?.style.setProperty("--chat-viewport-top", `${viewport?.offsetTop ?? 0}px`);
    }
    resize();
    viewport.addEventListener("resize", resize);
    viewport.addEventListener("scroll", resize);
    return () => {
      viewport.removeEventListener("resize", resize);
      viewport.removeEventListener("scroll", resize);
    };
  }, [open]);

  useEffect(() => {
    const scroller = messages.current;
    if (!open || !scroller || scrollTarget === undefined) return;
    const target = scroller.querySelector<HTMLElement>(`[data-chat-focus="${scrollTarget}"]`);
    if (target) scroller.scrollTop += target.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 14;
  }, [scrollTarget, entries, pending, failed, prompt, notice, open]);

  function stop() {
    const request = inFlight.current;
    if (!request) return;
    inFlight.current = null;
    request.abort();
    setPending(false);
    setNotice("Đã dừng trả lời.");
    setScrollTarget("status");
  }

  function stopOrHideAnswer() {
    if (inFlight.current) {
      stop();
      return;
    }
    const answer = latestAnswer.current;
    if (!answer) return;
    latestAnswer.current = null;
    context.current = answer.previousContext;
    setCanHideAnswer(false);
    setPrompt(undefined);
    setEntries((previous) => previous.filter((entry) => entry.id !== answer.id));
    setNotice("Đã ẩn câu trả lời vừa rồi.");
    setScrollTarget("status");
  }

  function resetConversation() {
    stop();
    latestAnswer.current = null;
    context.current = {};
    setEntries([]);
    setCanHideAnswer(false);
    setPrompt(undefined);
    setNotice(undefined);
    setFailed(undefined);
    setValue("");
    input.current?.focus();
  }

  function close() {
    stop();
    composing.current = false;
    modal.current?.close();
    setOpen(false);
    launcher.current?.focus();
  }

  async function submit(request: Pending, retry = false) {
    if (inFlight.current) return;
    const controller = new AbortController();
    inFlight.current = controller;
    latestAnswer.current = null;
    setPending(true);
    setCanHideAnswer(false);
    setNotice(undefined);
    setScrollTarget("status");
    setFailed(undefined);
    setPrompt(undefined);
    if (!retry) {
      const id = ++sequence.current;
      setEntries((previous) => [...previous.slice(-23), { id, side: "user", text: request.display }]);
      setValue("");
    }
    try {
      const response = await sendChat(request.text, request.context, request.page, token, controller.signal);
      if (inFlight.current !== controller || controller.signal.aborted) return;
      context.current = response.context;
      setAi(response.aiStatus);
      const id = ++sequence.current;
      latestAnswer.current = { id, previousContext: request.context };
      setCanHideAnswer(true);
      setEntries((previous) => [...previous.slice(-23), { id, side: "assistant", response }]);
      setScrollTarget(id);
    } catch (error) {
      if (inFlight.current !== controller || controller.signal.aborted) return;
      setFailed({ request, message: error instanceof ApiError ? error.message : "Trợ lý chưa phản hồi. Bạn có thể thử lại." });
    } finally {
      if (inFlight.current === controller) {
        inFlight.current = null;
        setPending(false);
      }
    }
  }

  function send(text: string, display = text) {
    const trimmed = text.trim();
    if (!trimmed || trimmed.length > 500) return;
    const color = readChatProductColor(productId)?.trim().slice(0, 32);
    void submit({ text: trimmed, display, context: context.current, page: { productId, color, orderId } });
  }

  function startGoal(goal: string) {
    if (inFlight.current) return;
    const hint = prompts[goal];
    if (!hint) { send(goal); return; }
    setFailed(undefined);
    setNotice(undefined);
    setPrompt(hint);
    setScrollTarget("status");
    input.current?.focus();
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    send(value);
  }

  const busyPage = /^\/(cart|checkout|payment)(\/|$)/.test(pathname);
  const hasConversation = entries.length > 0;

  return (
    <>
      <button
        ref={launcher}
        type="button"
        className={`vsc-chat-launcher${busyPage ? " vsc-chat-launcher-checkout" : ""}`}
        aria-label={`Trợ lý ${STORE_NAME}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <span className="vsc-chat-launcher-icon">
          <SparkleChatIcon size={19} />
          <i className="vsc-chat-launcher-dot" aria-hidden="true" />
        </span>
        <span className="vsc-chat-launcher-label">Trợ lý {STORE_NAME}</span>
      </button>

      {open && (
        <dialog
          ref={modal}
          className="vsc-chat-dialog"
          aria-labelledby="vsc-chat-title"
          onCancel={(event) => { event.preventDefault(); close(); }}
          onClick={(event) => { if (event.target === event.currentTarget) close(); }}
        >
          <div className="vsc-chat-shell">
            <header className="vsc-chat-header">
              <div className="vsc-chat-brand">
                <div className="vsc-chat-avatar">
                  {/* eslint-disable-next-line @next/next/no-img-element -- Static shop mark is used at a fixed size. */}
                  <img src={STORE_LOGO} alt="" width="38" height="38" />
                  <span className="vsc-chat-online-dot" aria-hidden="true" />
                </div>
                <div className="vsc-chat-title-group">
                  <h2 id="vsc-chat-title">Trợ lý {STORE_NAME}</h2>
                  <span className="vsc-chat-subtitle">Tư vấn mua sắm AI · Trực tuyến</span>
                </div>
              </div>
              <div className="vsc-chat-header-actions">
                {hasConversation && (
                  <button
                    type="button"
                    className="vsc-chat-icon-btn"
                    onClick={resetConversation}
                    aria-label="Làm mới cuộc trò chuyện"
                    title="Cuộc trò chuyện mới"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M4 12a8 8 0 0 1 13.7-5.6L20 8.5M20 4v4.5h-4.5M20 12a8 8 0 0 1-13.7 5.6L4 15.5M4 20v-4.5h4.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                )}
                <button type="button" className="vsc-chat-icon-btn" onClick={close} aria-label="Đóng trợ lý">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            </header>

            {ai === "unavailable" && (
              <p className="vsc-chat-notice" role="status">
                Bạn vẫn có thể tìm sản phẩm, chọn size và tra đơn với trợ lý cửa hàng.
              </p>
            )}

            <div className="vsc-chat-messages" ref={messages}>
              <div className={`vsc-chat-welcome${hasConversation ? " is-compact" : ""}`}>
                {!hasConversation && (
                  <div className="vsc-chat-welcome-hero">
                    <span className="vsc-chat-badge">
                      <SparkleChatIcon size={13} /> AI Stylist
                    </span>
                    <p className="vsc-chat-welcome-title">
                      Xin chào! Mình là trợ lý {STORE_NAME}.
                    </p>
                    <p className="vsc-chat-welcome-desc">
                      Hôm nay bạn muốn tìm sản phẩm, chọn size chuẩn hay phối đồ theo phong cách riêng?
                    </p>
                  </div>
                )}
                <div className="vsc-chat-goals">
                  {goals.map((goal) => (
                    <button
                      key={goal.id}
                      type="button"
                      className="vsc-chat-goal-card"
                      disabled={pending}
                      onClick={() => startGoal(goal.id)}
                    >
                      <span className="vsc-chat-goal-icon">
                        <GoalIcon id={goal.id} />
                      </span>
                      <span className="vsc-chat-goal-text">
                        <strong>{goal.label}</strong>
                        {!hasConversation && <small>{goal.desc}</small>}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="vsc-chat-log" role="log" aria-label="Hội thoại">
                {entries.map((entry) => entry.side === "user" ? (
                  <div key={entry.id} className="vsc-chat-row is-user">
                    <p className="vsc-chat-user">{entry.text}</p>
                  </div>
                ) : (
                  <div key={entry.id} className="vsc-chat-answer" data-chat-focus={entry.id}>
                    <div className="vsc-chat-answer-bubble">
                      <p className="vsc-chat-answer-text">{entry.response.text}</p>
                    </div>
                    {entry.response.cards.length > 0 && (
                      <div className="vsc-chat-cards">
                        {entry.response.cards.map((card, index, all) => card.kind === "product" ? (
                          <ChatProduct key={index} item={card} token={token} onNavigate={close} />
                        ) : card.kind === "outfit" ? (
                          <ChatOutfit key={index} item={card} token={token} onNavigate={close} />
                        ) : (
                          <ChatOrder
                            key={index}
                            item={card}
                            onNavigate={close}
                            showSelect={all.filter((item) => item.kind === "order").length > 1}
                            onSelect={(id) => send(`Tra đơn #${id}`, `Tra đơn #${card.code}`)}
                          />
                        ))}
                      </div>
                    )}
                    {(entry.response.links.length > 0 || entry.response.suggestions.length > 0) && (
                      <div className="vsc-chat-followups">
                        {entry.response.links.map((link) => (
                          <Link key={link.href} href={link.href} prefetch={false} onClick={close}>
                            {link.label}
                            <span aria-hidden="true"> ↗</span>
                          </Link>
                        ))}
                        {entry.response.suggestions.map((suggestion) => (
                          <button key={suggestion} type="button" disabled={pending} onClick={() => startGoal(suggestion)}>
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {prompt && (
                  <div className="vsc-chat-hint" data-chat-focus="status">
                    <p>{prompt.message}</p>
                    {prompt.example && (
                      <button
                        type="button"
                        className="vsc-chat-example-btn"
                        onClick={() => { setValue(prompt.example ?? ""); input.current?.focus(); }}
                      >
                        <span>Thử hỏi: “{prompt.example}”</span>
                        <span aria-hidden="true">→</span>
                      </button>
                    )}
                  </div>
                )}

                {pending && (
                  <div className="vsc-chat-typing" role="status" data-chat-focus="status">
                    <span className="vsc-chat-dots" aria-hidden="true">
                      <i />
                      <i />
                      <i />
                    </span>
                    <span>Trợ lý đang tìm gợi ý…</span>
                  </div>
                )}

                {notice && <p className="vsc-chat-status-pill" role="status" data-chat-focus="status">{notice}</p>}

                {failed && (
                  <div className="vsc-chat-error" role="status" data-chat-focus="status">
                    <p>{failed.message}</p>
                    <div className="vsc-chat-error-actions">
                      <button type="button" onClick={() => void submit(failed.request, true)}>Thử lại</button>
                      {token && /đăng nhập|token|phiên/i.test(failed.message) && (
                        <Link href="/dang-nhap" onClick={close}>Đăng nhập</Link>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="vsc-chat-composer-wrap">
              {(pending || canHideAnswer) && (
                <div className="vsc-chat-toolbar">
                  <button
                    type="button"
                    className={pending ? "vsc-chat-stop" : "vsc-chat-hide"}
                    onClick={stopOrHideAnswer}
                  >
                    {pending ? "■ Dừng trả lời" : "Ẩn kết quả vừa rồi"}
                  </button>
                </div>
              )}

              <form className="vsc-chat-form" onSubmit={onSubmit}>
                <textarea
                  ref={input}
                  aria-label="Tin nhắn cho trợ lý"
                  maxLength={500}
                  rows={1}
                  value={value}
                  placeholder="Nhập câu hỏi của bạn…"
                  onCompositionStart={() => { composing.current = true; }}
                  onCompositionEnd={() => { composing.current = false; }}
                  onChange={(event) => setValue(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey && !composing.current && !event.nativeEvent.isComposing && event.keyCode !== 229) {
                      event.preventDefault();
                      send(value);
                    }
                  }}
                />
                <button
                  type="submit"
                  className="vsc-chat-send"
                  aria-label="Gửi tin nhắn"
                  disabled={pending || !value.trim()}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M12 19V5m-6 6 6-6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </form>
            </div>
          </div>
        </dialog>
      )}
    </>
  );
}

export default function StorefrontChat() {
  const { account, token } = useDemoAuth();
  return <ChatPane key={JSON.stringify([account, token])} token={token} />;
}
