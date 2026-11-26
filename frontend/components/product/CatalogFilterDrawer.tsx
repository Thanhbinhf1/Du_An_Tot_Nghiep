"use client";

import { useId, useRef, useSyncExternalStore, type ReactNode } from "react";

const desktopQuery = "(min-width: 1100px)";
function subscribeToWidth(update: () => void) {
  const media = window.matchMedia(desktopQuery);
  media.addEventListener("change", update);
  return () => media.removeEventListener("change", update);
}
const isDesktop = () => window.matchMedia(desktopQuery).matches;
const initialWidth = () => false;

export default function CatalogFilterDrawer({ active, count, onReset, children, desktopSidebar = false }: {
  active: boolean;
  count?: number;
  onReset: () => void;
  children: ReactNode;
  desktopSidebar?: boolean;
}) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const desktop = useSyncExternalStore(subscribeToWidth, isDesktop, initialWidth);

  if (desktopSidebar && desktop) return (
    <aside className="category-sidebar" aria-label="Bộ lọc sản phẩm">
      <header><h2>Bộ lọc</h2>{active && <button type="button" onClick={onReset}>Xóa bộ lọc</button>}</header>
      {children}
    </aside>
  );

  return (
    <div className="store-catalog-filters">
      <button ref={opener} type="button" className="catalog-filter-trigger" aria-haspopup="dialog" aria-controls={id}
        onClick={() => dialog.current?.showModal()}>
        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden="true">
          <path d="M3 6h11m4 0h3M3 12h4m4 0h10M3 18h11m4 0h3" /><circle cx="16" cy="6" r="2" /><circle cx="9" cy="12" r="2" /><circle cx="16" cy="18" r="2" />
        </svg>
        Bộ lọc{active && <span className="catalog-filter-indicator" aria-label="đang áp dụng" />}
      </button>
      <dialog id={id} ref={dialog} className="catalog-filter-drawer" aria-labelledby={`${id}-title`}
        onClose={() => opener.current?.focus()}
        onClick={(event) => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
        <div className="catalog-filter-drawer-content">
          <div className="catalog-filter-drawer-heading">
            <h2 id={`${id}-title`}>Bộ lọc sản phẩm</h2>
            <button type="button" aria-label="Đóng bộ lọc" onClick={() => dialog.current?.close()}>×</button>
          </div>
          <div className="catalog-filter-drawer-fields">{children}</div>
          <div className="catalog-filter-drawer-actions">
            <button type="button" className="pill-button" disabled={!active} onClick={onReset}>Xóa bộ lọc</button>
            <button type="button" className="pill-button dark" onClick={() => dialog.current?.close()}>
              {count === undefined ? "Xem sản phẩm" : `Xem ${count} sản phẩm`}
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
