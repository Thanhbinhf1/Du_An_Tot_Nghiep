"use client";

import { useEffect, useState, type FormEvent } from "react";
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
};

export default function AdminReportsSettings({
  request,
  currentUserRole,
}: {
  request: AdminRequest;
  currentUserRole?: string;
}) {
  const [config, setConfig] = useState<StoreConfig>();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const isAdmin = currentUserRole === "admin";

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
      setSuccess("Đã lưu thông tin cấu hình F.Style Store thành công.");
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
            <h2>Cấu hình thông tin cửa hàng F.Style Store</h2>
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

      {/* 2. STAFF PERMISSIONS MATRIX */}
      <div className="admin-panel" style={{ marginTop: "24px" }}>
        <div className="admin-panel-heading">
          <div>
            <h2>🛡️ Ma trận phân quyền hệ thống (Admin vs Staff)</h2>
            <p className="admin-muted">
              Đảm bảo an toàn dữ liệu, tính minh bạch và bảo mật thông tin khách hàng.
            </p>
          </div>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Phân hệ nghiệp vụ</th>
                <th>Mô tả chức năng</th>
                <th style={{ textAlign: "center" }}>Nhân viên (Staff)</th>
                <th style={{ textAlign: "center" }}>Quản trị viên (Admin)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Dashboard & Thống kê</strong></td>
                <td>Xem doanh số, biểu đồ doanh thu, top sản phẩm, cảnh báo tồn kho</td>
                <td style={{ textAlign: "center", color: "#10b981" }}>✅ Toàn quyền xem</td>
                <td style={{ textAlign: "center", color: "#10b981" }}>✅ Toàn quyền xem</td>
              </tr>
              <tr>
                <td><strong>Sản phẩm & Biến thể</strong></td>
                <td>Thêm, sửa mô tả, hình ảnh, cập nhật giá, trạng thái đang bán</td>
                <td style={{ textAlign: "center" }}>Chỉ quản trị viên</td>
                <td style={{ textAlign: "center", color: "#10b981" }}>✅ Toàn quyền</td>
              </tr>
              <tr>
                <td><strong>Quản lý tồn kho</strong></td>
                <td>Điều chỉnh số lượng kho hàng, theo dõi SKU sắp hết</td>
                <td style={{ textAlign: "center", color: "#10b981" }}>✅ Cập nhật tồn kho</td>
                <td style={{ textAlign: "center", color: "#10b981" }}>✅ Toàn quyền</td>
              </tr>
              <tr>
                <td><strong>Quản lý đơn hàng</strong></td>
                <td>Duyệt đơn, chuyển trạng thái giao hàng, in hóa đơn xuất kho, hủy đơn</td>
                <td style={{ textAlign: "center", color: "#10b981" }}>✅ Xử lý & In phiếu</td>
                <td style={{ textAlign: "center", color: "#10b981" }}>✅ Toàn quyền</td>
              </tr>
              <tr>
                <td><strong>Quản lý thanh toán</strong></td>
                <td>Xác nhận chuyển khoản, đối soát VNPay, tra cứu mã giao dịch</td>
                <td style={{ textAlign: "center", color: "#10b981" }}>👁️ Tra cứu giao dịch</td>
                <td style={{ textAlign: "center", color: "#10b981" }}>✅ Toàn quyền</td>
              </tr>
              <tr>
                <td><strong>Khách hàng & Phân quyền</strong></td>
                <td>Xem lịch sử mua hàng, nâng/hạ quyền admin/staff, khóa tài khoản</td>
                <td style={{ textAlign: "center", color: "#f59e0b" }}>👁️ Chỉ xem (Không đổi quyền)</td>
                <td style={{ textAlign: "center", color: "#10b981" }}>✅ Đổi vai trò & Khóa</td>
              </tr>
              <tr>
                <td><strong>Mã giảm giá (Coupons)</strong></td>
                <td>Tạo mới, sửa điều kiện, xóa bỏ chiến dịch khuyến mãi</td>
                <td style={{ textAlign: "center", color: "#f59e0b" }}>⚠️ Tạo & sửa (Không xóa)</td>
                <td style={{ textAlign: "center", color: "#10b981" }}>✅ Toàn quyền (Xóa mã)</td>
              </tr>
              <tr>
                <td><strong>Cấu hình cửa hàng</strong></td>
                <td>Tên cửa hàng, hotline, địa chỉ và phí vận chuyển</td>
                <td style={{ textAlign: "center", color: "#ef4444" }}>❌ Không thể sửa</td>
                <td style={{ textAlign: "center", color: "#10b981" }}>✅ Toàn quyền cập nhật</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
