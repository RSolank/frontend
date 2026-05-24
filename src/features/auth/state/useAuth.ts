import { useNavigate } from 'react-router-dom';

import { apiFetch } from '../../../shared/api/apiClient';
import {
  PREFERENCES_DEFAULTS,
  usePreferencesStore,
} from '../../../shared/state/preferences.store';
import {
  loginRequest,
  logoutRequest,
  registerRequest,
  type TokenResponse,
} from '../api/mutations';
import { useAuthStore, type AuthUser } from '../../../shared/state/auth.store';
import { fetchCurrentUser, fetchUserPreferences } from '../api/queries';
import type { LoginInput, RegisterPayload } from '../api/schemas';

interface ApiErrorShape {
  status?: number;
  detail?: string | { msg?: string; loc?: (string | number)[] }[];
  error?: string;
}

function persistTokens(data: TokenResponse) {
  localStorage.setItem('access_token', data.access_token);
  localStorage.setItem('refresh_token', data.refresh_token);
}

function clearTokens() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
}

// Hydrate `usePreferencesStore` from `/api/users/preferences`. Best-effort:
// a failure (404 / network / unauthorized) leaves the store at whatever
// values it already had — the headers still go on the wire, just with
// USD/UTC defaults if nothing was set. See CONTRIBUTING.md §5.
export async function hydratePreferences(): Promise<void> {
  try {
    const prefs = await fetchUserPreferences();
    usePreferencesStore.getState().setPreferences({
      currency: prefs.currency ?? PREFERENCES_DEFAULTS.currency,
      country: prefs.country ?? PREFERENCES_DEFAULTS.country,
      timezone: prefs.timezone ?? PREFERENCES_DEFAULTS.timezone,
    });
  } catch (err) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn('hydratePreferences failed', err);
    }
  }
}

// Imperative refresh: fetch `/api/users/me` + `/api/metadata/constants`
// into the store. Used by AuthInit on mount and after login so the rest
// of the app sees the authenticated user immediately.
export async function refreshAuthUser(): Promise<void> {
  const token = localStorage.getItem('access_token');
  const store = useAuthStore.getState();
  if (!token) {
    store.setLoading(false);
    return;
  }
  try {
    const [userData, constantsData] = await Promise.all([
      fetchCurrentUser(),
      apiFetch<unknown>('/api/metadata/constants').catch(() => null),
    ]);
    store.setUser((userData.user as AuthUser) ?? null);
    store.setConstants(constantsData as never);
  } catch (err) {
    const e = err as ApiErrorShape;
    if (e.status === 401) {
      store.setUser(null);
    }
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.error('refreshAuthUser failed', err);
    }
  } finally {
    store.setLoading(false);
  }
}

// Compatibility hook — drop-in replacement for the old useAuth(). Returns
// the same shape (user, constants, loading, error, setError, register,
// login, logout, refreshUser). Legacy pages keep working unchanged
// (modulo the import path) until their own feature batch rewrites them.
export function useAuth() {
  const navigate = useNavigate();

  const user = useAuthStore((s) => s.user);
  const constants = useAuthStore((s) => s.constants);
  const loading = useAuthStore((s) => s.loading);
  const error = useAuthStore((s) => s.error);
  const setError = useAuthStore((s) => s.setError);

  async function login(input: LoginInput): Promise<void> {
    setError(null);
    try {
      const data = await loginRequest(input);
      persistTokens(data);
      await Promise.all([refreshAuthUser(), hydratePreferences()]);
      navigate('/dashboard');
    } catch (err) {
      const e = err as ApiErrorShape;
      setError(typeof e.detail === 'string' ? e.detail : 'Login failed');
      throw err;
    }
  }

  async function register(payload: RegisterPayload): Promise<void> {
    setError(null);
    try {
      const data = await registerRequest(payload);
      persistTokens(data);
      useAuthStore.getState().setUser({
        user_id: data.user_id ?? 0,
        email_id: data.email_id ?? payload.email_id,
        first_name: data.first_name ?? payload.first_name,
        last_name: data.last_name ?? payload.last_name,
      });
      // Hydrate prefs and constants in parallel for the post-register
      // landing on /dashboard. Best-effort.
      await Promise.all([refreshAuthUser(), hydratePreferences()]);
      navigate('/dashboard');
    } catch (err) {
      const e = err as ApiErrorShape;
      const msg =
        Array.isArray(e.detail)
          ? e.detail.map((d) => d.msg || d.loc?.join('.')).join(', ')
          : (e.detail as string | undefined) ||
            e.error ||
            'Registration failed';
      setError(msg);
      throw err;
    }
  }

  async function logout(): Promise<void> {
    try {
      await logoutRequest();
    } catch (err) {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.error('logout request failed', err);
      }
    } finally {
      clearTokens();
      useAuthStore.getState().reset();
      usePreferencesStore.getState().reset();
      navigate('/login');
    }
  }

  return {
    user,
    constants,
    loading,
    error,
    setError,
    login,
    register,
    logout,
    refreshUser: refreshAuthUser,
  };
}
