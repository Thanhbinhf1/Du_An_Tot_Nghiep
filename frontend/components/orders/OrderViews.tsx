"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { formatVnd } from "@/data/products";
import { useDemoOrders } from "@/lib/storefront-demo";
import type { DemoOrder } from "@/lib/storefront-demo";
import { useCatalogProducts } from "@/lib/useCatalogProducts";

function OrderCard({ order, products }: { order: DemoOrder; products: ReturnType<typeof useCatalogProducts>["products"] }) {
  return (
    <article className="order-card">
      <div className="order-card-heading"><div><strong>{order.id}</strong><span>Đặt ngày {new Date(order.createdAt).toLocaleDateString("vi-VN")}</span></div><span className="order-status">{order.status}</span></div>
      <div className="order-card-products">{order.items.map((item) => {
        const product = products.find((candidate) => candidate.id === item.productId);
        return product ? <div key={`${item.productId}-${item.size}-${item.color ?? ""}`}>{product.name} · {item.color ?? product.color} · {item.size} × {item.quantity}</div> : null;
      })}</div>
      <div className="order-card-footer"><strong>{formatVnd(order.total)}</strong><Link className="pill-button" href={`/orders/${encodeURIComponent(order.id)}`}>Chi tiết / theo dõi</Link></div>
    </article>
  );
}

export function OrderHistory() {
  const orders = useDemoOrders();
  const { products } = useCatalogProducts();
  return (
    <section className="orders-page">
      <div className="breadcrumb"><Link href="/">Trang chủ</Link> / Tài khoản / Đơn hàng</div>
      <h1>Đơn hàng của tôi</h1>
      <p className="muted">Lịch sử đơn hàng demo được lưu riêng theo tài khoản trên trình duyệt này.</p>
      {orders.length ? <div className="order-list">{orders.map((order) => <OrderCard key={order.id} order={order} products={products} />)}</div> : (
        <div className="empty-state"><h2>Bạn chưa có đơn hàng</h2><p>Đơn hàng sẽ xuất hiện tại đây sau khi bạn hoàn tất checkout.</p><Link className="pill-button dark" href="/products">Mua sắm ngay</Link></div>
      )}
    </section>
  );
}

export function OrderDetails({ orderId }: { orderId: string }) {
  const orders = useDemoOrders();
  const { products } = useCatalogProducts();
  const order = orders.find((item) => item.id === orderId);
  if (!order) return <div className="empty-state order-not-found"><h1>Không tìm thấy đơn hàng</h1><p>Đơn hàng có thể không tồn tại trong trình duyệt này.</p><Link className="pill-button" href="/orders">Về đơn hàng</Link></div>;
  return (
    <section className="orders-page">
      <div className="breadcrumb"><Link href="/orders">Đơn hàng của tôi</Link> / {order.id}</div>
      <h1>Theo dõi đơn hàng</h1>
      <p className="muted">Mã đơn hàng: <strong>{order.id}</strong> · {new Date(order.createdAt).toLocaleString("vi-VN")}</p>
      <div className="tracking-card"><span className="order-status">{order.status}</span><div className="tracking-steps"><span className="complete">Đã đặt hàng</span><span className={order.status !== "Đang xử lý" ? "complete" : ""}>Đang giao</span><span className={order.status === "Đã giao" ? "complete" : ""}>Đã giao</span></div><p>Trạng thái vận chuyển được mô phỏng trong phiên bản demo.</p></div>
      <div className="order-card">
        <h2>Sản phẩm</h2>
        {order.items.map((item) => {
          const product = products.find((candidate) => candidate.id === item.productId);
          return product ? <div className="order-detail-row" key={`${item.productId}-${item.size}-${item.color ?? ""}`}><span>{product.name} · {item.color ?? product.color} · {item.size} × {item.quantity}</span><strong>{formatVnd(product.price * item.quantity)}</strong></div> : null;
        })}
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
  const orders = useDemoOrders();
  const order = orders.find((item) => item.id === orderId);
  if (!order) return <div className="empty-state order-not-found"><h1>Không tìm thấy đơn hàng</h1><Link href="/products">Tiếp tục mua sắm</Link></div>;
  return (
    <section className="order-confirmation">
      <div className="confirmation-mark" aria-hidden="true">✓</div>
      <span className="profile-eyebrow">ĐẶT HÀNG DEMO THÀNH CÔNG</span>
      <h1>Cảm ơn bạn đã đặt hàng!</h1>
      <p>Đơn hàng <strong>{order.id}</strong> đã được ghi nhận trên trình duyệt này.</p>
      <p>Tổng đơn hàng: <strong>{formatVnd(order.total)}</strong></p>
      <div className="confirmation-actions"><Link className="pill-button dark" href={`/orders/${encodeURIComponent(order.id)}`}>Theo dõi đơn hàng</Link><Link className="pill-button" href="/products">Tiếp tục mua sắm</Link></div>
      <p className="small muted">Đây là xác nhận demo, chưa có thanh toán hoặc vận chuyển thật.</p>
    </section>
  );
}
