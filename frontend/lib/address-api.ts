import { API_BASE_URL, authenticatedHeaders, readApiResponse } from "./api";

export interface ShippingAddress {
  _id: string;
  receiver_name: string;
  receiver_phone: string;
  province: string;
  district: string;
  ward: string;
  address_detail: string;
  is_default: boolean;
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
