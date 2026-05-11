import React, { useState } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { apiFetch } from '../utils/apiClient.js';
import { useAuth } from '../state/AuthContext.jsx';
import { validatePassword } from '../utils/validation';
import { PasswordRequirements } from '../components/PasswordRequirements.jsx';

export function LoginPage() {
  const { user, loading, login, error, setError } = useAuth();
  const [form, setForm] = useState({ email_id: '', password: '' });
  const [submitting, setSubmitting] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpForm, setOtpForm] = useState({ email_id: '', otp: '', new_password: '' });
  const [recoveryStep, setRecoveryStep] = useState('email');
  const [recoveryQuestion, setRecoveryQuestion] = useState('');
  const [answerForm, setAnswerForm] = useState({ email_id: '', answer: '' });
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
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
    setError(null);
    try {
      const res = await apiFetch('/api/auth/recovery-question', {
        method: 'POST', // Changed to POST to match FastAPI requirement for JSON body
        body: JSON.stringify({ email_id: email })
      });
      setRecoveryQuestion(res.question || '');
      setAnswerForm({ email_id: email, answer: '', new_password: '' });
      setOtpForm((f) => ({ ...f, email_id: email }));
      
      if (res.question) {
        setRecoveryStep('choice');
      } else {
        // No question? Send OTP immediately and go to OTP step
        await handleRequestOtpInternal(email);
        setRecoveryStep('otp');
      }
    } catch (err) {
      setError(err.detail || err.error || 'Recovery failed to start');
    }
  };

  const handleRequestOtpInternal = async (email) => {
    await apiFetch('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email_id: email })
    });
    setOtpSent(true);
  };

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await handleRequestOtpInternal(otpForm.email_id);
    } catch (err) {
      setError(err.detail || err.error || 'Failed to request OTP');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await apiFetch('/api/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ email_id: otpForm.email_id, otp: otpForm.otp })
      });
      setResetToken(res.reset_token);
      setRecoveryStep('reset');
      setError(null);
    } catch (err) {
      setError(err.detail || err.error || 'Invalid OTP');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyAnswer = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await apiFetch('/api/auth/verify-answer', {
        method: 'POST',
        body: JSON.stringify({ email_id: answerForm.email_id, answer: answerForm.answer })
      });
      setResetToken(res.reset_token);
      setRecoveryStep('reset');
      setError(null);
    } catch (err) {
      setError(err.detail || err.error || 'Incorrect answer');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFinalReset = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiFetch('/api/auth/reset-password-final', {
        method: 'POST',
        body: JSON.stringify({ reset_token: resetToken, new_password: newPassword })
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

          {recoveryStep === 'choice' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <p style={{ margin: 0, color: '#374151' }}>How would you like to verify your identity?</p>
              <button
                type="button"
                onClick={() => setRecoveryStep('question')}
                style={{ width: '100%', padding: '0.5rem', cursor: 'pointer', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4 }}
              >
                Security question
              </button>
              <button
                type="button"
                onClick={async () => {
                  await handleRequestOtpInternal(otpForm.email_id);
                  setRecoveryStep('otp');
                }}
                style={{ width: '100%', padding: '0.5rem', cursor: 'pointer', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4 }}
              >
                OTP (One-time password)
              </button>
            </div>
          )}

          {recoveryStep === 'question' && (
            <>
              <form onSubmit={handleVerifyAnswer}>
                <div style={{ marginBottom: '0.75rem' }}>
                  <label>
                    Security question
                    <div style={{ marginTop: 4, marginBottom: 4, color: '#374151', fontWeight: 'bold' }}>
                      {recoveryQuestion}
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
                <button type="submit" disabled={submitting} style={{ width: '100%', padding: '0.5rem' }}>
                  {submitting ? 'Verifying...' : 'Verify answer'}
                </button>
              </form>
              <button
                type="button"
                onClick={async () => {
                  setError(null);
                  await handleRequestOtpInternal(otpForm.email_id);
                  setRecoveryStep('otp');
                }}
                style={{
                  marginTop: '1rem',
                  width: '100%',
                  padding: '0.5rem',
                  background: 'transparent',
                  border: 'none',
                  color: '#2563eb',
                  cursor: 'pointer',
                  fontSize: '0.9rem'
                }}
              >
                Use OTP instead
              </button>
            </>
          )}

          {recoveryStep === 'otp' && (
            <form onSubmit={handleVerifyOtp}>
              <div style={{ marginBottom: '0.75rem' }}>
                <p style={{ fontSize: '0.9rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                  A 6-digit code has been sent to {otpForm.email_id}.
                </p>
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
              <button type="submit" disabled={submitting} style={{ width: '100%', padding: '0.5rem' }}>
                {submitting ? 'Verifying...' : 'Verify OTP'}
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleRequestOtp}
                style={{
                  marginTop: '0.5rem',
                  width: '100%',
                  padding: '0.5rem',
                  background: 'transparent',
                  border: 'none',
                  color: '#2563eb',
                  cursor: 'pointer',
                  fontSize: '0.85rem'
                }}
              >
                Resend code
              </button>
            </form>
          )}

          {recoveryStep === 'reset' && (
            <form onSubmit={handleFinalReset}>
              <div style={{ marginBottom: '0.75rem' }}>
                <p style={{ fontSize: '0.9rem', color: '#059669', marginBottom: '1rem', fontWeight: 'bold' }}>
                  Identity verified! Set your new password below.
                </p>
                <label>
                  New password <span style={{ color: 'red' }}>*</span>
                  <input
                    type="password"
                    name="newPassword"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    style={{ width: '100%', padding: '0.5rem', marginTop: 4 }}
                  />
                </label>
                <PasswordRequirements password={newPassword} />
              </div>
              <button type="submit" disabled={submitting || (newPassword && !validatePassword(newPassword).isValid)} style={{ width: '100%', padding: '0.5rem' }}>
                {submitting ? 'Updating...' : 'Reset password'}
              </button>
            </form>
          )}

          <button
            type="button"
            onClick={() => {
              setForgotMode(false);
              setOtpSent(false);
              setRecoveryStep('email');
              setResetToken('');
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

