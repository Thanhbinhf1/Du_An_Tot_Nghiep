const icons = {
  dashboard: "m3 10 9-7 9 7 M5 9v12h5v-6h4v6h5V9",
  work: "M8 4H5v17h14V4h-3 M8 3h8v4H8z M8 12l1 1 2-2 M13 12h3 M8 17l1 1 2-2 M13 17h3",
  products: "m8 4-5 3 2 5 3-1v9h8v-9l3 1 2-5-5-3a4 4 0 0 1-8 0Z",
  inventory: "M3 7h18v13H3z M3 7l3-4h12l3 4 M9 11h6",
  orders: "M5 8h14l1 13H4L5 8Z M9 9V6a3 3 0 0 1 6 0v3",
  fulfillment: "M3 5h12v12H3z M15 9h4l2 3v5h-6 M7 17v2 M17 17v2",
  payments: "M3 6h18v13H3z M3 10h18 M6 15h4",
  customers: "M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M20 21v-2a4 4 0 0 0-2-3.5 M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M17 4a3.5 3.5 0 0 1 0 6",
  staff: "M12 22s7-4 7-10V5l-7-3-7 3v7c0 6 7 10 7 10Z M9 12l2 2 4-4",
  categories: "M3 7h7l2 2h9v11H3z M3 7V5h7",
  brands: "M3 4h8l10 10-7 7L4 11z M8.5 8.5h.01",
  coupons: "M3 8h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4V8Z M14 9v1m0 3v1m0 3v1",
  banners: "M3 5h18v14H3z M4 16l5-5 4 4 3-3 4 4 M14 9h.01",
  reviews: "m12 3 2.8 5.8 6.4.9-4.6 4.5 1.1 6.3-5.7-3-5.7 3 1.1-6.3-4.6-4.5 6.4-.9L12 3Z",
  outfits: "M12 3c0 4.8-2.2 7-7 7 4.8 0 7 2.2 7 7 0-4.8 2.2-7 7-7-4.8 0-7-2.2-7-7Z M19 15v6m-3-3h6",
  contacts: "M3 5h18v14H3z M3 6l9 7 9-7",
  settings: "M4 6h16 M4 12h16 M4 18h16 M8 3v6 M16 9v6 M11 15v6",
  revenue: "M4 19V5 M4 19h16 M7 15l4-5 4 2 5-6",
  reports: "M3 21h18 M5 17V9h3v8 M11 17V4h3v13 M17 17v-5h3v5",
  download: "M12 3v12m-4-4 4 4 4-4 M5 16v5h14v-5",
  warning: "m12 4 9 16H3L12 4Z M12 10v4m0 3h.01",
  menu: "M4 6h16 M4 12h16 M4 18h16",
  search: "M16 10a6 6 0 1 1-12 0 6 6 0 0 1 12 0Z M14.5 14.5 21 21",
  bell: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10 21h4",
  store: "M4 10v11h16V10 M3 10l2-6h14l2 6c-1 2-4 2-5 0-1 2-3 2-4 0-1 2-3 2-4 0-1 2-4 2-5 0Z M9 21v-6h6v6",
  chevron: "m9 6 6 6-6 6",
  down: "m6 9 6 6 6-6",
  refresh: "M20 7v5h-5 M4 17v-5h5 M5 9a7.5 7.5 0 0 1 13-4l2 3 M19 15a7.5 7.5 0 0 1-13 4l-2-3",
  refund: "M8 5a8 8 0 1 1-3 12 M4 4v7h7 M12 8v5l3 2",
  returns: "M4 8h14l-3-3m3 3-3 3 M20 16H6l3 3m-3-3 3-3",
  plus: "M12 5v14 M5 12h14",
  history: "M4 11a8 8 0 1 1 2 6 M4 5v6h6 M12 7v5l3 2",
  activity: "M7 3h10v18H7z M10 7h4 M10 11h4 M10 15h4",
};

export type AdminIconName = keyof typeof icons;

export default function AdminIcon({ name }: { name: AdminIconName }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={icons[name]} />
    </svg>
  );
}
