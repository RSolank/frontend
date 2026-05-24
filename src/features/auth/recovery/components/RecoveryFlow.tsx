import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { PasswordRequirements } from '../../../../shared/components/PasswordRequirements';
import { validatePassword } from '../../../../shared/utils/validation';
import {
  forgotPasswordRequest,
  recoveryQuestionRequest,
  resetPasswordFinalRequest,
  verifyAnswerRequest,
  verifyOtpRequest,
} from '../../api/mutations';

type RecoveryStep = 'email' | 'choice' | 'question' | 'otp' | 'reset';

interface ApiErrorShape {
  detail?: string;
  error?: string;
}

interface RecoveryFlowProps {
  onError: (msg: string | null) => void;
  onExit: () => void;
}

// Multi-step "forgot password" flow extracted from the legacy Login.jsx.
// Owned by features/auth/recovery/ per the implementation plan; the
// LoginPage mounts it when the user clicks "Forgot password?".

export function RecoveryFlow({ onError, onExit }: RecoveryFlowProps) {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<RecoveryStep>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [answer, setAnswer] = useState('');
  const [question, setQuestion] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');

  function clearError() {
    onError(null);
  }

  function readError(err: unknown, fallback: string) {
    const e = err as ApiErrorShape;
    return e.detail || e.error || fallback;
  }

  async function requestOtp(targetEmail: string) {
    await forgotPasswordRequest(targetEmail);
  }

  async function startRecovery(targetEmail: string) {
    clearError();
    try {
      const res = await recoveryQuestionRequest(targetEmail);
      setEmail(targetEmail);
      setAnswer('');
      if (res.question) {
        setQuestion(res.question);
        setStep('choice');
      } else {
        await requestOtp(targetEmail);
        setStep('otp');
      }
    } catch (err) {
      onError(readError(err, 'Recovery failed to start'));
    }
  }

  async function handleRequestOtp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await requestOtp(email);
    } catch (err) {
      onError(readError(err, 'Failed to request OTP'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await verifyOtpRequest(email, otp);
      setResetToken(res.reset_token);
      setStep('reset');
      onError(null);
    } catch (err) {
      onError(readError(err, 'Invalid OTP'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerifyAnswer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await verifyAnswerRequest(email, answer);
      setResetToken(res.reset_token);
      setStep('reset');
      onError(null);
    } catch (err) {
      onError(readError(err, 'Incorrect answer'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleFinalReset(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await resetPasswordFinalRequest(resetToken, newPassword);
      navigate('/dashboard');
    } catch (err) {
      onError(readError(err, 'Failed to reset password'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {step === 'email' && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void startRecovery(email);
          }}
        >
          <div style={{ marginBottom: '0.75rem' }}>
            <label htmlFor="recovery-email" className="form-label">
              Registered email <span style={{ color: 'red' }}>*</span>
            </label>
            <input
              id="recovery-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                clearError();
              }}
              required
              className="form-input"
            />
          </div>
          <button type="submit" className="btn-primary">
            Continue
          </button>
        </form>
      )}

      {step === 'choice' && (
        <div
          style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
        >
          <p
            style={{ margin: 0 }}
            className="text-slate-700 dark:text-slate-300"
          >
            How would you like to verify your identity?
          </p>
          <button
            type="button"
            onClick={() => setStep('question')}
            className="inline-flex w-full items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-indigo-700 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-300 dark:focus-visible:ring-offset-slate-950"
          >
            Security question
          </button>
          <button
            type="button"
            onClick={async () => {
              await requestOtp(email);
              setStep('otp');
            }}
            className="inline-flex w-full items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-indigo-700 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-300 dark:focus-visible:ring-offset-slate-950"
          >
            OTP (One-time password)
          </button>
        </div>
      )}

      {step === 'question' && (
        <>
          <form onSubmit={handleVerifyAnswer}>
            <div style={{ marginBottom: '0.75rem' }}>
              <span className="form-label">Security question</span>
              <div
                style={{
                  marginBottom: 4,
                  color: '#374151',
                  fontWeight: 'bold',
                }}
              >
                {question}
              </div>
            </div>
            <div style={{ marginBottom: '0.75rem' }}>
              <label htmlFor="recovery-answer" className="form-label">
                Answer <span style={{ color: 'red' }}>*</span>
              </label>
              <input
                id="recovery-answer"
                type="text"
                value={answer}
                onChange={(e) => {
                  setAnswer(e.target.value);
                  clearError();
                }}
                required
                className="form-input"
              />
            </div>
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? 'Verifying...' : 'Verify answer'}
            </button>
          </form>
          <button
            type="button"
            onClick={async () => {
              clearError();
              await requestOtp(email);
              setStep('otp');
            }}
            className="btn-link"
            style={{ marginTop: '1rem' }}
          >
            Use OTP instead
          </button>
        </>
      )}

      {step === 'otp' && (
        <form onSubmit={handleVerifyOtp}>
          <div style={{ marginBottom: '0.75rem' }}>
            <p
              style={{
                fontSize: '0.9rem',
                color: '#6b7280',
                marginBottom: '0.5rem',
              }}
            >
              A 6-digit code has been sent to {email}.
            </p>
            <label htmlFor="recovery-otp" className="form-label">
              OTP <span style={{ color: 'red' }}>*</span>
            </label>
            <input
              id="recovery-otp"
              type="text"
              value={otp}
              onChange={(e) => {
                setOtp(e.target.value);
                clearError();
              }}
              required
              maxLength={6}
              className="form-input"
            />
          </div>
          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting ? 'Verifying...' : 'Verify OTP'}
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={async () => {
              setSubmitting(true);
              try {
                await requestOtp(email);
              } catch (err) {
                onError(readError(err, 'Failed to request OTP'));
              } finally {
                setSubmitting(false);
              }
            }}
            className="btn-link"
            style={{ marginTop: '0.5rem' }}
          >
            Resend code
          </button>
        </form>
      )}

      {step === 'reset' && (
        <form onSubmit={handleFinalReset}>
          <div style={{ marginBottom: '0.75rem' }}>
            <p
              style={{
                fontSize: '0.9rem',
                color: '#059669',
                marginBottom: '1rem',
                fontWeight: 'bold',
              }}
            >
              Identity verified! Set your new password below.
            </p>
            <label htmlFor="recovery-new-password" className="form-label">
              New password <span style={{ color: 'red' }}>*</span>
            </label>
            <input
              id="recovery-new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              className="form-input"
            />
            <PasswordRequirements password={newPassword} />
          </div>
          <button
            type="submit"
            disabled={
              submitting ||
              (newPassword.length > 0 && !validatePassword(newPassword).isValid)
            }
            className="btn-primary"
          >
            {submitting ? 'Updating...' : 'Reset password'}
          </button>
        </form>
      )}

      <button
        type="button"
        onClick={() => {
          setStep('email');
          setResetToken('');
          setOtp('');
          setAnswer('');
          setQuestion('');
          onExit();
        }}
        className="btn-link"
        style={{ marginTop: '0.5rem' }}
      >
        Back to login
      </button>
    </>
  );
}
