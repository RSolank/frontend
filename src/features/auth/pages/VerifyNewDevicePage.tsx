import { Navigate, useLocation, useNavigate } from 'react-router-dom';

// BE Phase 2.3 — new-device OTP challenge landing. The full UX
// (OTP entry + resend + revoke email link) is queued for Platform
// FE Batch 10 (`auth.new-device-otp`). This page exists in Batch 9
// because the login response polymorphism wiring needs SOMEWHERE
// to route a new-device challenge — silently swallowing it would
// drop the user into a black hole.
//
// Until Batch 10 wires the verify endpoint, this surface explains
// that an OTP was emailed and offers a path back to /login.
interface LocationState {
  pending_token?: string;
  masked_email?: string | null;
}

export function VerifyNewDevicePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const pending = (location.state as LocationState | null) ?? {};

  if (!pending.pending_token) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="mx-auto my-10 max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
      <h1 className="mb-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
        New device verification
      </h1>
      <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
        We&rsquo;ve emailed a one-time code to
        {pending.masked_email ? (
          <>
            {' '}
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {pending.masked_email}
            </span>
          </>
        ) : (
          ' your account address'
        )}
        . Verification entry will land in a follow-up release.
      </p>
      <p className="mb-6 text-xs text-slate-400 dark:text-slate-500">
        If you didn&rsquo;t request this sign-in, use the revoke link
        in the email.
      </p>
      <button
        type="button"
        onClick={() => navigate('/login')}
        className="btn-primary !w-auto"
      >
        Back to sign in
      </button>
    </div>
  );
}
