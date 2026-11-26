"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import OrderSummary from "@/components/cart/OrderSummary";
import ProductCard from "@/components/product/ProductCard";
import { formatVnd } from "@/data/products";
import { useDemoAuth } from "@/lib/demo-auth";
import { useCatalogProducts } from "@/lib/useCatalogProducts";
import {
  getBackendCart,
  updateBackendCartItem,
  deleteBackendCartItem,
  clearBackendCart,
  type BackendCart,
} from "@/lib/cart-api";

import "./cart.css";

export default function CartPage() {
  const { token, isHydrated } = useDemoAuth();
  if (!isHydrated) {
    return (
      <div className="container">
        <p>Đang kiểm tra đăng nhập...</p>
      </div>
    );
  }
  if (!token) {
    return (
      <div className="container checkout-empty">
        <h1 className="page-title">Giỏ hàng</h1>
        <p>Vui lòng đăng nhập để xem giỏ hàng.</p>
        <Link href="/dang-nhap" className="pill-button dark">
          Đăng nhập
        </Link>
      </div>
    );
  }
  return <CartContent key={token} token={token} />;
}

function CartContent({ token }: { token: string }) {
  const { products } = useCatalogProducts();

  const [cart, setCart] = useState<BackendCart | null>(null);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState("");
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let active = true;

    getBackendCart(token)
      .then((data) => {
        if (!active) return;
        setCart(data);
        setError("");
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : "Không thể tải giỏ hàng.");
      });

    return () => {
      active = false;
    };
  }, [token, retryCount]);

  async function changeQuantity(itemId: string, nextQuantity: number) {
    if (!token || updatingId) return;

    setUpdatingId(itemId);
    setError("");

    try {
      if (nextQuantity <= 0) {
        await deleteBackendCartItem(itemId, token);
      } else {
        await updateBackendCartItem(itemId, nextQuantity, token);
      }

      // Đọc lại dữ liệu mới nhất từ MongoDB.
      const updatedCart = await getBackendCart(token);
      setCart(updatedCart);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể cập nhật giỏ hàng.");
    } finally {
      setUpdatingId("");
    }
  }

  async function handleClearAll() {
    if (!token || updatingId) return;
    setUpdatingId("clear-all");
    setError("");
    try {
      await clearBackendCart(token);
      const updatedCart = await getBackendCart(token);
      setCart(updatedCart);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể xóa toàn bộ giỏ hàng.");
    } finally {
      setUpdatingId("");
    }
  }

  if (!cart && !error) {
    return (
      <div className="container">
        <p role="status">Đang tải giỏ hàng...</p>
      </div>
    );
  }

  const items = cart?.items ?? [];

  return (
    <div className="container shopping-cart">
      <nav className="breadcrumb store-purchase-path" aria-label="Vị trí trong cửa hàng">
        <Link href="/products">Cửa hàng</Link> <span aria-hidden="true">/</span> <span aria-current="page">Giỏ hàng</span>
      </nav>
      <div className="cart-header-row">
        <h1 className="page-title">Giỏ hàng{cart && ` (${cart.total_quantity} sản phẩm)`}</h1>
        {items.length > 0 && (
          <button
            type="button"
            className="text-button cart-clear-btn"
            disabled={updatingId !== ""}
            onClick={() => void handleClearAll()}
          >
            Xóa toàn bộ giỏ hàng
          </button>
        )}
      </div>

      {error && (
        <div className="cart-error-banner" role="alert">
          <p>{error}</p>
          <button
            type="button"
            className="pill-button small-pill"
            onClick={() => setRetryCount((prev) => prev + 1)}
          >
            Thử lại
          </button>
        </div>
      )}

      {items.length === 0 ? !error && (
        <div className="empty-state cart-empty">
          <h2>Giỏ hàng của bạn đang trống</h2>
          <p>Khám phá sản phẩm mới và chọn món đồ yêu thích tại VSC_BAPD.</p>
          <Link className="pill-button dark" href="/products">
            Tiếp tục mua sắm
          </Link>
        </div>
      ) : (
        <div className="two-column">
          <section>
            {items.map((item) => {
              const variant = item.product_variant_id;

              const productId =
                typeof variant?.product_id === "string"
                  ? variant.product_id
                  : variant?.product_id
                    ? String(variant.product_id)
                    : "";

              const product = products.find((candidate) => candidate.id === productId);

              const itemName = product?.name ?? variant?.sku ?? "Sản phẩm";
              const disabled = updatingId !== "";
              const isDiscounted =
                variant && variant.sale_price != null && variant.sale_price < variant.price;
              const stockRemaining = variant?.stock_quantity ?? 0;

              return (
                <article className="cart-item" key={item._id}>
                  {product ? (
                    <Link href={`/product/${product.id}`}>
                      {product.image ? (
                        <img src={product.image} alt={product.name} />
                      ) : (
                        product.name
                      )}
                    </Link>
                  ) : (
                    <div className="cart-item-no-image">
                      <span>Chưa có ảnh sản phẩm</span>
                    </div>
                  )}

                  <div className="cart-item-details">
                    {product ? (
                      <Link href={`/product/${product.id}`}>
                        <strong>{itemName}</strong>
                      </Link>
                    ) : (
                      <strong>{itemName}</strong>
                    )}

                    {variant?.sku && <p className="product-meta">Mã SKU: {variant.sku}</p>}

                    <p className="product-meta">Màu sắc: {variant?.color ?? "Không rõ"}</p>

                    <p className="product-meta">Kích cỡ: {variant?.size ?? "Không rõ"}</p>

                    <div className="cart-item-unit-price">
                      <span className="price">{formatVnd(item.price)}</span>
                      {isDiscounted && variant && (
                        <del className="price-original">{formatVnd(variant.price)}</del>
                      )}
                    </div>

                    {variant && (
                      <p
                        className={`cart-stock-note ${
                          stockRemaining <= 0
                            ? "out"
                            : stockRemaining <= 5
                              ? "low"
                              : "ok"
                        }`}
                      >
                        {stockRemaining <= 0
                          ? "Biến thể này đã hết hàng"
                          : stockRemaining <= 5
                            ? `Sắp hết hàng (còn ${stockRemaining} SP)`
                            : `Còn ${stockRemaining} sản phẩm trong kho`}
                      </p>
                    )}

                    <div className="cart-item-controls">
                      <div className="quantity">
                        <button
                          type="button"
                          aria-label="Giảm số lượng"
                          disabled={disabled}
                          onClick={() => changeQuantity(item._id, item.quantity - 1)}
                        >
                          −
                        </button>

                        <span>{item.quantity}</span>

                        <button
                          type="button"
                          aria-label="Tăng số lượng"
                          disabled={
                            disabled ||
                            !variant ||
                            !variant.status ||
                            item.quantity >= variant.stock_quantity
                          }
                          onClick={() => changeQuantity(item._id, item.quantity + 1)}
                        >
                          +
                        </button>
                      </div>

                      <button
                        className="text-button cart-remove-btn"
                        type="button"
                        disabled={disabled}
                        onClick={() => changeQuantity(item._id, 0)}
                      >
                        Xóa
                      </button>
                    </div>
                  </div>

                  <div className="item-price">
                    <span className="small muted">Thành tiền</span>
                    <strong>{formatVnd(item.subtotal)}</strong>
                  </div>
                </article>
              );
            })}

            <p className="small muted" style={{ marginTop: 14 }}>
              Giá và tồn kho sẽ được kiểm tra lại khi đặt hàng.
            </p>
          </section>

          <div>
            <OrderSummary
              total={cart?.total_price ?? 0}
              itemCount={cart?.total_quantity ?? 0}
            />
          </div>
        </div>
      )}

      {items.length > 0 && (
        <>
          <section className="recommendation-section">
            <h2 className="section-title">Có thể bạn sẽ thích</h2>

            <div className="product-grid">
              {products.slice(0, 4).map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </section>

          <p style={{ textAlign: "center", marginTop: 32 }}>
            <Link className="pill-button" href="/products">
              Tiếp tục mua sắm
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
