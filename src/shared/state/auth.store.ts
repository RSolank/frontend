import { create } from 'zustand';

// Replaces the old src/state/AuthContext.jsx. Holds the authenticated
// user, the system constants the legacy pages still read, and the boot
// loading flag. Login/logout/refresh actions live in
// features/auth/state/useAuth.ts so they can compose useNavigate +
// mutations (which need hooks). The bare store sits in shared/ because
// shared/components/ProtectedRoute.tsx subscribes to it — same
// rationale as shared/state/preferences.store.ts.

export interface AuthUser {
  user_id: number;
  email_id: string;
  first_name?: string;
  last_name?: string;
  // BE T-admin A1 (`2c47fa9`) — authorization role surfaced on /me so
  // the FE admin gate reads it sync from the store instead of probing
  // /admin/ping. Optional only for back-compat with older fixtures;
  // current BE always populates it ('user' default, 'admin' for the
  // SYSTEM bootstrap + env-bootstrap-promoted accounts).
  role?: 'user' | 'admin' | string;
  [key: string]: unknown;
}

export interface SystemConstants {
  TOTAL_TAG_ID: number;
  MISCELLANEOUS_TAG_ID: number;
  CONSUMPTION_TAX_TAG_ID: number;
  TAXABLE_TXN_TYPES: string[];
  VALID_TAG_TYPES: string[];
  VALID_TXN_TYPES: string[];
  RELATIONSHIP_TYPES: string[];
  SYSTEM_USER_ID?: number | null;
}

export interface AuthState {
  user: AuthUser | null;
  constants: SystemConstants | null;
  loading: boolean;
  error: string | null;
  // Seconds until the next auth attempt is accepted. Populated by
  // `useAuth.login` / `register` / `recovery` when the backend
  // returns a `Retry-After` header on a 429 (auth.rate-limit) or
  // 403 (auth.devices device-block). Forms render the live
  // countdown via `useRetryCountdown(retryAfterSeconds)`.
  retryAfterSeconds: number | null;
  setUser: (user: AuthUser | null) => void;
  setConstants: (constants: SystemConstants | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setRetryAfterSeconds: (seconds: number | null) => void;
  reset: () => void;
}

const initial = {
  user: null as AuthUser | null,
  constants: null as SystemConstants | null,
  loading: true,
  error: null as string | null,
  retryAfterSeconds: null as number | null,
};

export const useAuthStore = create<AuthState>((set) => ({
  ...initial,
  setUser: (user) => set({ user }),
  setConstants: (constants) => set({ constants }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setRetryAfterSeconds: (retryAfterSeconds) => set({ retryAfterSeconds }),
  reset: () => set({ ...initial, loading: false }),
}));
