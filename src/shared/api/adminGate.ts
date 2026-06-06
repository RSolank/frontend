import { useAuthStore } from '../state/auth.store';

// Admin-portal access gate. BE T-admin A1 (`2c47fa9`, FE Platform
// Batch 18) surfaces `role` on the `/me` payload that boots into
// `useAuthStore` via `AuthInit` → `refreshAuthUser`. The gate is a
// synchronous read on that store — no network call, no react-query
// cache, no `/admin/ping` probe. Login/logout cycles already remount
// the tree and reset the store, so role state stays in sync naturally.
//
// Lives in `shared/` because the TopNav user dropdown — a
// cross-feature surface — needs to read it, and the dependency rule
// blocks `shared/` from importing `features/`. The hook keeps the
// react-query-shaped return (`{data: boolean, isLoading: boolean}`)
// so existing call sites (TopNav, AdminLandingPage) don't change.
//
// The BE `GET /api/v1/admin/ping` endpoint stays as a no-cost
// liveness/auth probe for ops smoke checks, but no longer drives the
// FE gate.

interface AdminGateResult {
  data: boolean;
  isLoading: boolean;
}

export function useAdminGateQuery(enabled = true): AdminGateResult {
  const role = useAuthStore((s) => s.user?.role);
  const loading = useAuthStore((s) => s.loading);

  if (!enabled) {
    return { data: false, isLoading: false };
  }

  return {
    data: role === 'admin',
    // Boot-time hydration runs `refreshAuthUser` then flips
    // `loading` to false. While loading, callers see `isLoading=true`
    // and gate the admin surface accordingly (matches the prior
    // react-query semantics).
    isLoading: loading,
  };
}
