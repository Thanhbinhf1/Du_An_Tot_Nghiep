import { useEffect, useState, type FormEvent } from "react";
import { resolveProductImage } from "@/lib/api";
import type { AdminRequest } from "./ProductVariantsManager";

type ProductImage = { _id: string; image_url: string; display_order: number; is_primary: boolean };

export default function ProductImagesManager({ productId, request }: { productId: string; request: AdminRequest }) {
  const [images, setImages] = useState<ProductImage[]>();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const path = `/products/${productId}/images`;

  useEffect(() => {
    const controller = new AbortController();
    request<ProductImage[]>(path, { signal: controller.signal })
      .then((data) => { if (!controller.signal.aborted) setImages(data); })
      .catch((cause) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Không thể tải ảnh."); });
    return () => controller.abort();
  }, [path, request]);

  async function mutate(action: () => Promise<void>) {
    if (!images || busy) return;
    setBusy(true);
    setError("");
    try {
      await action();
      setImages(await request<ProductImage[]>(path));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể cập nhật ảnh.");
    } finally {
      setBusy(false);
    }
  }

  function addImage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const file = new FormData(form).get("image");
    void mutate(async () => {
      let imageUrl = url.trim();
      if (!imageUrl && file instanceof File && file.size) {
        const data = new FormData();
        data.set("image", file);
        imageUrl = (await request<{ url: string }>("/admin/uploads", { method: "POST", body: data })).url;
        setUrl(imageUrl);
      }
      if (!imageUrl) throw new Error("Chọn tệp hoặc nhập đường dẫn ảnh.");
      const displayOrder = (images ?? []).reduce((last, image) => Math.max(last, image.display_order), 0) + 1;
      await request(path, { method: "POST", body: JSON.stringify({
        image_url: imageUrl, display_order: displayOrder, is_primary: !images?.length,
      }) });
      form.reset();
      setUrl("");
    });
  }

  return (
    <div className="admin-panel">
      <h2>Ảnh sản phẩm</h2>
      {error && <p className="admin-alert" role="alert">{error}</p>}
      {!images && !error && <p role="status">Đang tải ảnh...</p>}
      {images?.map((image) => (
        <div key={image._id} className="admin-actions">
          <a href={resolveProductImage(image.image_url)} target="_blank" rel="noreferrer">Ảnh {image.display_order}</a>
          {image.is_primary ? <span>Ảnh chính</span> : (
            <button type="button" disabled={busy} onClick={() => void mutate(async () => {
              await request(`${path}/${image._id}`, { method: "PATCH", body: JSON.stringify({ is_primary: true }) });
            })}>Đặt làm ảnh chính</button>
          )}
          <button type="button" disabled={busy} className="danger" onClick={() => {
            if (window.confirm("Xóa ảnh này khỏi sản phẩm?")) void mutate(async () => {
              await request(`${path}/${image._id}`, { method: "DELETE" });
            });
          }}>Xóa ảnh</button>
        </div>
      ))}
      <form onSubmit={addImage}>
        <fieldset className="admin-form variant-fieldset" disabled={busy || !images}>
          <legend>Thêm ảnh</legend>
          <label>Tệp JPG, PNG hoặc WEBP, tối đa 5 MB<input name="image" type="file" accept="image/jpeg,image/png,image/webp" /></label>
          <label>Đường dẫn ảnh<input value={url} onChange={(event) => setUrl(event.target.value)} /></label>
          <div className="admin-actions"><button className="admin-button">Thêm ảnh</button></div>
        </fieldset>
      </form>
    </div>
  );
}
