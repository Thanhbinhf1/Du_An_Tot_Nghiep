export const adminSections = [
  { id: "dashboard", label: "Tổng quan", group: "Tổng quan" },
  { id: "work", label: "Trung tâm công việc", group: "Tổng quan" },
  { id: "orders", label: "Quản lý đơn hàng", group: "Bán hàng" },
  { id: "fulfillment", label: "Vận chuyển và hàng hoàn", group: "Bán hàng" },
  { id: "returns", label: "Yêu cầu đổi trả", group: "Bán hàng" },
  { id: "payments", label: "Quản lý thanh toán", group: "Bán hàng" },
  { id: "products", label: "Sản phẩm & Biến thể", group: "Hàng hóa" },
  { id: "categories", label: "Danh mục sản phẩm", group: "Hàng hóa" },
  { id: "brands", label: "Thương hiệu", group: "Hàng hóa" },
  { id: "inventory", label: "Quản lý tồn kho", group: "Hàng hóa" },
  { id: "coupons", label: "Mã giảm giá", group: "Marketing" },
  { id: "banners", label: "Banner & Nội dung", group: "Marketing" },
  { id: "outfits", label: "Outfit & Tư vấn size", group: "Marketing" },
  { id: "customers", label: "Khách hàng", group: "Khách hàng" },
  { id: "reviews", label: "Đánh giá sản phẩm", group: "Khách hàng" },
  { id: "contacts", label: "Yêu cầu liên hệ", group: "Khách hàng" },
  { id: "staff", label: "Nhân viên & Phân quyền", group: "Quản trị" },
  { id: "reports", label: "Báo cáo & Phân tích", group: "Quản trị" },
  { id: "activity", label: "Nhật ký hoạt động", group: "Quản trị" },
  { id: "settings", label: "Cài đặt cửa hàng", group: "Quản trị" },
] as const;
export type AdminSectionId = typeof adminSections[number]["id"];
export const queueLabels = {
  ready: "Chờ xác nhận đơn",
  awaiting_payment: "Chờ thanh toán",
  packing: "Chờ bàn giao vận chuyển",
  delivery_issue: "Cần xử lý giao thất bại",
  incoming_return: "Chờ kiểm hàng hoàn",
  refund_due: "Chờ hoàn tiền",
} as const;
export type OrderQueue = keyof typeof queueLabels;
export function isOrderQueue(value: string | null): value is OrderQueue {
  return value !== null && Object.hasOwn(queueLabels, value);
}
export function subscribeNavigation(update: () => void) {
  window.addEventListener("hashchange", update);
  return () => window.removeEventListener("hashchange", update);
}
export function navigate(section: AdminSectionId, params?: Record<string, string>) {
  const query = new URLSearchParams(params).toString();
  window.location.hash = section + (query ? "?" + query : "");
}
