import { useState } from 'react';

import { useAuthStore } from '../../../shared/state/auth.store';
import { RecoveryFlow } from '../recovery/components/RecoveryFlow';
import { useAuth } from '../state/useAuth';

import { AuthErrorNotice } from './AuthErrorNotice';

interface LoginFormProps {
  // Called after a successful login. Defaults to the standard
  // /dashboard redirect inside useAuth — modal callers override it to
  // close the modal first.
  onSuccess?: () => void;
  // Called when the user clicks the inline "Register" link. Page wrapper
  // navigates to /register; modal wrapper switches to RegisterForm.
  onSwitchToRegister?: () => void;
  // When true the bottom "Register" prompt is suppressed (the modal
  // wrapper renders its own switcher footer instead).
  hideRegisterPrompt?: boolean;
}

// Shared login form body. Mounted by both the LoginPage route and the
// LoginModal on Home — see CONTRIBUTING.md §6 "Modal pattern".
// The form holds no router-specific assumptions: navigation lands in
// useAuth.login(), and the optional `onSuccess` override lets modal
// callers close themselves before/after that navigation.
export function LoginForm({
  onSuccess,
  onSwitchToRegister,
  hideRegisterPrompt = false,
}: LoginFormProps) {
  const { login, error, setError } = useAuth();
  const retryAfterSeconds = useAuthStore((s) => s.retryAfterSeconds);
  const setRetryAfterSeconds = useAuthStore((s) => s.setRetryAfterSeconds);
  const [form, setForm] = useState({ email_id: '', password: '' });
  const [submitting, setSubmitting] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    if (error) setError(null);
    if (retryAfterSeconds !== null) setRetryAfterSeconds(null);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await login(form);
      onSuccess?.();
    } catch {
      // Error already pushed into the store by useAuth.login
    } finally {
      setSubmitting(false);
    }
  }

  if (forgotMode) {
    return (
      <>
        <AuthErrorNotice
          error={error}
          retryAfterSeconds={retryAfterSeconds}
          action="recovery"
        />
        <RecoveryFlow
          onError={setError}
          onExit={() => {
            setForgotMode(false);
            setError(null);
            setRetryAfterSeconds(null);
          }}
        />
      </>
    );
  }

  return (
    <>
      <AuthErrorNotice
        error={error}
        retryAfterSeconds={retryAfterSeconds}
        action="login"
      />
      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label htmlFor="login-email" className="form-label">
            Email <span style={{ color: 'red' }}>*</span>
          </label>
          <input
            id="login-email"
            type="email"
            name="email_id"
            autoComplete="username"
            value={form.email_id}
            onChange={handleChange}
            required
            className="form-input"
          />
        </div>
        <div className="mb-3">
          <label htmlFor="login-password" className="form-label">
            Password <span style={{ color: 'red' }}>*</span>
          </label>
          <input
            id="login-password"
            type="password"
            name="password"
            autoComplete="current-password"
            value={form.password}
            onChange={handleChange}
            required
            className="form-input"
          />
        </div>
        <button type="submit" disabled={submitting} className="btn-primary">
          {submitting ? 'Logging in...' : 'Login'}
        </button>
      </form>
      <button
        type="button"
        onClick={() => {
          setForgotMode(true);
          setError(null);
          setRetryAfterSeconds(null);
        }}
        className="btn-link mt-2"
      >
        Forgot password?
      </button>
      {!hideRegisterPrompt && onSwitchToRegister && (
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
          No account?{' '}
          <button
            type="button"
            onClick={onSwitchToRegister}
            className="btn-link"
          >
            Register
          </button>
        </p>
      )}
    </>
  );
}
