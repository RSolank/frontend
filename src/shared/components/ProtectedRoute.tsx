import { type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';

import { useAuthStore } from '../state/auth.store';
import { unauthenticatedRedirect } from '../utils/sessionRedirect';

interface ProtectedRouteProps {
  children: ReactNode;
}

// Gates a route on `useAuthStore.user`. When no user is hydrated:
//   - had a token → /login (session-expired path)
//   - no token   → /        (true unauthenticated visit)
// See shared/utils/sessionRedirect.ts for the contract.
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-8 text-sm text-slate-500 dark:text-slate-400">
        Loading…
      </div>
    );
  }

  if (!user) {
    return <Navigate to={unauthenticatedRedirect()} replace />;
  }

  return <>{children}</>;
}
