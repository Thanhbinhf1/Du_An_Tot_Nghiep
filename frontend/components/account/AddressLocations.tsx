"use client";

import { useEffect, useState } from "react";
import { getAddressLocations, type LocationOption } from "@/lib/address-api";

export default function AddressLocations({ province, ward, onChange, disabled }: {
  province: string;
  ward: string;
  onChange: (province: string, ward: string) => void;
  disabled?: boolean;
}) {
  const [provinces, setProvinces] = useState<LocationOption[]>();
  const [wardResult, setWardResult] = useState<{ province: string; data: LocationOption[] }>();
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const wards = wardResult?.province === province ? wardResult.data : undefined;

  useEffect(() => {
    const controller = new AbortController();
    getAddressLocations(undefined, controller.signal)
      .then((data) => { if (!controller.signal.aborted) setProvinces(data); })
      .catch(() => { if (!controller.signal.aborted) setError("Không tải được danh sách tỉnh/thành."); });
    return () => controller.abort();
  }, [revision]);

  useEffect(() => {
    if (!province) return;
    const controller = new AbortController();
    getAddressLocations(province, controller.signal)
      .then((data) => { if (!controller.signal.aborted) setWardResult({ province, data }); })
      .catch(() => { if (!controller.signal.aborted) setError("Không tải được danh sách phường/xã."); });
    return () => controller.abort();
  }, [province, revision]);

  return (
    <>
      <label className="form-field">
        Tỉnh / Thành phố
        <select required value={province} disabled={disabled} onChange={(event) => {
          setError("");
          onChange(event.target.value, "");
        }}>
          <option value="">{provinces ? "Chọn tỉnh/thành" : "Đang tải tỉnh/thành…"}</option>
          {provinces?.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
        </select>
      </label>
      <label className="form-field">
        Phường / Xã / Đặc khu
        <select required value={wards ? ward : ""} disabled={disabled || !wards}
          onChange={(event) => onChange(province, event.target.value)}>
          <option value="">{!province ? "Chọn tỉnh/thành trước" : wards ? "Chọn phường/xã" : "Đang tải phường/xã…"}</option>
          {wards?.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
        </select>
      </label>
      {error && <p role="alert">{error} <button type="button" className="text-button"
        onClick={() => { setError(""); setRevision((value) => value + 1); }}>Tải lại</button></p>}
    </>
  );
}
