export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

const TOKEN_KEY = "adzz_token";

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return (
    localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY)
  );
}

/** When `remember` is false, the session ends when the browser tab closes. */
export function setStoredToken(
  token: string | null,
  options?: { remember?: boolean }
) {
  if (typeof window === "undefined") return;
  if (!token) {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    return;
  }
  const remember = options?.remember !== false;
  if (remember) {
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.setItem(TOKEN_KEY, token);
  }
}

const NETWORK_RETRY_ATTEMPTS = 3;
const NETWORK_RETRY_BASE_MS = 350;

export type ApiFetchOptions = {
  /** Abort the request after this many milliseconds (browser `fetch`). */
  timeoutMs?: number;
};

function isLocalApiBase(): boolean {
  return /localhost|127\.0\.0\.1/i.test(API_BASE);
}

function networkFailureHint(path: string, lastErr: unknown): string {
  const timedOut =
    lastErr instanceof DOMException && lastErr.name === "TimeoutError";
  if (timedOut) {
    return `Request to ${API_BASE} timed out. If this keeps happening, the API or reverse proxy may be overloaded or misconfigured. Request: ${path}`;
  }
  if (isLocalApiBase()) {
    return `Cannot reach Adzz API at ${API_BASE}. Start the backend (from the repo: cd backend && npm run dev). Request: ${path}`;
  }
  return `Network error contacting ${API_BASE}. Check your connection and try again. (502/504 from the gateway often shows as a CORS error in the browser because the error page has no Access-Control-Allow-Origin.) Request: ${path}`;
}

function combineAbortSignals(a: AbortSignal, b: AbortSignal): AbortSignal {
  const anyFn = (
    AbortSignal as unknown as { any?: (s: AbortSignal[]) => AbortSignal }
  ).any;
  if (typeof anyFn === "function") {
    return anyFn([a, b]);
  }
  const out = new AbortController();
  const forward = (source: AbortSignal) => {
    const onAbort = () => {
      try {
        out.abort(source.reason);
      } catch {
        out.abort();
      }
    };
    if (source.aborted) onAbort();
    else source.addEventListener("abort", onAbort, { once: true });
  };
  forward(a);
  forward(b);
  return out.signal;
}

function withOptionalTimeout(
  init: RequestInit,
  timeoutMs?: number
): { init: RequestInit; cancelTimeout: () => void } {
  if (
    timeoutMs == null ||
    timeoutMs <= 0 ||
    typeof AbortSignal === "undefined" ||
    typeof AbortSignal.timeout !== "function"
  ) {
    return { init, cancelTimeout: () => {} };
  }
  const timeoutSig = AbortSignal.timeout(timeoutMs);
  const user = init.signal;
  const signal = user ? combineAbortSignals(user, timeoutSig) : timeoutSig;
  return {
    init: { ...init, signal },
    cancelTimeout: () => {},
  };
}

function networkRetryAttemptsForInit(init: RequestInit): number {
  const m = (init.method ?? "GET").toUpperCase();
  if (m === "GET" || m === "HEAD") return NETWORK_RETRY_ATTEMPTS;
  return 1;
}

export async function apiFetch(
  path: string,
  init: RequestInit = {},
  options?: ApiFetchOptions
) {
  const token = getStoredToken();
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const url = `${API_BASE}${path}`;
  const maxAttempts =
    options?.timeoutMs != null && options.timeoutMs > 0
      ? 1
      : networkRetryAttemptsForInit(init);
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const { init: timedInit, cancelTimeout } = withOptionalTimeout(
      { ...init, headers },
      options?.timeoutMs
    );
    try {
      return await fetch(url, {
        ...timedInit,
        headers,
        credentials: init.credentials ?? "include",
      });
    } catch (e) {
      lastErr = e;
      cancelTimeout();
      if (attempt < maxAttempts) {
        await new Promise((r) =>
          setTimeout(r, NETWORK_RETRY_BASE_MS * attempt)
        );
        continue;
      }
    }
  }
  const hint = networkFailureHint(path, lastErr);
  console.error(hint, lastErr);
  return new Response(JSON.stringify({ error: hint }), {
    status: 503,
    headers: { "Content-Type": "application/json" },
  });
}

/** Unauthenticated JSON POST (login, signup, password reset). */
export async function authPublicPost<T>(
  path: string,
  body: unknown
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
    credentials: "include",
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error("Invalid JSON from server");
  }
  if (!res.ok) {
    const err = (data as { error?: string })?.error ?? res.statusText;
    throw new Error(err);
  }
  return data as T;
}
