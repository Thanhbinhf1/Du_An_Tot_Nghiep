"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { formatVnd } from "@/data/products";
import { useDemoOrders } from "@/lib/storefront-demo";
import type { DemoOrder } from "@/lib/storefront-demo";
import { API_BASE_URL, authenticatedHeaders, readApiResponse } from "@/lib/api";
import { useDemoAuth } from "@/lib/demo-auth";
import { useCatalogProducts } from "@/lib/useCatalogProducts";

type ApiOrder = {
  _id: string;
  created_at: string;
  order_status: string;
  final_amount: number;
  discount_amount: number;
  coupon_code: string | null;
  receiver_name: string;
  receiver_phone: string;
  shipping_address: string;
  shipping_method: string;
  items: Array<{
    product_id: string;
    product_name: string;
    size: string;
    color: string;
    quantity: number;
    price_at_buy: number;
  }>;
};

const orderStatusLabels: Record<string, DemoOrder["status"]> = {
  pending: "Chờ xác nhận",
  processing: "Đang xử lý",
  shipping: "Đang giao",
  completed: "Đã giao",
  cancelled: "Đã hủy",
};

function mapApiOrder(order: ApiOrder): DemoOrder {
  return {
    id: order._id,
    createdAt: order.created_at,
    status: orderStatusLabels[order.order_status] ?? "Chờ xác nhận",
    items: order.items.map((item) => ({
      productId: item.product_id,
      productName: item.product_name,
      priceAtBuy: item.price_at_buy,
      size: item.size,
      color: item.color,
      quantity: item.quantity,
    })),
    total: order.final_amount,
    ...(order.discount_amount > 0 ? {
      couponCode: order.coupon_code ?? undefined,
      discountAmount: order.discount_amount,
    } : {}),
    address: {
      name: order.receiver_name,
      phone: order.receiver_phone,
      address: order.shipping_address,
    },
    delivery: order.shipping_method,
  };
}

function useAccountOrders() {
  const localOrders = useDemoOrders();
  const { isLoggedIn, account, token } = useDemoAuth();
  const accountKey = account.trim().toLowerCase();
  const [remoteState, setRemoteState] = useState<{ account: string; orders: DemoOrder[]; error: string } | null>(null);

  useEffect(() => {
    if (!isLoggedIn || !token || !accountKey) return;
    const controller = new AbortController();
    fetch(`${API_BASE_URL}/orders/mine`, {
      headers: authenticatedHeaders(token),
      signal: controller.signal,
    })
      .then(readApiResponse<ApiOrder[]>)
      .then((orders) => setRemoteState({
        account: accountKey,
        orders: orders.map(mapApiOrder),
        error: "",
      }))
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setRemoteState({
          account: accountKey,
          orders: [],
          error: cause instanceof Error ? cause.message : "Không thể tải lịch sử đơn hàng.",
        });
      });
    return () => controller.abort();
  }, [accountKey, isLoggedIn, token]);

  const remoteOrders = remoteState?.account === accountKey ? remoteState.orders : [];
  const orders = [
    ...remoteOrders,
    ...localOrders.filter((localOrder) => !remoteOrders.some((remoteOrder) => remoteOrder.id === localOrder.id)),
  ];
  return {
    orders,
    error: remoteState?.account === accountKey ? remoteState.error : "",
  };
}

function OrderCard({ order, products }: { order: DemoOrder; products: ReturnType<typeof useCatalogProducts>["products"] }) {
  return (
    <article className="order-card">
      <div className="order-card-heading"><div><strong>{order.id}</strong><span>Đặt ngày {new Date(order.createdAt).toLocaleDateString("vi-VN")}</span></div><span className="order-status">{order.status}</span></div>
      <div className="order-card-products">{order.items.map((item) => {
        const product = products.find((candidate) => candidate.id === item.productId);
        const productName = item.productName ?? product?.name;
        return productName ? <div key={`${item.productId}-${item.size}-${item.color ?? ""}`}>{productName} · {item.color ?? product?.color} · {item.size} × {item.quantity}</div> : null;
      })}</div>
      <div className="order-card-footer"><strong>{formatVnd(order.total)}</strong><Link className="pill-button" href={`/orders/${encodeURIComponent(order.id)}`}>Chi tiết / theo dõi</Link></div>
    </article>
  );
}

export function OrderHistory() {
  const { orders, error } = useAccountOrders();
  const { products } = useCatalogProducts();
  return (
    <section className="orders-page">
      <div className="breadcrumb"><Link href="/">Trang chủ</Link> / Tài khoản / Đơn hàng</div>
      <h1>Đơn hàng của tôi</h1>
      <p className="muted">Lịch sử đơn hàng được đồng bộ với tài khoản của bạn.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      {orders.length ? <div className="order-list">{orders.map((order) => <OrderCard key={order.id} order={order} products={products} />)}</div> : (
        <div className="empty-state"><h2>Bạn chưa có đơn hàng</h2><p>Đơn hàng sẽ xuất hiện tại đây sau khi bạn hoàn tất checkout.</p><Link className="pill-button dark" href="/products">Mua sắm ngay</Link></div>
      )}
    </section>
  );
}

export function OrderDetails({ orderId }: { orderId: string }) {
  const { orders } = useAccountOrders();
  const { products } = useCatalogProducts();
  const order = orders.find((item) => item.id === orderId);
  if (!order) return <div className="empty-state order-not-found"><h1>Không tìm thấy đơn hàng</h1><p>Đơn hàng có thể không tồn tại trong trình duyệt này.</p><Link className="pill-button" href="/orders">Về đơn hàng</Link></div>;
  return (
    <section className="orders-page">
      <div className="breadcrumb"><Link href="/orders">Đơn hàng của tôi</Link> / {order.id}</div>
      <h1>Theo dõi đơn hàng</h1>
      <p className="muted">Mã đơn hàng: <strong>{order.id}</strong> · {new Date(order.createdAt).toLocaleString("vi-VN")}</p>
      <div className="tracking-card"><span className="order-status">{order.status}</span><div className="tracking-steps"><span className="complete">Đã đặt hàng</span><span className={order.status === "Đang giao" || order.status === "Đã giao" ? "complete" : ""}>Đang giao</span><span className={order.status === "Đã giao" ? "complete" : ""}>Đã giao</span></div><p>Trạng thái đơn hàng được cập nhật từ hệ thống cửa hàng.</p></div>
      <div className="order-card">
        <h2>Sản phẩm</h2>
        {order.items.map((item) => {
          const product = products.find((candidate) => candidate.id === item.productId);
          const productName = item.productName ?? product?.name;
          const unitPrice = item.priceAtBuy ?? product?.price;
          return productName && unitPrice !== undefined ? <div className="order-detail-row" key={`${item.productId}-${item.size}-${item.color ?? ""}`}><span>{productName} · {item.color ?? product?.color} · {item.size} × {item.quantity}</span><strong>{formatVnd(unitPrice * item.quantity)}</strong></div> : null;
        })}
        {order.discountAmount ? <div className="order-detail-row"><span>Mã giảm giá {order.couponCode ? `(${order.couponCode})` : ""}</span><strong>−{formatVnd(order.discountAmount)}</strong></div> : null}
        <div className="order-detail-row"><strong>Tổng cộng</strong><strong>{formatVnd(order.total)}</strong></div>
        <h2>Giao hàng</h2><p>{order.address.name}</p><p>{order.address.phone}</p><p>{order.address.address}</p><p>{order.delivery}</p>
      </div>
      <p><Link className="pill-button" href="/orders">Quay lại đơn hàng</Link></p>
    </section>
  );
}

export function OrderDetailsFromRoute() {
  const params = useParams<{ id: string }>();
  return <OrderDetails orderId={decodeURIComponent(params.id)} />;
}

export function OrderConfirmation({ orderId }: { orderId: string }) {
  const { orders } = useAccountOrders();
  const order = orders.find((item) => item.id === orderId);
  if (!order) return <div className="empty-state order-not-found"><h1>Không tìm thấy đơn hàng</h1><Link href="/products">Tiếp tục mua sắm</Link></div>;
  return (
    <section className="order-confirmation">
      <div className="confirmation-mark" aria-hidden="true">✓</div>
      <span className="profile-eyebrow">ĐẶT HÀNG DEMO THÀNH CÔNG</span>
      <h1>Cảm ơn bạn đã đặt hàng!</h1>
      <p>Đơn hàng <strong>{order.id}</strong> đã được ghi nhận vào hệ thống cửa hàng.</p>
      {order.discountAmount ? <p>Mã giảm giá {order.couponCode ? <strong>{order.couponCode}</strong> : null}: <strong>−{formatVnd(order.discountAmount)}</strong></p> : null}
      <p>Tổng đơn hàng: <strong>{formatVnd(order.total)}</strong></p>
      <div className="confirmation-actions"><Link className="pill-button dark" href={`/orders/${encodeURIComponent(order.id)}`}>Theo dõi đơn hàng</Link><Link className="pill-button" href="/products">Tiếp tục mua sắm</Link></div>
      <p className="small muted">Thanh toán COD đang ở chế độ demo.</p>
    </section>
  );
}
