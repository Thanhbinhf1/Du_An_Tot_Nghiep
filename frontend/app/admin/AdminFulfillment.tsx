"use client";

import AdminOrders, { type OrderListView } from "./AdminOrders";
import AdminIcon, { type AdminIconName } from "./AdminIcon";
import type { AdminRequest, AdminPaginatedRequest } from "./ProductVariantsManager";

const views: Record<string, OrderListView & { icon: AdminIconName }> = {
  packing: {
    label: "Chờ bàn giao",
    description: "Theo dõi đơn đang chuẩn bị hoặc chờ bàn giao cho đơn vị giao hàng.",
    empty: "Không có đơn chờ bàn giao khớp bộ lọc.",
    queue: "packing",
    icon: "inventory",
  },
  shipping: {
    label: "Đang giao",
    empty: "Không có đơn đang giao khớp bộ lọc.",
    description: "Theo dõi đơn đang giao, ghi nhận kết quả giao hoặc sự cố khi có thông tin xác thực.",
    status: "shipping",
    icon: "fulfillment",
  },
  delivery_issue: {
    label: "Giao thất bại",
    empty: "Không có đơn giao thất bại khớp bộ lọc.",
    description: "Xem lý do giao thất bại, ghi nhận liên hệ, yêu cầu giao lại hoặc chuyển hoàn.",
    queue: "delivery_issue",
    icon: "warning",
  },
  incoming_return: {
    label: "Chờ kiểm hàng hoàn",
    empty: "Không có đơn chờ kiểm hàng hoàn khớp bộ lọc.",
    description: "Đối chiếu và kiểm đếm hàng thực nhận trước khi ghi nhập bán hoặc cách ly.",
    queue: "incoming_return",
    icon: "returns",
  },
  returned: {
    label: "Đã kiểm hàng hoàn",
    empty: "Không có đơn đã kiểm hàng hoàn khớp bộ lọc.",
    description: "Tra biên bản đã kiểm, hàng cách ly và hồ sơ tổn thất cần đối soát.",
    status: "returned",
    icon: "work",
  },
  refund_due: {
    label: "Chờ hoàn tiền",
    empty: "Không có đơn chờ hoàn tiền khớp bộ lọc.",
    description: "Theo dõi đơn đã thu tiền cần hoàn và ghi nhận chứng từ theo quyền.",
    queue: "refund_due",
    icon: "refund",
  },
  refunded: {
    label: "Đã hoàn tiền",
    description: "Tra các đơn đã ghi nhận hoàn tiền và xem mã chứng từ.",
    empty: "Không có đơn đã hoàn tiền khớp bộ lọc.",
    paymentStatus: "refunded",
    icon: "payments",
  },
};

type Props = {
  view: string | null;
  initialSearch: string;
  isAdmin: boolean;
  request: AdminRequest;
  paginatedRequest: AdminPaginatedRequest;
};

export default function AdminFulfillment({ view, ...listProps }: Props) {
  const active = view && Object.hasOwn(views, view) ? view : "shipping";

  return (
    <div className="admin-fulfillment">
      <nav className="admin-fulfillment-nav" aria-label="Hàng đợi vận chuyển và hàng hoàn">
        {Object.entries(views).map(([id, item]) => (
          <a key={id} href={`#fulfillment?view=${id}`} aria-current={id === active ? "page" : undefined}>
            <AdminIcon name={item.icon} />{item.label}
          </a>
        ))}
      </nav>
      <AdminOrders key={active + ":" + listProps.initialSearch} view={views[active]} {...listProps} />
    </div>
  );
}
