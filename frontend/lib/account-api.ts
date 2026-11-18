import { API_BASE_URL, authenticatedHeaders, readApiResponse } from "./api";

export interface AccountProfile {
  name: string;
  email: string;
}

export async function getAccountProfile(token: string) {
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    headers: authenticatedHeaders(token),
    cache: "no-store",
  });
  return readApiResponse<AccountProfile>(response);
}

export async function updateAccountName(token: string, name: string) {
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    method: "PATCH",
    headers: { ...authenticatedHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  return readApiResponse<AccountProfile>(response);
}

export async function changeAccountPassword(token: string, currentPassword: string, newPassword: string) {
  const response = await fetch(`${API_BASE_URL}/auth/password`, {
    method: "PATCH",
    headers: { ...authenticatedHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  await readApiResponse<{ updated: boolean }>(response);
}
