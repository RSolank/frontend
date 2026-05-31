import { routes } from './routes';

const BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  'http://localhost:4000';

// The legacy callers throw / catch a plain object with `status` on it
// (not an Error subclass). We preserve that shape so JS callers under
// src/pages/** keep working; feature batches can migrate to a richer
// error type when they convert.
export type ApiError = {
  error?: string;
  status: number;
  [key: string]: unknown;
};

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
    let err: ApiError;
    try {
      err = (await res.json()) as ApiError;
    } catch {
      err = { error: 'Request failed', status: res.status };
    }
    err.status = res.status;
    throw err;
  }

  if (res.status === 204) return {} as T;
  return (await res.json()) as T;
}
