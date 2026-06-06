import { getDeviceId } from '../utils/deviceId';

import { routes } from './routes';

const BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  'http://localhost:4000';

// The legacy callers throw / catch a plain object with `status` on it
// (not an Error subclass). We preserve that shape so JS callers under
// src/pages/** keep working; feature batches can migrate to a richer
// error type when they convert.
//
// `retryAfterSeconds` is attached by Platform FE Batch 3 whenever the
// response carries a `Retry-After` header on a 429 (auth.rate-limit)
// or 403 (auth.devices device-block). Forms read it via
// `useRetryCountdown(err.retryAfterSeconds)` to render an inline
// "try again in N seconds" message; non-form callers fall through to
// the generic error path.
export type ApiError = {
  error?: string;
  status: number;
  retryAfterSeconds?: number;
  [key: string]: unknown;
};

// Parses a `Retry-After` header into a positive integer of seconds.
// The header may carry either a delta-seconds value (`120`) or an
// HTTP-date (`Wed, 21 Oct 2026 07:28:00 GMT`). Returns `undefined` if
// the header is missing or unparseable so the caller falls through
// to the generic error path.
function parseRetryAfter(header: string | null): number | undefined {
  if (!header) return undefined;
  const trimmed = header.trim();
  if (trimmed === '') return undefined;
  if (/^\d+$/.test(trimmed)) {
    const n = parseInt(trimmed, 10);
    return n > 0 ? n : undefined;
  }
  const stamp = Date.parse(trimmed);
  if (Number.isNaN(stamp)) return undefined;
  const delta = Math.ceil((stamp - Date.now()) / 1000);
  return delta > 0 ? delta : undefined;
}

// Outcome of a 401-triggered refresh attempt:
//   'retried'   — refresh succeeded, `res` is the replayed request's response.
//   'loggedOut' — refresh token was rejected; tokens cleared + redirected to
//                 /login. The caller must abort (return undefined).
//   'skipped'   — no refresh token, or the refresh network call threw. The
//                 caller falls through to normal error handling on the
//                 original 401 response (same as the pre-extraction behaviour).
type RefreshOutcome =
  | { kind: 'retried'; res: Response }
  | { kind: 'loggedOut' }
  | { kind: 'skipped' };

// Pulled out of apiFetch so the 401 path doesn't pile four nesting levels
// onto the request flow. Mutates `headers` in place (Authorization) before
// replaying, mirroring the original inline logic.
async function refreshAndRetry(
  path: string,
  options: RequestInit,
  headers: Record<string, string>
): Promise<RefreshOutcome> {
  const refreshToken = localStorage.getItem('refresh_token');
  if (!refreshToken) return { kind: 'skipped' };

  try {
    const refreshRes = await fetch(`${BASE_URL}${routes.auth.refresh()}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Refresh-Token': refreshToken,
        // Refresh is part of the device-aware lockout surface — the
        // BE's suspicious-refresh path (Phase 1.4) needs X-Device-Id
        // to tell "same browser, expired token" apart from "stolen
        // token replay from a new device".
        'X-Device-Id': getDeviceId(),
      },
    });

    if (!refreshRes.ok) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      window.location.href = '/login';
      return { kind: 'loggedOut' };
    }

    const tokens = (await refreshRes.json()) as {
      access_token: string;
      refresh_token: string;
    };
    localStorage.setItem('access_token', tokens.access_token);
    localStorage.setItem('refresh_token', tokens.refresh_token);

    headers['Authorization'] = `Bearer ${tokens.access_token}`;
    const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
    return { kind: 'retried', res };
  } catch (err) {
    console.error('Token refresh error:', err);
    return { kind: 'skipped' };
  }
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const accessToken = localStorage.getItem('access_token');
  const isFormData =
    typeof FormData !== 'undefined' && options.body instanceof FormData;

  const headers: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    'X-Device-Id': getDeviceId(),
    ...((options.headers as Record<string, string> | undefined) ?? {}),
  };

  let res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (
    res.status === 401 &&
    !path.includes(routes.auth.refresh()) &&
    !path.includes(routes.auth.login())
  ) {
    const outcome = await refreshAndRetry(path, options, headers);
    if (outcome.kind === 'loggedOut') return undefined as T;
    if (outcome.kind === 'retried') res = outcome.res;
  }

  if (!res.ok) {
    const err = await buildApiError(res);
    handleAccountPendingDeletion(err);
    throw err;
  }

  if (res.status === 204) return {} as T;
  return (await res.json()) as T;
}

// BE Phase 2.1 — while an account is in the 14-day soft-delete grace
// window, EVERY authenticated request returns
// `403 {detail: "ACCOUNT_PENDING_DELETION"}`. Hard-logout the tab and
// redirect to /account/cancel-deletion so the user sees the cancel
// flow instead of a cryptic toast. The page handles the no-token
// informational mode in addition to the email-link cancel flow.
function handleAccountPendingDeletion(err: ApiError): void {
  if (err.status !== 403) return;
  if (err.detail !== 'ACCOUNT_PENDING_DELETION') return;
  // Avoid a redirect loop if the cancel-deletion page itself triggers
  // the 403 (it shouldn't — the cancel endpoint is unauthenticated —
  // but be defensive).
  if (typeof window !== 'undefined') {
    if (window.location.pathname.startsWith('/account/cancel-deletion')) {
      return;
    }
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    window.location.href = '/account/cancel-deletion';
  }
}

// Builds the `ApiError` thrown on a non-2xx response. Extracted out
// of `apiFetch` so the function stays under the complexity ceiling
// (CONTRIBUTING.md §3 — ratchet, no suppression). Reads the JSON body
// best-effort, normalises the status, and (on 429/403) decorates the
// error with `retryAfterSeconds` so the auth-form countdown hook can
// surface a live tick.
async function buildApiError(res: Response): Promise<ApiError> {
  let err: ApiError;
  try {
    err = (await res.json()) as ApiError;
  } catch {
    err = { error: 'Request failed', status: res.status };
  }
  err.status = res.status;
  // `Retry-After` is meaningful on both 429 (auth.rate-limit) and
  // 403 (auth.devices device-block). Other statuses with the header
  // are out-of-spec for this project and ignored.
  if (res.status === 429 || res.status === 403) {
    const retryAfter = parseRetryAfter(res.headers.get('Retry-After'));
    if (retryAfter !== undefined) {
      err.retryAfterSeconds = retryAfter;
    }
  }
  return err;
}
