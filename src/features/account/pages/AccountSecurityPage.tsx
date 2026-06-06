import { useEffect, useState } from 'react';

import { PasswordRequirements } from '../../../shared/components/PasswordRequirements';
import { SECURITY_QUESTIONS } from '../../../shared/constants/securityQuestions';
import { validatePassword } from '../../../shared/utils/validation';
import {
  changePasswordRequest,
  setRecoveryQuestionRequest,
} from '../../users/api/mutations';
import {
  fetchRecoveryQuestions,
  type RecoveryQuestionItem,
} from '../../users/api/queries';
import { EmailChangeForm } from '../components/EmailChangeForm';
import { SessionList } from '../components/SessionList';
import { TrustedDeviceList } from '../components/TrustedDeviceList';
import { TwoFactorSection } from '../components/TwoFactorSection';

interface ApiErrorShape {
  detail?: string;
  error?: string;
}

// View-model: owns the password + recovery-question form state, the
// recovery-questions load effect, and both submit handlers. Keeps the page
// component a thin two-card render under the max-lines gate.
function useAccountSecurity() {
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
  });
  const [passwordStatus, setPasswordStatus] = useState<string | null>(null);

  const [recoveryQuestions, setRecoveryQuestions] = useState<
    RecoveryQuestionItem[]
  >([]);
  const [newRecovery, setNewRecovery] = useState({ question: '', answer: '' });
  const [recoveryStatus, setRecoveryStatus] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const r = await fetchRecoveryQuestions();
        setRecoveryQuestions(r.questions ?? []);
      } catch {
        // Recovery list is optional context.
      }
    })();
  }, []);

  async function handlePasswordSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPasswordStatus(null);
    try {
      await changePasswordRequest(passwordForm);
      setPasswordStatus('Password updated successfully.');
      setPasswordForm({ current_password: '', new_password: '' });
    } catch (err) {
      const e = err as ApiErrorShape;
      setPasswordStatus(e.detail || e.error || 'Failed to change password');
    }
  }

  async function handleRecoverySubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!newRecovery.question.trim() || !newRecovery.answer.trim()) {
      setRecoveryStatus('Question and answer are required');
      return;
    }
    try {
      await setRecoveryQuestionRequest(newRecovery);
      const refreshed = await fetchRecoveryQuestions();
      setRecoveryQuestions(refreshed.questions ?? []);
      setNewRecovery({ question: '', answer: '' });
      setRecoveryStatus('Security question updated successfully.');
    } catch (err) {
      const e = err as ApiErrorShape;
      setRecoveryStatus(
        e.detail || e.error || 'Failed to update security question'
      );
    }
  }

  return {
    passwordForm,
    setPasswordForm,
    passwordStatus,
    recoveryQuestions,
    newRecovery,
    setNewRecovery,
    recoveryStatus,
    handlePasswordSubmit,
    handleRecoverySubmit,
  };
}

export function AccountSecurityPage() {
  const {
    passwordForm,
    setPasswordForm,
    passwordStatus,
    recoveryQuestions,
    newRecovery,
    setNewRecovery,
    recoveryStatus,
    handlePasswordSubmit,
    handleRecoverySubmit,
  } = useAccountSecurity();

  // Card-anchored layout (Batch 9 polish): breadcrumb reads
  // "Account › Security"; no in-content title.
  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-white p-6 shadow-sm dark:bg-slate-900 dark:shadow-none dark:ring-1 dark:ring-slate-800">
        <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100">
          Change password
        </h2>
        <form onSubmit={handlePasswordSubmit} className="grid gap-3">
          <div>
            <label htmlFor="security-current-password" className="form-label">
              Current password <span className="text-danger-600">*</span>
            </label>
            <input
              id="security-current-password"
              type="password"
              autoComplete="current-password"
              name="current_password"
              value={passwordForm.current_password}
              onChange={(e) =>
                setPasswordForm((f) => ({
                  ...f,
                  current_password: e.target.value,
                }))
              }
              required
              className="form-input"
            />
          </div>
          <div>
            <label htmlFor="security-new-password" className="form-label">
              New password <span className="text-danger-600">*</span>
            </label>
            <input
              id="security-new-password"
              type="password"
              autoComplete="new-password"
              name="new_password"
              value={passwordForm.new_password}
              onChange={(e) =>
                setPasswordForm((f) => ({ ...f, new_password: e.target.value }))
              }
              required
              className="form-input"
            />
            <PasswordRequirements password={passwordForm.new_password} />
          </div>
          <button
            type="submit"
            disabled={
              !!passwordForm.new_password &&
              !validatePassword(passwordForm.new_password).isValid
            }
            className="btn-primary !w-auto"
          >
            Update password
          </button>
          {passwordStatus && (
            <div
              className={
                passwordStatus.includes('successfully')
                  ? 'text-success-600 dark:text-success-400 text-sm font-medium'
                  : 'form-error'
              }
            >
              {passwordStatus}
            </div>
          )}
        </form>
      </div>

      <div className="rounded-xl bg-white p-6 shadow-sm dark:bg-slate-900 dark:shadow-none dark:ring-1 dark:ring-slate-800">
        <h2 className="mb-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
          Security question
        </h2>
        <p className="mb-5 text-sm text-slate-500 dark:text-slate-400">
          Configuring a security question helps you recover your account if you
          forget your password. Setting a new question will{' '}
          <strong>replace</strong> any previous choice. Answers are hashed and
          stored securely.
        </p>

        {recoveryQuestions.length > 0 && (
          <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
            <span className="text-xs font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400">
              Current question
            </span>
            <div className="mt-1 font-medium text-slate-800 dark:text-slate-100">
              {recoveryQuestions[0]?.question}
            </div>
          </div>
        )}

        <form onSubmit={handleRecoverySubmit} className="grid gap-4">
          <div>
            <label htmlFor="security-recovery-question" className="form-label">
              {recoveryQuestions.length > 0
                ? 'Change question'
                : 'Set question'}
            </label>
            <select
              id="security-recovery-question"
              name="question"
              value={newRecovery.question}
              onChange={(e) =>
                setNewRecovery((f) => ({ ...f, question: e.target.value }))
              }
              className="form-input"
            >
              <option value="">— Select a question —</option>
              {SECURITY_QUESTIONS.map((q) => (
                <option key={q} value={q}>
                  {q}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="security-recovery-answer" className="form-label">
              Security answer
            </label>
            <input
              id="security-recovery-answer"
              type="password"
              autoComplete="new-password"
              name="answer"
              placeholder="Enter answer"
              value={newRecovery.answer}
              onChange={(e) =>
                setNewRecovery((f) => ({ ...f, answer: e.target.value }))
              }
              className="form-input"
            />
          </div>

          <button type="submit" className="btn-primary !w-auto">
            {recoveryQuestions.length > 0 ? 'Update question' : 'Save question'}
          </button>
          {recoveryStatus && (
            <div
              className={
                recoveryStatus.includes('successfully')
                  ? 'text-success-600 dark:text-success-400 text-sm font-medium'
                  : 'form-error'
              }
            >
              {recoveryStatus}
            </div>
          )}
        </form>
      </div>

      <div className="rounded-xl bg-white p-6 shadow-sm dark:bg-slate-900 dark:shadow-none dark:ring-1 dark:ring-slate-800">
        <h2 className="mb-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
          Two-factor authentication
        </h2>
        <TwoFactorSection />
      </div>

      <div className="rounded-xl bg-white p-6 shadow-sm dark:bg-slate-900 dark:shadow-none dark:ring-1 dark:ring-slate-800">
        <h2 className="mb-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
          Change email
        </h2>
        <EmailChangeForm />
      </div>

      <div className="rounded-xl bg-white p-6 shadow-sm dark:bg-slate-900 dark:shadow-none dark:ring-1 dark:ring-slate-800">
        <h2 className="mb-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
          Active sessions
        </h2>
        <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
          Devices currently signed in to your account. Revoke any you
          don&rsquo;t recognise — the affected device will be signed out
          immediately. Backend enforces a 5-session cap; new sign-ins evict the
          oldest device.
        </p>
        <SessionList />
      </div>

      <div className="rounded-xl bg-white p-6 shadow-sm dark:bg-slate-900 dark:shadow-none dark:ring-1 dark:ring-slate-800">
        <h2 className="mb-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
          Trusted devices
        </h2>
        <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
          Devices that have cleared the new-device email-OTP gate. Forget any
          you don&rsquo;t recognise — that device&rsquo;s next sign-in will
          require an emailed code, and its active session (if any) ends
          immediately.
        </p>
        <TrustedDeviceList />
      </div>
    </div>
  );
}
