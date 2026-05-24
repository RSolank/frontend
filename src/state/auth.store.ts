import { create } from 'zustand';

// Skeleton — replaces AuthContext.jsx in Batch 2 once login/logout/refresh
// mutations + token persistence land. For now it just owns the `user`
// slot so the Batch 0 smoke test can prove Zustand is wired correctly.
// Moves to src/features/auth/state/ during Batch 2.

export interface AuthUser {
  id: string;
  email: string;
  [key: string]: unknown;
}

export interface AuthState {
  user: AuthUser | null;
  setUser: (user: AuthUser | null) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  reset: () => set({ user: null }),
}));
