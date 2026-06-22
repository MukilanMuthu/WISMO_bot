// Single client-side gateway to the separated Express API: base URL, bearer token, error envelope.

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const TOKEN_KEY = "wismo_token";

export function getToken() {
  return typeof window !== "undefined" ? window.localStorage.getItem(TOKEN_KEY) : null;
}

export function setToken(token: string) {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  window.localStorage.removeItem(TOKEN_KEY);
}

// Carry the API error code so callers can branch (e.g. distinguish bad credentials from 404).
export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// Attach the bearer token, unwrap the { data } envelope, and bounce to login on 401.
export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_URL}${path}`, { ...options, headers, cache: "no-store" });
  const payload = response.status === 204 ? null : await response.json().catch(() => null);

  if (!response.ok) {
    const code = payload?.error?.code ?? "ERROR";
    const message = payload?.error?.message ?? "Request failed";
    if (response.status === 401 && typeof window !== "undefined") {
      clearToken();
      if (window.location.pathname !== "/") window.location.href = "/";
    }
    throw new ApiError(code, message, response.status);
  }

  return (payload?.data ?? payload) as T;
}
