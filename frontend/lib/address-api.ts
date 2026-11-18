import { API_BASE_URL, authenticatedHeaders, readApiResponse } from "./api";

export interface ShippingAddress {
  _id: string;
  receiver_name: string;
  receiver_phone: string;
  province: string;
  district: string;
  ward: string;
  province_code?: number;
  ward_code?: number;
  address_detail: string;
  is_default: boolean;
}

export type ShippingAddressInput = Pick<ShippingAddress, "receiver_name" | "receiver_phone" | "address_detail"> & {
  province_code: string;
  ward_code: string;
};

export const emptyShippingAddress: ShippingAddressInput = {
  receiver_name: "", receiver_phone: "", address_detail: "", province_code: "", ward_code: "",
};

export type LocationOption = { code: number; name: string };

export async function getAddressLocations(provinceCode?: string, signal?: AbortSignal) {
  const path = provinceCode ? `/${encodeURIComponent(provinceCode)}/wards` : "";
  const response = await fetch(`${API_BASE_URL}/addresses/locations${path}`, { signal });
  return readApiResponse<LocationOption[]>(response);
}

export function formatShippingAddress(address: ShippingAddress) {
  return [address.address_detail, address.ward, address.district, address.province].filter(Boolean).join(", ");
}

export async function getShippingAddresses(
  token: string,
): Promise<ShippingAddress[]> {
  if (!token) {
    throw new Error("Vui lòng đăng nhập.");
  }

  const response = await fetch(`${API_BASE_URL}/addresses`, {
    headers: authenticatedHeaders(token),
    cache: "no-store",
  });

  return readApiResponse<ShippingAddress[]>(response);
}

export async function saveShippingAddress(token: string, address: ShippingAddressInput, id?: string) {
  const path = id ? `/addresses/${encodeURIComponent(id)}` : "/addresses";
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: id ? "PATCH" : "POST",
    headers: { ...authenticatedHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(address),
  });
  return readApiResponse<ShippingAddress>(response);
}

export async function setDefaultShippingAddress(token: string, id: string) {
  const response = await fetch(`${API_BASE_URL}/addresses/${encodeURIComponent(id)}/default`, {
    method: "PATCH",
    headers: authenticatedHeaders(token),
  });
  return readApiResponse<ShippingAddress>(response);
}

export async function deleteShippingAddress(token: string, id: string) {
  const response = await fetch(`${API_BASE_URL}/addresses/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: authenticatedHeaders(token),
  });
  if (!response.ok) await readApiResponse(response);
}
