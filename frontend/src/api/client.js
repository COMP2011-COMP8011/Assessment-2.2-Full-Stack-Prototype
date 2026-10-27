// HTTP client for the TaskParty API.
// The base URL comes from the VITE_API_URL environment variable — never a hardcoded
// localhost — because GitHub Codespaces gives the API a different forwarded URL in every
// codespace. vite.config.js fills VITE_API_URL in automatically when it isn't set.
export const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

const DEFAULT_TIMEOUT_MS = 15_000;

export class ApiError extends Error {
  constructor(message, { status = 0, code = 'ERROR', details } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /** True when the server was never reached (offline, API down, CORS/port problems, timeout). */
  get isNetworkError() {
    return this.status === 0;
  }
}

let authToken = null;
let onUnauthorized = null;

export function setAuthToken(token) {
  authToken = token || null;
}

/** Called with the error when the API rejects our token (e.g. it expired). */
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

export async function apiRequest(path, { method = 'GET', body, signal, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  if (!API_URL) {
    throw new ApiError('VITE_API_URL is not set, so the app does not know where the API is.', { code: 'CONFIG_ERROR' });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException('Request timed out', 'TimeoutError')), timeoutMs);
  const forwardAbort = () => controller.abort(signal.reason);
  signal?.addEventListener('abort', forwardAbort, { once: true });

  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    if (signal?.aborted) throw err; // the caller cancelled: let them ignore it
    const timedOut = controller.signal.reason?.name === 'TimeoutError';
    throw new ApiError(
      timedOut ? 'The server took too long to respond. Try again.' : "Can't reach the TaskParty server. Check your connection and try again.",
      { code: timedOut ? 'TIMEOUT' : 'NETWORK_ERROR' },
    );
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', forwardAbort);
  }

  if (response.status === 204) return null;
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new ApiError(data?.error?.message || `The server answered ${response.status}.`, {
      status: response.status,
      code: data?.error?.code,
      details: data?.error?.details,
    });
    if (response.status === 401 && authToken && onUnauthorized) onUnauthorized(error);
    throw error;
  }
  return data;
}
