import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { PasswordRequirements } from '../../../../shared/components/PasswordRequirements';
import { useAuthStore } from '../../../../shared/state/auth.store';
import { validatePassword } from '../../../../shared/utils/validation';
import {
  forgotPasswordRequest,
  recoveryQuestionRequest,
  isTwoFactorChallenge,
  resetPasswordFinalRequest,
  verifyAnswerRequest,
  verifyOtpRequest,
} from '../../api/mutations';

type RecoveryStep = 'email' | 'choice' | 'question' | 'otp' | 'reset';

interface ApiErrorShape {
  detail?: string;
  error?: string;
  retryAfterSeconds?: number;
}

function formatRetrySeconds(seconds: number): string {
  if (seconds <= 1) return '1 second';
  if (seconds < 60) return `${seconds} seconds`;
  const minutes = Math.ceil(seconds / 60);
  return minutes === 1 ? '1 minute' : `${minutes} minutes`;
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
    // Recovery routes are rate-limited (auth.rate-limit) on an
    // (IP, email) composite key — surface the live countdown via the
    // auth store so `<AuthErrorNotice action="recovery" />` upstream
    // in `<LoginForm>` ticks down on the inline copy.
    if (typeof e.retryAfterSeconds === 'number' && e.retryAfterSeconds > 0) {
      useAuthStore.getState().setRetryAfterSeconds(e.retryAfterSeconds);
      return `Too many recovery attempts. Please try again in ${formatRetrySeconds(e.retryAfterSeconds)}.`;
    }
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
      const res = await resetPasswordFinalRequest(resetToken, newPassword);
      // BE Phase 2.7 — recovery for a 2FA-enabled user lands on the
      // TOTP challenge (new password saved, but no session issued
      // yet). Backup codes are the escape hatch if the authenticator
      // is lost.
      if (isTwoFactorChallenge(res)) {
        navigate('/verify/2fa', {
          state: { pending_token: res.pending_token },
        });
        return;
      }
      navigate('/dashboard');
    } catch (err) {
      onError(readError(err, 'Failed to reset password'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResendOtp() {
    setSubmitting(true);
    try {
      await requestOtp(email);
    } catch (err) {
      onError(readError(err, 'Failed to request OTP'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUseOtpInstead() {
    clearError();
    await requestOtp(email);
    setStep('otp');
  }

  function handleBackToLogin() {
    setStep('email');
    setResetToken('');
    setOtp('');
    setAnswer('');
    setQuestion('');
    onExit();
  }

  return (
    <>
      {step === 'email' && (
        <EmailStep
          email={email}
          onEmailChange={(value) => {
            setEmail(value);
            clearError();
          }}
          onSubmit={() => void startRecovery(email)}
        />
      )}

      {step === 'choice' && (
        <ChoiceStep
          onChooseQuestion={() => setStep('question')}
          onChooseOtp={handleUseOtpInstead}
        />
      )}

      {step === 'question' && (
        <QuestionStep
          question={question}
          answer={answer}
          onAnswerChange={(value) => {
            setAnswer(value);
            clearError();
          }}
          submitting={submitting}
          onSubmit={handleVerifyAnswer}
          onUseOtp={handleUseOtpInstead}
        />
      )}

      {step === 'otp' && (
        <OtpStep
          email={email}
          otp={otp}
          onOtpChange={(value) => {
            setOtp(value);
            clearError();
          }}
          submitting={submitting}
          onSubmit={handleVerifyOtp}
          onResend={handleResendOtp}
        />
      )}

      {step === 'reset' && (
        <ResetStep
          newPassword={newPassword}
          onNewPasswordChange={setNewPassword}
          submitting={submitting}
          onSubmit={handleFinalReset}
        />
      )}

      <button
        type="button"
        onClick={handleBackToLogin}
        className="btn-link"
        style={{ marginTop: '0.5rem' }}
      >
        Back to login
      </button>
    </>
  );
}

// — Per-step presentational forms. The parent owns the state machine and
// the mutation handlers; each step is a thin controlled form so RecoveryFlow
// itself stays under the max-lines gate.

const CHOICE_BUTTON_CLASS =
  'inline-flex w-full items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:border-accent-300 hover:bg-accent-50 hover:text-accent-700 focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 focus-visible:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-accent-700 dark:hover:bg-accent-950/40 dark:hover:text-accent-300 dark:focus-visible:ring-offset-slate-950';

interface EmailStepProps {
  email: string;
  onEmailChange: (value: string) => void;
  onSubmit: () => void;
}

function EmailStep({ email, onEmailChange, onSubmit }: EmailStepProps) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
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
          onChange={(e) => onEmailChange(e.target.value)}
          required
          className="form-input"
        />
      </div>
      <button type="submit" className="btn-primary">
        Continue
      </button>
    </form>
  );
}

interface ChoiceStepProps {
  onChooseQuestion: () => void;
  onChooseOtp: () => void;
}

function ChoiceStep({ onChooseQuestion, onChooseOtp }: ChoiceStepProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <p style={{ margin: 0 }} className="text-slate-700 dark:text-slate-300">
        How would you like to verify your identity?
      </p>
      <button
        type="button"
        onClick={onChooseQuestion}
        className={CHOICE_BUTTON_CLASS}
      >
        Security question
      </button>
      <button
        type="button"
        onClick={onChooseOtp}
        className={CHOICE_BUTTON_CLASS}
      >
        OTP (One-time password)
      </button>
    </div>
  );
}

interface QuestionStepProps {
  question: string;
  answer: string;
  onAnswerChange: (value: string) => void;
  submitting: boolean;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onUseOtp: () => void;
}

function QuestionStep({
  question,
  answer,
  onAnswerChange,
  submitting,
  onSubmit,
  onUseOtp,
}: QuestionStepProps) {
  return (
    <>
      <form onSubmit={onSubmit}>
        <div style={{ marginBottom: '0.75rem' }}>
          <span className="form-label">Security question</span>
          <div
            style={{ marginBottom: 4, color: '#374151', fontWeight: 'bold' }}
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
            onChange={(e) => onAnswerChange(e.target.value)}
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
        onClick={onUseOtp}
        className="btn-link"
        style={{ marginTop: '1rem' }}
      >
        Use OTP instead
      </button>
    </>
  );
}

interface OtpStepProps {
  email: string;
  otp: string;
  onOtpChange: (value: string) => void;
  submitting: boolean;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onResend: () => void;
}

function OtpStep({
  email,
  otp,
  onOtpChange,
  submitting,
  onSubmit,
  onResend,
}: OtpStepProps) {
  return (
    <form onSubmit={onSubmit}>
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
          onChange={(e) => onOtpChange(e.target.value)}
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
        onClick={onResend}
        className="btn-link"
        style={{ marginTop: '0.5rem' }}
      >
        Resend code
      </button>
    </form>
  );
}

interface ResetStepProps {
  newPassword: string;
  onNewPasswordChange: (value: string) => void;
  submitting: boolean;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}

function ResetStep({
  newPassword,
  onNewPasswordChange,
  submitting,
  onSubmit,
}: ResetStepProps) {
  return (
    <form onSubmit={onSubmit}>
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
          onChange={(e) => onNewPasswordChange(e.target.value)}
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
  );
}
