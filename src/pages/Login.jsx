import React, { useState } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { apiFetch } from '../utils/apiClient.js';
import { useAuth } from '../state/AuthContext.jsx';

export function LoginPage() {
  const { user, loading, login, error, setError } = useAuth();
  const [form, setForm] = useState({ email_id: '', password: '' });
  const [submitting, setSubmitting] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpForm, setOtpForm] = useState({ email_id: '', otp: '', new_password: '' });
  const [recoveryStep, setRecoveryStep] = useState('email');
  const [recoveryQuestion, setRecoveryQuestion] = useState('');
  const [answerForm, setAnswerForm] = useState({ email_id: '', answer: '', new_password: '' });
  const navigate = useNavigate();

  if (loading) {
    return (
      <div style={{ maxWidth: 400, margin: '3rem auto', padding: '2rem', textAlign: 'center' }}>
        Loading...
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    if (error) setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await login(form);
    } catch (err) {
      setError(err.error || 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotChange = (e) => {
    const { name, value } = e.target;
    setOtpForm((f) => ({ ...f, [name]: value }));
    if (error) setError(null);
  };

  const handleAnswerChange = (e) => {
    const { name, value } = e.target;
    setAnswerForm((f) => ({ ...f, [name]: value }));
    if (error) setError(null);
  };

  const startRecovery = async (email) => {
    try {
      const res = await apiFetch('/api/auth/recovery-question', {
        method: 'POST',
        body: JSON.stringify({ email_id: email })
      });
      setRecoveryQuestion(res.question || '');
      setAnswerForm({ email_id: email, answer: '', new_password: '' });
      setOtpForm((f) => ({ ...f, email_id: email }));
      setRecoveryStep(res.question ? 'question' : 'otp');
    } catch (err) {
      // If lookup fails, fall back to OTP path
      setRecoveryQuestion('');
      setRecoveryStep('otp');
    }
  };

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiFetch('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email_id: otpForm.email_id })
      });
      setOtpSent(true);
    } catch (err) {
      setError(err.detail || err.error || 'Failed to request reset link');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiFetch('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          email_id: otpForm.email_id,
          otp: otpForm.otp,
          new_password: otpForm.new_password
        })
      });
      navigate('/dashboard');
    } catch (err) {
      setError(err.detail || err.error || 'Failed to reset password');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: '3rem auto', padding: '2rem', border: '1px solid #ddd', borderRadius: 8 }}>
      <h1>{forgotMode ? 'Reset password' : 'Login'}</h1>
      {error && <div style={{ color: 'red', marginBottom: '0.5rem' }}>{error}</div>}
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
            <button type="submit" disabled={submitting} style={{ width: '100%', padding: '0.5rem' }}>
              {submitting ? 'Logging in...' : 'Login'}
            </button>
          </form>
          <button
            type="button"
            onClick={() => {
              setForgotMode(true);
              setError(null);
            }}
            style={{ marginTop: '0.5rem', width: '100%', padding: '0.5rem', background: 'transparent', border: 'none', color: '#2563eb', cursor: 'pointer' }}
          >
            Forgot password?
          </button>
        </>
      )}

      {forgotMode && (
        <>
          {recoveryStep === 'email' && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await startRecovery(otpForm.email_id);
              }}
            >
              <div style={{ marginBottom: '0.75rem' }}>
                <label>
                  Registered email <span style={{ color: 'red' }}>*</span>
                  <input
                    type="email"
                    name="email_id"
                    value={otpForm.email_id}
                    onChange={handleForgotChange}
                    required
                    style={{ width: '100%', padding: '0.5rem', marginTop: 4 }}
                  />
                </label>
              </div>
              <button type="submit" style={{ width: '100%', padding: '0.5rem' }}>
                Continue
              </button>
            </form>
          )}

          {recoveryStep === 'question' && (
            <>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setSubmitting(true);
                  try {
                    await apiFetch('/api/auth/reset-by-answer', {
                      method: 'POST',
                      body: JSON.stringify({
                        email_id: answerForm.email_id,
                        answer: answerForm.answer,
                        new_password: answerForm.new_password
                      })
                    });
                    navigate('/dashboard');
                  } catch (err) {
                    setError(err.detail || err.error || 'Failed to reset password');
                  } finally {
                    setSubmitting(false);
                  }
                }}
              >
                <div style={{ marginBottom: '0.75rem' }}>
                  <label>
                    Security question
                    <div style={{ marginTop: 4, marginBottom: 4, color: '#374151' }}>
                      {recoveryQuestion || 'No security question configured; you can use OTP instead.'}
                    </div>
                  </label>
                </div>
                <div style={{ marginBottom: '0.75rem' }}>
                  <label>
                    Answer <span style={{ color: 'red' }}>*</span>
                    <input
                      type="text"
                      name="answer"
                      value={answerForm.answer}
                      onChange={handleAnswerChange}
                      required
                      style={{ width: '100%', padding: '0.5rem', marginTop: 4 }}
                    />
                  </label>
                </div>
                <div style={{ marginBottom: '0.75rem' }}>
                  <label>
                    New password <span style={{ color: 'red' }}>*</span>
                    <input
                      type="password"
                      name="new_password"
                      value={answerForm.new_password}
                      onChange={handleAnswerChange}
                      required
                      style={{ width: '100%', padding: '0.5rem', marginTop: 4 }}
                    />
                  </label>
                </div>
                <button type="submit" disabled={submitting} style={{ width: '100%', padding: '0.5rem' }}>
                  {submitting ? 'Updating...' : 'Reset password'}
                </button>
              </form>
              <button
                type="button"
                onClick={() => {
                  setRecoveryStep('otp');
                  setError(null);
                }}
                style={{
                  marginTop: '0.5rem',
                  width: '100%',
                  padding: '0.5rem',
                  background: 'transparent',
                  border: 'none',
                  color: '#2563eb',
                  cursor: 'pointer'
                }}
              >
                I do not remember the answer, use OTP instead
              </button>
            </>
          )}

          {recoveryStep === 'otp' && (
            <>
              {!otpSent ? (
                <form onSubmit={handleRequestOtp}>
                  <div style={{ marginBottom: '0.75rem' }}>
                    <label>
                      Registered email <span style={{ color: 'red' }}>*</span>
                      <input
                        type="email"
                        name="email_id"
                        value={otpForm.email_id}
                        onChange={handleForgotChange}
                        required
                        style={{ width: '100%', padding: '0.5rem', marginTop: 4 }}
                      />
                    </label>
                  </div>
                  <button type="submit" disabled={submitting} style={{ width: '100%', padding: '0.5rem' }}>
                    {submitting ? 'Sending OTP...' : 'Send OTP'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleResetPassword}>
                  <div style={{ marginBottom: '0.75rem' }}>
                    <label>
                      OTP <span style={{ color: 'red' }}>*</span>
                      <input
                        type="text"
                        name="otp"
                        value={otpForm.otp}
                        onChange={handleForgotChange}
                        required
                        maxLength={6}
                        style={{ width: '100%', padding: '0.5rem', marginTop: 4 }}
                      />
                    </label>
                  </div>
                  <div style={{ marginBottom: '0.75rem' }}>
                    <label>
                      New password <span style={{ color: 'red' }}>*</span>
                      <input
                        type="password"
                        name="new_password"
                        value={otpForm.new_password}
                        onChange={handleForgotChange}
                        required
                        style={{ width: '100%', padding: '0.5rem', marginTop: 4 }}
                      />
                    </label>
                  </div>
                  <button type="submit" disabled={submitting} style={{ width: '100%', padding: '0.5rem' }}>
                    {submitting ? 'Updating...' : 'Reset password'}
                  </button>
                </form>
              )}
            </>
          )}
          <button
            type="button"
            onClick={() => {
              setForgotMode(false);
              setOtpSent(false);
              setError(null);
            }}
            style={{ marginTop: '0.5rem', width: '100%', padding: '0.5rem', background: 'transparent', border: 'none', color: '#2563eb', cursor: 'pointer' }}
          >
            Back to login
          </button>
        </>
      )}

      <p style={{ marginTop: '1rem' }}>
        No account? <Link to="/register">Register</Link>
      </p>
    </div>
  );
}

