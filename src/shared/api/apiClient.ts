import {
  sanitizePreferences,
  usePreferencesStore,
} from '../state/preferences.store';

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

// Pulled out so the smoke test can assert exactly the two headers
// implementing the CONTRIBUTING.md §5 contract land on every request.
// Read via getState() — outside the React render path so non-component
// callers (apiFetch is a module-level function) work without hooks.
function preferenceHeaders(): Record<string, string> {
  // Sanitize at the wire boundary — even if the in-memory store has been
  // poisoned (e.g. legacy backend row with the currency *symbol* "₹"
  // instead of the ISO code "INR"), the headers stay ByteString-safe so
  // `fetch()` never throws a `Cannot convert value in record<ByteString…>`.
  // Defaults to USD / UTC for any field that fails the printable-ASCII
  // check. See shared/state/preferences.store.ts:isHeaderSafe for why.
  const { currency, timezone } = sanitizePreferences(
    usePreferencesStore.getState()
  );
  return {
    'x-user-currency': currency,
    'x-user-timezone': timezone,
  };
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
    ...preferenceHeaders(),
    ...((options.headers as Record<string, string> | undefined) ?? {}),
  };

  let res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (
    res.status === 401 &&
    !path.includes('/api/auth/refresh') &&
    !path.includes('/api/auth/login')
  ) {
    const refreshToken = localStorage.getItem('refresh_token');
    if (refreshToken) {
      try {
        const refreshRes = await fetch(`${BASE_URL}/api/auth/refresh`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Refresh-Token': refreshToken,
          },
        });

        if (refreshRes.ok) {
          const tokens = (await refreshRes.json()) as {
            access_token: string;
            refresh_token: string;
          };
          localStorage.setItem('access_token', tokens.access_token);
          localStorage.setItem('refresh_token', tokens.refresh_token);

          headers['Authorization'] = `Bearer ${tokens.access_token}`;
          res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
        } else {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          window.location.href = '/login';
          return undefined as T;
        }
      } catch (err) {
        console.error('Token refresh error:', err);
      }
    }
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
