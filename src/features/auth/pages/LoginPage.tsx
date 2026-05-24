import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';

import { RecoveryFlow } from '../recovery/components/RecoveryFlow';
import { useAuth } from '../state/useAuth';

// Inline-styled while the visual upgrade for the auth pages is staged
// alongside the rest of the auth feature batch. Recovery (forgot-password)
// is delegated to <RecoveryFlow /> in features/auth/recovery/.

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
        <div style={{ color: 'red', marginBottom: '0.5rem' }}>{error}</div>
      )}
      {!forgotMode && (
        <>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '0.75rem' }}>
              <label>
                Email <span style={{ color: 'red' }}>*</span>
                <input
                  type="email"
                  name="email_id"
                  value={form.email_id}
                  onChange={handleChange}
                  required
                  style={{ width: '100%', padding: '0.5rem', marginTop: 4 }}
                />
              </label>
            </div>
            <div style={{ marginBottom: '0.75rem' }}>
              <label>
                Password <span style={{ color: 'red' }}>*</span>
                <input
                  type="password"
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  required
                  style={{ width: '100%', padding: '0.5rem', marginTop: 4 }}
                />
              </label>
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
