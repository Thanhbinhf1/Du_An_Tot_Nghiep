"use client";

import { useEffect, useState, type FormEvent } from "react";
import { getAddressLocations, type LocationOption } from "@/lib/address-api";
import type { AdminRequest } from "./ProductVariantsManager";

type StoreConfig = {
  store_name: string;
  tagline: string;
  hotline: string;
  email: string;
  address: string;
  bank_name: string;
  bank_account_no: string;
  bank_account_name: string;
  free_shipping_threshold: number;
  standard_shipping_fee: number;
  express_shipping_fee: number;
  express_shipping_province_code?: number | null;
  express_shipping_ward_codes?: number[];
};

export default function AdminReportsSettings({
  request,
  currentUserRole,
}: {
  request: AdminRequest;
  currentUserRole?: string;
}) {
  const [config, setConfig] = useState<StoreConfig>();
  const [provinces, setProvinces] = useState<LocationOption[]>([]);
  const [provinceError, setProvinceError] = useState("");
  const [wardResult, setWardResult] = useState<{ province: number; wards: LocationOption[]; error?: string }>();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const isAdmin = currentUserRole === "admin";
  const expressProvince = config?.express_shipping_province_code;

  useEffect(() => {
    let active = true;
    request<StoreConfig>("/admin/settings")
      .then((data) => {
        if (active) {
          setConfig(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : "Không thể tải cấu hình cửa hàng.");
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [request]);

  useEffect(() => {
    const controller = new AbortController();
    getAddressLocations(undefined, controller.signal).then(setProvinces).catch(() => {
      if (!controller.signal.aborted) setProvinceError("Không thể tải danh sách tỉnh/thành.");
    });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!expressProvince) return;
    const controller = new AbortController();
    getAddressLocations(String(expressProvince), controller.signal).then((wards) => {
      if (!controller.signal.aborted) setWardResult({ province: expressProvince, wards });
    }).catch(() => {
      if (!controller.signal.aborted) setWardResult({ province: expressProvince, wards: [], error: "Không thể tải danh sách phường, xã." });
    });
    return () => controller.abort();
  }, [expressProvince]);

  const handleSaveSettings = async (e: FormEvent) => {
    e.preventDefault();
    if (!config || !isAdmin || busy) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await request("/admin/settings", {
        method: "PUT",
        body: JSON.stringify(config),
      });
      setSuccess("Đã lưu cấu hình cửa hàng.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể lưu cấu hình.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-settings-page">
      {/* 1. STORE CONFIGURATION FORM */}
      <div className="admin-panel">
        <div className="admin-panel-heading">
          <div>
            <h2>Thông tin cửa hàng</h2>
            <p className="admin-muted">
              Cập nhật thông tin liên hệ trên cửa hàng, thông tin in hóa đơn và phí giao hàng ở checkout.
            </p>
          </div>
        </div>

        {error && <p className="admin-alert">{error}</p>}
        {success && <p className="admin-success">{success}</p>}

        {!isAdmin && (
          <p className="admin-muted" style={{ padding: "8px 12px", background: "#f3f4f6", borderRadius: "6px" }}>
            ℹ️ Bạn đang xem cấu hình với vai trò <strong>Nhân viên (Staff)</strong> (chế độ chỉ xem). Chỉ Quản trị viên mới có quyền cập nhật cấu hình hệ thống.
          </p>
        )}

        {loading && <p role="status">Đang tải cấu hình...</p>}
        {config && <form onSubmit={handleSaveSettings} className="admin-form">
          <label>
            Tên cửa hàng
            <input
              required
              disabled={!isAdmin || busy}
              value={config.store_name}
              onChange={(e) => setConfig({ ...config, store_name: e.target.value })}
            />
          </label>

          <label>
            Khẩu hiệu (Tagline)
            <input
              required
              disabled={!isAdmin || busy}
              value={config.tagline}
              onChange={(e) => setConfig({ ...config, tagline: e.target.value })}
            />
          </label>

          <label>
            Hotline hỗ trợ CSKH
            <input
              required
              disabled={!isAdmin || busy}
              value={config.hotline}
              onChange={(e) => setConfig({ ...config, hotline: e.target.value })}
            />
          </label>

          <label>
            Email liên hệ
            <input
              type="email"
              required
              disabled={!isAdmin || busy}
              value={config.email}
              onChange={(e) => setConfig({ ...config, email: e.target.value })}
            />
          </label>

          <label className="wide">
            Địa chỉ trụ sở / Showroom
            <input
              required
              disabled={!isAdmin || busy}
              value={config.address}
              onChange={(e) => setConfig({ ...config, address: e.target.value })}
            />
          </label>

          <h3 className="wide" style={{ margin: "16px 0 8px", borderTop: "1px solid #e5e7eb", paddingTop: "16px" }}>
            Thông tin chuyển khoản ngân hàng (BankTransfer)
          </h3>

          {config.bank_name ? (
            <p className="wide">{config.bank_name} · {config.bank_account_no} · {config.bank_account_name}</p>
          ) : <p className="wide">Chưa cấu hình chuyển khoản.</p>}
          <p className="wide admin-muted">Cấu hình tài khoản nhận chuyển khoản trong biến môi trường BANK_* của backend.</p>

          <h3 className="wide" style={{ margin: "16px 0 8px", borderTop: "1px solid #e5e7eb", paddingTop: "16px" }}>
            Chính sách vận chuyển toàn quốc
          </h3>

          <label>
            Ngưỡng miễn phí vận chuyển (VND)
            <input
              type="number"
              min="0"
              required
              disabled={!isAdmin || busy}
              value={config.free_shipping_threshold}
              onChange={(e) =>
                setConfig({ ...config, free_shipping_threshold: Number(e.target.value) })
              }
            />
          </label>

          <label>
            Phí giao hàng tiêu chuẩn (VND)
            <input
              type="number"
              min="0"
              required
              disabled={!isAdmin || busy}
              value={config.standard_shipping_fee}
              onChange={(e) =>
                setConfig({ ...config, standard_shipping_fee: Number(e.target.value) })
              }
            />
          </label>

          <label>
            Tỉnh/thành hỗ trợ giao hỏa tốc
            <select
              disabled={!isAdmin || busy || !provinces.length}
              value={config.express_shipping_province_code ?? ""}
              onChange={(e) => setConfig({ ...config, express_shipping_province_code: e.target.value ? Number(e.target.value) : null, express_shipping_ward_codes: [] })}
            >
              <option value="">Tắt giao hỏa tốc</option>
              {provinces.map(({ code, name }) => <option key={code} value={code}>{name}</option>)}
            </select>
            {provinceError && <span role="alert">{provinceError}</span>}
          </label>

          {expressProvince && <fieldset className="wide" disabled={!isAdmin || busy}>
            <legend>Phường, xã được phục vụ hỏa tốc</legend>
            <p className="admin-muted">Chọn những nơi đã xác nhận có thể giao. Để trống danh sách sẽ tắt hỏa tốc.</p>
            {wardResult?.province !== expressProvince ? <p role="status">Đang tải địa bàn…</p> : wardResult.error ? <p role="alert">{wardResult.error}</p> : (
              <div style={{ maxHeight: 190, overflowY: "auto" }}>
                {wardResult.wards.map(({ code, name }) => {
                  const codes = config.express_shipping_ward_codes ?? [];
                  return <label key={code} style={{ display: "flex", alignItems: "center", gap: 8, padding: 5 }}>
                    <input type="checkbox" checked={codes.includes(code)} onChange={(event) => setConfig({
                      ...config, express_shipping_ward_codes: event.target.checked ? [...codes, code] : codes.filter((value) => value !== code),
                    })} style={{ width: "auto", minHeight: "auto" }} /> {name}
                  </label>;
                })}
              </div>
            )}
          </fieldset>}

          <label>
            Phí giao hàng hỏa tốc (VND)
            <input
              type="number"
              min="0"
              required
              disabled={!isAdmin || busy}
              value={config.express_shipping_fee}
              onChange={(e) =>
                setConfig({ ...config, express_shipping_fee: Number(e.target.value) })
              }
            />
          </label>

          {isAdmin && (
            <div className="admin-actions wide">
              <button type="submit" className="admin-button" disabled={busy || loading}>
                {busy ? "Đang lưu cấu hình..." : "Lưu cài đặt cửa hàng"}
              </button>
            </div>
          )}
        </form>}
      </div>

    </div>
  );
}
