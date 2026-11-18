const icons = {
  dashboard: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  products: "m8 4-5 3 2 5 3-1v9h8v-9l3 1 2-5-5-3a4 4 0 0 1-8 0Z",
  inventory: "M3 7h18v13H3z M3 7l3-4h12l3 4 M9 11h6",
  orders: "M5 8h14l1 13H4L5 8Z M9 9V6a3 3 0 0 1 6 0v3",
  payments: "M3 6h18v13H3z M3 10h18 M6 15h4",
  customers: "M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M20 21v-2a4 4 0 0 0-2-3.5 M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M17 4a3.5 3.5 0 0 1 0 6",
  categories: "M3 7h7l2 2h9v11H3z M3 7V5h7",
  brands: "M3 4h8l10 10-7 7L4 11z M8.5 8.5h.01",
  coupons: "M3 8h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4V8Z M14 9v1m0 3v1m0 3v1",
  reviews: "m12 3 2.8 5.8 6.4.9-4.6 4.5 1.1 6.3-5.7-3-5.7 3 1.1-6.3-4.6-4.5 6.4-.9L12 3Z",
  outfits: "M12 3c0 4.8-2.2 7-7 7 4.8 0 7 2.2 7 7 0-4.8 2.2-7 7-7-4.8 0-7-2.2-7-7Z M19 15v6m-3-3h6",
  contacts: "M3 5h18v14H3z M3 6l9 7 9-7",
  settings: "M4 6h16 M4 12h16 M4 18h16 M8 3v6 M16 9v6 M11 15v6",
  revenue: "M4 19V5 M4 19h16 M7 15l4-5 4 2 5-6",
  warning: "m12 4 9 16H3L12 4Z M12 10v4m0 3h.01",
};

export default function AdminIcon({ name }: { name: keyof typeof icons }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={icons[name]} />
    </svg>
  );
}
