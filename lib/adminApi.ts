import { API_BASE } from "./api";
import { getAdminToken } from "./adminToken";

async function parseAdminResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error("Invalid JSON from admin API");
  }
  if (!res.ok) {
    const err = (data as { error?: string })?.error ?? res.statusText;
    throw new Error(err);
  }
  return data as T;
}

function adminAuthHeaders(): HeadersInit {
  const t = getAdminToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export async function adminGetJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { ...adminAuthHeaders() },
    credentials: "include",
  });
  return parseAdminResponse<T>(res);
}

export async function adminPostJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...adminAuthHeaders() },
    body: JSON.stringify(body ?? {}),
    credentials: "include",
  });
  return parseAdminResponse<T>(res);
}

export async function adminPatchJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...adminAuthHeaders() },
    body: JSON.stringify(body ?? {}),
    credentials: "include",
  });
  return parseAdminResponse<T>(res);
}

export async function adminDeleteJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "DELETE",
    headers: { ...adminAuthHeaders() },
    credentials: "include",
  });
  return parseAdminResponse<T>(res);
}
