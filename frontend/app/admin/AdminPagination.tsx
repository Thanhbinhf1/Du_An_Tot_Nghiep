import type { ApiPagination } from "@/lib/api";

export function adminListPath(path: string, values: Record<string, string | number>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) if (value !== "" && value !== "all") query.set(key, String(value));
  return `${path}?${query}`;
}

export default function AdminPagination({ page, pagination, loading, onPage, onLimit }: {
  page: number; pagination?: ApiPagination; loading: boolean; onPage: (page: number) => void; onLimit?: (limit: number) => void;
}) {
  const pages = Math.max(1, pagination?.totalPages ?? 1);
  const total = pagination?.total;
  const limit = pagination?.limit ?? 10;
  const start = (page - 1) * limit + 1;
  return <nav className="admin-actions variant-pagination" aria-label="Phân trang danh sách">
    {onLimit && <label className="admin-page-size">Hiển thị <select value={limit} onChange={(event) => onLimit(Number(event.target.value))} aria-label="Số dòng mỗi trang">
      {[10, 20, 25, 50].map((value) => <option key={value} value={value}>{value} dòng/trang</option>)}
    </select></label>}
    <span className="admin-page-summary">Trang {page}/{pages}{!loading && total !== undefined && (total > 0 ? ` · ${start}–${Math.min(page * limit, total)} / ${total} bản ghi` : " · 0 bản ghi")}</span>
    <button type="button" disabled={loading || page <= 1} onClick={() => onPage(page - 1)}>Trang trước</button>
    <button type="button" disabled={loading || page >= pages} onClick={() => onPage(page + 1)}>Trang sau</button>
  </nav>;
}
