import { Navigate, useNavigate } from 'react-router-dom';

import { LoginForm } from '../components/LoginForm';
import { useAuth } from '../state/useAuth';

// Thin page wrapper around <LoginForm />. The form body is shared with
// the LoginModal on Home — see CONTRIBUTING.md §6 "Modal pattern" for
// the hybrid-auth rationale. The form itself renders the "No account?
// Register" prompt; no extra footer is needed here.
export function LoginPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="mx-auto my-12 max-w-md p-8 text-center text-sm text-slate-500 dark:text-slate-400">
        Loading...
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="mx-auto my-10 max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
      <h1 className="mb-4 text-2xl font-bold text-slate-900 dark:text-slate-100">
        Login
      </h1>
      <LoginForm onSwitchToRegister={() => navigate('/register')} />
    </div>
  );
}
