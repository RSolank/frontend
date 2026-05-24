import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';

import { RecoveryFlow } from '../recovery/components/RecoveryFlow';
import { useAuth } from '../state/useAuth';

// Page container + button styles remain inline pending the auth-shell visual
// pass; the label + input pair use the shared form-control classes from
// src/index.css so contrast holds in both light and dark mode.

export function LoginPage() {
  const { user, loading, login, error, setError } = useAuth();
  const [form, setForm] = useState({ email_id: '', password: '' });
  const [submitting, setSubmitting] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);

  if (loading) {
    return (
      <div
        style={{
          maxWidth: 400,
          margin: '3rem auto',
          padding: '2rem',
          textAlign: 'center',
        }}
      >
        Loading...
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    if (error) setError(null);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await login(form);
    } catch {
      // Error already pushed into the store by useAuth.login
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        maxWidth: 400,
        margin: '3rem auto',
        padding: '2rem',
        border: '1px solid #ddd',
        borderRadius: 8,
      }}
    >
      <h1>{forgotMode ? 'Reset password' : 'Login'}</h1>
      {error && (
        <div className="form-error" style={{ marginBottom: '0.5rem' }}>
          {error}
        </div>
      )}
      {!forgotMode && (
        <>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '0.75rem' }}>
              <label htmlFor="login-email" className="form-label">
                Email <span style={{ color: 'red' }}>*</span>
              </label>
              <input
                id="login-email"
                type="email"
                name="email_id"
                value={form.email_id}
                onChange={handleChange}
                required
                className="form-input"
              />
            </div>
            <div style={{ marginBottom: '0.75rem' }}>
              <label htmlFor="login-password" className="form-label">
                Password <span style={{ color: 'red' }}>*</span>
              </label>
              <input
                id="login-password"
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                required
                className="form-input"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              style={{ width: '100%', padding: '0.5rem' }}
            >
              {submitting ? 'Logging in...' : 'Login'}
            </button>
          </form>
          <button
            type="button"
            onClick={() => {
              setForgotMode(true);
              setError(null);
            }}
            style={{
              marginTop: '0.5rem',
              width: '100%',
              padding: '0.5rem',
              background: 'transparent',
              border: 'none',
              color: '#2563eb',
              cursor: 'pointer',
            }}
          >
            Forgot password?
          </button>
        </>
      )}

      {forgotMode && (
        <RecoveryFlow
          onError={setError}
          onExit={() => {
            setForgotMode(false);
            setError(null);
          }}
        />
      )}

      <p style={{ marginTop: '1rem' }}>
        No account? <Link to="/register">Register</Link>
      </p>
    </div>
  );
}
