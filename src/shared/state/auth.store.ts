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
  setUser: (user: AuthUser | null) => void;
  setConstants: (constants: SystemConstants | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initial = {
  user: null as AuthUser | null,
  constants: null as SystemConstants | null,
  loading: true,
  error: null as string | null,
};

export const useAuthStore = create<AuthState>((set) => ({
  ...initial,
  setUser: (user) => set({ user }),
  setConstants: (constants) => set({ constants }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  reset: () => set({ ...initial, loading: false }),
}));
