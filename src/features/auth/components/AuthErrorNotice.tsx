import {
  formatRetryAfter,
  useRetryCountdown,
} from '../../../shared/hooks/useRetryCountdown';

interface AuthErrorNoticeProps {
  // Plain error message to render when there's no rate-limit /
  // device-block context (the common case — wrong password, etc.).
  error: string | null;
  // Seconds until the next attempt is accepted. When non-null, the
  // notice live-ticks down via `useRetryCountdown` and replaces the
  // plain error message with the countdown copy. Null clears the
  // notice entirely (alongside `error === null`).
  retryAfterSeconds: number | null;
  // Verb the user just attempted (`'login'` / `'registration'` /
  // `'recovery'`). Used in the countdown copy.
  action: string;
}

// Shared error surface for the auth forms (LoginForm / RegisterForm
// / RecoveryFlow). When the backend returns `Retry-After` on a 429
// (auth.rate-limit) or 403 (auth.devices device-block), the notice
// renders a live-ticking "Too many login attempts. Try again in N
// seconds." inline message; otherwise it falls back to the plain
// `form-error` div the forms already used.
//
// Plays the role a global toast would in a larger app — keep it
// here while auth is the only rate-limited surface; promote to
// `shared/components/` once a second feature needs the same shape.
export function AuthErrorNotice({
  error,
  retryAfterSeconds,
  action,
}: AuthErrorNoticeProps) {
  const remaining = useRetryCountdown(retryAfterSeconds);

  if (remaining !== null && remaining > 0) {
    return (
      <div
        className="form-error mb-2"
        role="alert"
        data-testid="auth-rate-limit"
      >
        Too many {action} attempts. Please try again{' '}
        {formatRetryAfter(remaining)}.
      </div>
    );
  }

  if (error) {
    return (
      <div className="form-error mb-2" role="alert">
        {error}
      </div>
    );
  }

  return null;
}
