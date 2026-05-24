import { type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';

import { useAuth } from '../../state/AuthContext.jsx';

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth() as {
    user: unknown;
    loading: boolean;
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-8 text-sm text-slate-500 dark:text-slate-400">
        Loading…
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
