"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { formatVnd } from "@/data/products";
import { deleteBackendCartItem, getBackendCart, type BackendCart } from "@/lib/cart-api";
import { useCatalogProducts } from "@/lib/useCatalogProducts";

export default function CartDrawer({ token, onClose }: { token: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (dialog.current && !dialog.current.open) dialog.current.showModal();
  }, []);

  function close() { dialog.current?.close(); }

  return (
    <dialog ref={dialog} className="cart-drawer" aria-labelledby="cart-drawer-title" onClose={onClose}
      onClick={(event) => { if (event.target === event.currentTarget) close(); }}>
      <section className="cart-drawer-content">
        <header className="cart-drawer-heading">
          <h2 id="cart-drawer-title">Giỏ hàng</h2>
          <button type="button" aria-label="Đóng giỏ hàng" onClick={close}>×</button>
        </header>
        {token ? <CartDrawerItems key={token} token={token} close={close} /> : (
          <div className="cart-drawer-body">
            <p>Đăng nhập để xem giỏ hàng của bạn.</p>
            <Link href="/dang-nhap" className="pill-button dark" onClick={close}>Đăng nhập</Link>
          </div>
        )}
      </section>
    </dialog>
  );
}

function CartDrawerItems({ token, close }: { token: string; close: () => void }) {
  const { products, loading: loadingProducts, error: productError } = useCatalogProducts();
  const [cart, setCart] = useState<BackendCart>();
  const [error, setError] = useState("");
  const [removing, setRemoving] = useState("");

  const loadCart = useCallback((signal?: AbortSignal) => getBackendCart(token, signal)
    .then((nextCart) => {
      if (!signal?.aborted) { setCart(nextCart); setError(""); }
    })
    .catch((cause: unknown) => {
      if (!signal?.aborted) setError(cause instanceof Error ? cause.message : "Không thể tải giỏ hàng.");
    }), [token]);

  useEffect(() => {
    const controller = new AbortController();
    void loadCart(controller.signal);
    return () => controller.abort();
  }, [loadCart]);

  async function remove(id: string) {
    if (removing) return;
    setRemoving(id);
    setError("");
    try {
      await deleteBackendCartItem(id, token);
      await loadCart();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể xóa sản phẩm.");
    } finally { setRemoving(""); }
  }

  return (
    <>
      <div className="cart-drawer-body">
        {!cart && !error && <p role="status">Đang tải giỏ hàng…</p>}
        {error && <div role="alert"><p>{error}</p><button type="button" className="text-button" onClick={() => void loadCart()}>Tải lại giỏ hàng</button></div>}
        {cart?.items.length === 0 && <><p>Giỏ hàng của bạn đang trống.</p><Link href="/products" onClick={close} className="pill-button">Tiếp tục mua sắm</Link></>}
        {cart?.items.map((item) => {
          const variant = item.product_variant_id;
          const product = products.find(({ id }) => id === variant?.product_id);
          const name = product?.name || variant?.sku || "Sản phẩm không khả dụng";
          const unavailable = !variant?.status || (!product && !loadingProducts && !productError);
          return (
            <article className="cart-drawer-item" key={item._id}>
              <div className="cart-drawer-image" style={product?.image ? { backgroundImage: `url(${JSON.stringify(product.image)})` } : undefined} aria-hidden="true" />
              <div>
                {product ? <Link href={`/product/${product.id}`} onClick={close}><strong>{name}</strong></Link> : <strong>{name}</strong>}
                {variant && <p>{[variant.color, variant.size, variant.sku].filter(Boolean).join(" · ")}</p>}
                <p>{item.quantity} × {formatVnd(item.price)}</p>
                {unavailable ? <p>Không còn bán</p> : variant.stock_quantity < item.quantity && <p>Số lượng vượt tồn khả dụng</p>}
                <button type="button" className="text-button" aria-label={`Xóa ${name}`} disabled={Boolean(removing)} onClick={() => void remove(item._id)}>
                  {removing === item._id ? "Đang xóa…" : "Xóa"}
                </button>
              </div>
              <strong>{formatVnd(item.subtotal)}</strong>
            </article>
          );
        })}
      </div>
      {cart && cart.items.length > 0 && (
        <footer className="cart-drawer-total">
          <p><span>Tạm tính</span><strong>{formatVnd(cart.total_price)}</strong></p>
          <Link className="pill-button" href="/cart" onClick={close}>Xem giỏ hàng</Link>
          <Link className="pill-button dark" href="/checkout" onClick={close}>Thanh toán</Link>
        </footer>
      )}
    </>
  );
}
