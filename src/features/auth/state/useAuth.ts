import { useNavigate } from 'react-router-dom';

import { apiFetch } from '../../../shared/api/apiClient';
import { routes } from '../../../shared/api/routes';
import { useAuthStore, type AuthUser } from '../../../shared/state/auth.store';
import { getLandingRoute } from '../../../shared/state/landingRoute.store';
import { usePreferencesStore } from '../../../shared/state/preferences.store';
import { hydratePreferences } from '../../users/api/preferences';
import { fetchCurrentUser } from '../../users/api/queries';
import {
  isNewDeviceChallenge,
  isTwoFactorChallenge,
  loginRequest,
  logoutRequest,
  registerRequest,
  type TokenResponse,
} from '../api/mutations';
import { verifyNewDeviceRequest } from '../api/newDevice';
import type { LoginInput, RegisterPayload } from '../api/schemas';
import { loginVerifyTwoFactorRequest } from '../api/twoFactor';

interface ApiErrorShape {
  status?: number;
  detail?: string | { msg?: string; loc?: (string | number)[] }[];
  error?: string;
  retryAfterSeconds?: number;
}

// Translates the `Retry-After`-carrying error envelope into a
// concrete inline message. Lives here (not in apiClient) because the
// copy depends on whether the user is on the login form, the
// register form, or the recovery flow — apiClient stays UX-agnostic.
function rateLimitMessage(seconds: number, action: string): string {
  return `Too many ${action} attempts. Please try again in ${formatRetrySeconds(seconds)}.`;
}

function formatRetrySeconds(seconds: number): string {
  if (seconds <= 1) return '1 second';
  if (seconds < 60) return `${seconds} seconds`;
  const minutes = Math.ceil(seconds / 60);
  return minutes === 1 ? '1 minute' : `${minutes} minutes`;
}

// Pulls the Retry-After signal into the auth store + crafts the
// inline message. Returns the seconds so the caller can also let
// the form-level countdown hook live-tick.
function applyRetryAfter(
  e: ApiErrorShape,
  action: string,
  setError: (msg: string | null) => void
): number | null {
  const seconds = e.retryAfterSeconds;
  if (typeof seconds !== 'number' || seconds <= 0) return null;
  setError(rateLimitMessage(seconds, action));
  useAuthStore.getState().setRetryAfterSeconds(seconds);
  return seconds;
}

function persistTokens(data: TokenResponse) {
  localStorage.setItem('access_token', data.access_token);
  localStorage.setItem('refresh_token', data.refresh_token);
}

function clearTokens() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
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
      apiFetch<unknown>(routes.metadata.constants()).catch(() => null),
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
    useAuthStore.getState().setRetryAfterSeconds(null);
    try {
      const data = await loginRequest(input);
      // BE Phase 2.7 — login can return three shapes (TokenResponse
      // OR a pending-token challenge). The challenges arrive as 200s
      // so we discriminate on `status` before persisting tokens.
      if (isTwoFactorChallenge(data)) {
        navigate('/verify/2fa', {
          state: { pending_token: data.pending_token },
        });
        return;
      }
      if (isNewDeviceChallenge(data)) {
        // BE Phase 2.3 — new-device OTP flow. FE wiring is queued for
        // Platform FE Batch 10; route to a placeholder for now so a
        // 2FA-disabled user on an unknown device sees a clear next
        // step instead of a silent token-persist failure.
        navigate('/verify/new-device', {
          state: {
            pending_token: data.pending_token,
            masked_email: data.masked_email,
          },
        });
        return;
      }
      persistTokens(data);
      await Promise.all([refreshAuthUser(), hydratePreferences()]);
      // Honor the user's `useLandingRouteStore` preference (frontend-
      // only Zustand, /account/accessibility). Defaults to '/dashboard'
      // for first-time / unset visitors.
      navigate(getLandingRoute());
    } catch (err) {
      const e = err as ApiErrorShape;
      if (applyRetryAfter(e, 'login', setError) === null) {
        setError(typeof e.detail === 'string' ? e.detail : 'Login failed');
      }
      throw err;
    }
  }

  // BE Phase 2.7 — finishes a 2FA-gated login. The pending_token comes
  // from the challenge response (stashed in `location.state` by
  // `login()`); `code` is the user-entered 6-digit TOTP or 8-char
  // backup code. Returns a normal TokenResponse, which we persist +
  // route on identically to a no-2FA login.
  async function loginVerify2fa(
    pending_token: string,
    code: string
  ): Promise<void> {
    setError(null);
    useAuthStore.getState().setRetryAfterSeconds(null);
    try {
      const data = await loginVerifyTwoFactorRequest(pending_token, code);
      persistTokens(data);
      await Promise.all([refreshAuthUser(), hydratePreferences()]);
      navigate(getLandingRoute());
    } catch (err) {
      const e = err as ApiErrorShape;
      if (applyRetryAfter(e, 'login', setError) === null) {
        setError(
          typeof e.detail === 'string' ? e.detail : 'Verification failed'
        );
      }
      throw err;
    }
  }

  // BE Phase 2.3 — finishes a new-device-gated login. Response is
  // polymorphic: TokenResponse (happy path) OR a 2FA challenge
  // (2FA-enabled user clears device gate first, then owes a TOTP).
  // The 2FA branch routes onward to /verify/2fa with the NEW
  // pending_token; the FE never opens a session until tokens land.
  async function verifyNewDevice(
    pending_token: string,
    otp: string
  ): Promise<void> {
    setError(null);
    useAuthStore.getState().setRetryAfterSeconds(null);
    try {
      const data = await verifyNewDeviceRequest(pending_token, otp);
      if (isTwoFactorChallenge(data)) {
        navigate('/verify/2fa', {
          state: { pending_token: data.pending_token },
        });
        return;
      }
      persistTokens(data);
      await Promise.all([refreshAuthUser(), hydratePreferences()]);
      navigate(getLandingRoute());
    } catch (err) {
      const e = err as ApiErrorShape;
      if (applyRetryAfter(e, 'login', setError) === null) {
        setError(
          typeof e.detail === 'string' ? e.detail : 'Verification failed'
        );
      }
      throw err;
    }
  }

  async function register(payload: RegisterPayload): Promise<void> {
    setError(null);
    useAuthStore.getState().setRetryAfterSeconds(null);
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
      if (applyRetryAfter(e, 'registration', setError) === null) {
        const msg =
          Array.isArray(e.detail)
            ? e.detail.map((d) => d.msg || d.loc?.join('.')).join(', ')
            : (e.detail as string | undefined) ||
              e.error ||
              'Registration failed';
        setError(msg);
      }
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
      // After logout no tokens remain, so the session-redirect contract
      // (shared/utils/sessionRedirect) lands the user on the landing
      // page rather than the login form. They can re-enter via the
      // Sign-In CTA / modal or by typing /login.
      navigate('/');
    }
  }

  return {
    user,
    constants,
    loading,
    error,
    setError,
    login,
    loginVerify2fa,
    verifyNewDevice,
    register,
    logout,
    refreshUser: refreshAuthUser,
  };
}
