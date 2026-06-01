import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';

import { useAuthStore } from '../../../shared/state/auth.store';
import { resendNewDeviceOtpRequest } from '../api/newDevice';
import { useAuth } from '../state/useAuth';

// BE Phase 2.3 (T-new-device-otp) — emailed-OTP entry for an
// unknown-device login. Reached via `navigate('/verify/new-device',
// { state: { pending_token, masked_email } })` from
// `useAuth.login` when the BE returns the new-device challenge.
//
// Submission delegates to `useAuth.verifyNewDevice`, which:
//   - persists tokens + navigates on TokenResponse (happy path).
//   - chains through to `/verify/2fa` when the BE returns the 2FA
//     challenge (the user has 2FA on; new-device was step 1).
//
// Resend swaps the pending_token in `location.state` with the new
// one the BE returns (prior token is invalidated server-side).
interface LocationState {
  pending_token?: string;
  masked_email?: string | null;
}

interface ApiErrorShape {
  detail?: string;
  error?: string;
  status?: number;
}

function errorMessage(err: unknown, fallback: string): string {
  const e = err as ApiErrorShape;
  return e?.detail || e?.error || fallback;
}

export function VerifyNewDevicePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { verifyNewDevice, error, setError } = useAuth();
  const user = useAuthStore((s) => s.user);

  const stateIn = (location.state as LocationState | null) ?? {};
  const [pendingToken, setPendingToken] = useState(
    stateIn.pending_token ?? ''
  );
  const [maskedEmail, setMaskedEmail] = useState(
    stateIn.masked_email ?? null
  );
  const [otp, setOtp] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendStatus, setResendStatus] = useState<string | null>(null);

  if (user) return <Navigate to="/dashboard" replace />;
  if (!pendingToken) return <Navigate to="/login" replace />;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setResendStatus(null);
    setSubmitting(true);
    try {
      await verifyNewDevice(pendingToken, otp.trim());
      // verifyNewDevice navigates on success — either to the
      // landing route (TokenResponse) or to /verify/2fa (2FA chain).
    } catch {
      // Error surfaces via the auth store; reset OTP for next try.
      setOtp('');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    setError(null);
    setResendStatus(null);
    setResending(true);
    try {
      const res = await resendNewDeviceOtpRequest(pendingToken);
      setPendingToken(res.pending_token);
      setMaskedEmail(res.masked_email ?? maskedEmail);
      setResendStatus('A new code is on its way to your inbox.');
    } catch (err) {
      setError(errorMessage(err, "Couldn't resend the code"));
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="mx-auto my-10 max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
      <h1 className="mb-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
        New device verification
      </h1>
      <p className="mb-1 text-sm text-slate-500 dark:text-slate-400">
        We&rsquo;ve emailed a one-time code
        {maskedEmail ? (
          <>
            {' '}
            to{' '}
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {maskedEmail}
            </span>
          </>
        ) : (
          ''
        )}
        . Enter it below to finish signing in from this device.
      </p>
      <p className="mb-6 text-xs text-slate-400 dark:text-slate-500">
        Didn&rsquo;t request this sign-in? Use the revoke link in the
        email — your account stays safe.
      </p>
      <form onSubmit={handleSubmit} className="grid gap-3">
        <div>
          <label htmlFor="verify-device-otp" className="form-label">
            Code <span className="text-rose-600">*</span>
          </label>
          <input
            id="verify-device-otp"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            placeholder="123456"
            required
            className="form-input font-mono tracking-wider"
            data-testid="verify-device-otp-input"
          />
        </div>
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        {resendStatus && (
          <div
            className="text-sm font-medium text-emerald-600 dark:text-emerald-400"
            role="status"
          >
            {resendStatus}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={submitting || otp.trim() === ''}
            className="btn-primary !w-auto"
            data-testid="verify-device-submit"
          >
            {submitting ? 'Verifying…' : 'Verify'}
          </button>
          <button
            type="button"
            onClick={handleResend}
            disabled={resending || submitting}
            className="text-sm text-indigo-600 underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-60 dark:text-indigo-300"
            data-testid="verify-device-resend"
          >
            {resending ? 'Sending…' : 'Resend code'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="ml-auto text-sm text-slate-500 underline-offset-2 hover:underline dark:text-slate-400"
          >
            Back to sign in
          </button>
        </div>
      </form>
    </div>
  );
}
