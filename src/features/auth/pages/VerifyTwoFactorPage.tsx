import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';

import { useAuthStore } from '../../../shared/state/auth.store';
import { useAuth } from '../state/useAuth';

// BE Phase 2.7 — 2FA challenge landing page. Reached from three
// flows (login, new-device chain-through, recovery reset) once the
// BE returns `{status: "two_factor_required", pending_token}`. The
// pending_token is short-lived; we receive it via `location.state`
// (not the URL — leaking it in history was deemed worse than the
// "open in new tab" trade-off).
//
// The single input accepts EITHER a 6-digit TOTP OR an 8-char base32
// backup code (lenient on case + spaces + hyphens server-side); the
// server distinguishes by length / format.
interface LocationState {
  pending_token?: string;
}

export function VerifyTwoFactorPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { loginVerify2fa, error, setError } = useAuth();
  const user = useAuthStore((s) => s.user);

  const pending = (location.state as LocationState | null) ?? {};
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // If the page is reached without a pending_token (deep link,
  // refresh, or already-signed-in user), bounce back to /login. A
  // signed-in user goes to dashboard because they don't need a
  // verify step.
  if (user) return <Navigate to="/dashboard" replace />;
  if (!pending.pending_token) return <Navigate to="/login" replace />;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!pending.pending_token) return;
    setError(null);
    setSubmitting(true);
    try {
      await loginVerify2fa(pending.pending_token, code.trim());
      // loginVerify2fa navigates on success via the existing
      // landing-route preference path.
    } catch {
      // Error is surfaced via the auth store; reset the field for the
      // next attempt.
      setCode('');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto my-10 max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
      <h1 className="mb-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
        Two-factor verification
      </h1>
      <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
        Enter the 6-digit code from your authenticator app — or one of your
        one-time backup codes if you&rsquo;ve lost access to it.
      </p>
      <form onSubmit={handleSubmit} className="grid gap-3">
        <div>
          <label htmlFor="verify-2fa-code" className="form-label">
            Code <span className="text-danger-600">*</span>
          </label>
          <input
            id="verify-2fa-code"
            type="text"
            inputMode="text"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="123 456 or AB12-CD34"
            required
            className="form-input font-mono tracking-wider"
            data-testid="verify-2fa-code-input"
          />
        </div>
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={submitting || code.trim() === ''}
          className="btn-primary !w-auto"
          data-testid="verify-2fa-submit"
        >
          {submitting ? 'Verifying…' : 'Verify'}
        </button>
        <button
          type="button"
          onClick={() => navigate('/login')}
          className="text-sm text-slate-500 underline-offset-2 hover:underline dark:text-slate-400"
        >
          Back to sign in
        </button>
      </form>
    </div>
  );
}
