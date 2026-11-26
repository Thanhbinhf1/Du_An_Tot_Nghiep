import { useEffect, useRef, type ReactNode } from "react";
export default function CatalogDialog({ title, children, close }: { title: string; children: ReactNode; close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current; const previous = document.activeElement; dialog?.showModal(); return () => { dialog?.close(); if (previous instanceof HTMLElement) previous.focus(); }; }, []);
  return <dialog ref={ref} className="catalog-dialog" aria-label={title} onCancel={event => { event.preventDefault(); close(); }}><header><h2>{title}</h2><button type="button" aria-label="Đóng hộp thoại" onClick={close}>×</button></header>{children}</dialog>;
}
