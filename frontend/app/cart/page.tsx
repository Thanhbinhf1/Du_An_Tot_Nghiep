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
  type BackendCart,
} from "@/lib/cart-api";

import "./cart.css";

export default function CartPage() {
  const { token, isHydrated } = useDemoAuth();
  const { products } = useCatalogProducts();

  const [cart, setCart] = useState<BackendCart | null>(null);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState("");

  useEffect(() => {
    if (!isHydrated || !token) return;

    let active = true;

    getBackendCart(token)
      .then((data) => {
        if (!active) return;
        setCart(data);
        setError("");
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(
          cause instanceof Error ? cause.message : "Không thể tải giỏ hàng.",
        );
      });

    return () => {
      active = false;
    };
  }, [token, isHydrated]);

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
      setError(
        cause instanceof Error ? cause.message : "Không thể cập nhật giỏ hàng.",
      );
    } finally {
      setUpdatingId("");
    }
  }

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

  if (!cart && !error) {
    return (
      <div className="container">
        <p>Đang tải giỏ hàng từ MongoDB...</p>
      </div>
    );
  }

  const items = cart?.items ?? [];

  return (
    <div className="container">
      <h1 className="page-title">Giỏ hàng</h1>

      {error && (
        <p role="alert" style={{ color: "#b42318" }}>
          {error}
        </p>
      )}

      {items.length === 0 ? (
        <div className="empty-state cart-empty">
          <h2>Giỏ hàng của bạn đang trống</h2>
          <p>Khám phá sản phẩm mới và chọn món đồ yêu thích.</p>
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

              const product = products.find(
                (candidate) => candidate.id === productId,
              );

              const itemName = product?.name ?? variant?.sku ?? "Sản phẩm";

              const disabled = updatingId !== "";

              return (
                <article className="cart-item" key={item._id}>
                  {product ? (
                    <Link href={`/product/${product.id}`}>
                      <img src={product.image} alt={product.name} />
                    </Link>
                  ) : (
                    <div>
                      <span>Chưa có ảnh sản phẩm</span>
                    </div>
                  )}

                  <div>
                    <strong>{itemName}</strong>

                    <p className="product-meta">
                      Màu sắc: {variant?.color ?? "Không rõ"}
                    </p>

                    <p className="product-meta">
                      Kích cỡ: {variant?.size ?? "Không rõ"}
                    </p>

                    <div className="price">{formatVnd(item.price)}</div>

                    <div className="quantity">
                      <button
                        type="button"
                        aria-label="Giảm số lượng"
                        disabled={disabled}
                        onClick={() =>
                          changeQuantity(item._id, item.quantity - 1)
                        }
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
                        onClick={() =>
                          changeQuantity(item._id, item.quantity + 1)
                        }
                      >
                        +
                      </button>
                    </div>

                    <p>
                      <button
                        className="text-button"
                        type="button"
                        disabled={disabled}
                        onClick={() => changeQuantity(item._id, 0)}
                      >
                        Xóa
                      </button>
                    </p>
                  </div>

                  <div className="item-price">
                    <strong>{formatVnd(item.subtotal)}</strong>
                  </div>
                </article>
              );
            })}

            <p className="small muted">
              Giá và tồn kho sẽ được kiểm tra lại khi đặt hàng.
            </p>
          </section>

          <div>
            <OrderSummary
              total={cart?.total_price ?? 0}
              itemCount={cart?.total_quantity ?? 0}
            />

            <p className="small muted" role="note">
              Checkout hiện vẫn sử dụng đơn hàng demo. Chưa sử dụng bước thanh
              toán cho giao dịch thật.
            </p>
          </div>
        </div>
      )}

      {items.length > 0 && (
        <>
          <section>
            <h2 className="section-title">Có thể bạn sẽ thích</h2>

            <div className="product-grid">
              {products.slice(0, 3).map((product) => (
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
