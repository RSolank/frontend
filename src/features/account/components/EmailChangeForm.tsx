import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import {
  changeEmailConfirmRequest,
  changeEmailRequestStart,
} from '../../auth/api/mutations';
import { useSecurityStatusQuery } from '../../auth/api/security';
import { userKeys } from '../../users/api/keys';

interface ApiErrorShape {
  detail?: string;
  error?: string;
  status?: number;
}

type Step =
  | { kind: 'idle' }
  | { kind: 'confirm'; newEmail: string }
  | { kind: 'done'; newEmail: string };

// Pulled out of the component so the eslint max-lines gate
// (CONTRIBUTING.md §3 ratchet) doesn't bite. Owns the entire form's
// state, both mutations, and the error-mapping branches that turn
// the BE's 400/401/409/429 into FE copy. Component below stays a
// thin three-step render.
function useEmailChangeForm() {
  const queryClient = useQueryClient();
  // Auth-owned account-protection snapshot — `GET /api/v1/auth/security`
  // (BE `auth.security-status`). 2FA state stays on the auth domain;
  // pre-deciding the step-up code field from this snapshot replaces the
  // 401-reveal fallback that ran while BE-side 2FA-status was undeclared.
  const { data: security } = useSecurityStatusQuery();
  const twoFactorOn = security?.two_factor_enabled ?? false;

  const [step, setStep] = useState<Step>({ kind: 'idle' });
  const [newEmail, setNewEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [codeRequired, setCodeRequired] = useState(twoFactorOn);
  const [otp, setOtp] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  // `useState(twoFactorOn)` captures the value at first render — the
  // security query is async, so without this sync the field would
  // stay hidden until the 401-reveal kicked in. Once the snapshot
  // lands and 2FA is on, reveal the code field upfront.
  useEffect(() => {
    if (twoFactorOn) setCodeRequired(true);
  }, [twoFactorOn]);

  const requestStart = useMutation({
    mutationFn: () =>
      changeEmailRequestStart({
        new_email: newEmail,
        password,
        ...(codeRequired && code ? { code } : {}),
      }),
    onSuccess: () => {
      setStep({ kind: 'confirm', newEmail });
      setStatus(null);
    },
    onError: (err: unknown) => setStatus(requestErrorCopy(err, codeRequired, setCodeRequired)),
  });

  const confirm = useMutation({
    mutationFn: () => changeEmailConfirmRequest(otp),
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({ queryKey: userKeys.me() });
      setStep({ kind: 'done', newEmail: res.email ?? newEmail });
      setStatus(null);
    },
    onError: (err: unknown) => {
      const next = confirmErrorCopy(err);
      if (next.restart) {
        setStep({ kind: 'idle' });
        setOtp('');
      }
      setStatus(next.message);
    },
  });

  function reset() {
    setNewEmail('');
    setPassword('');
    setCode('');
    setCodeRequired(false);
    setOtp('');
    setStep({ kind: 'idle' });
    setStatus(null);
  }

  return {
    step,
    newEmail,
    setNewEmail,
    password,
    setPassword,
    code,
    setCode,
    codeRequired,
    otp,
    setOtp,
    status,
    requestStartPending: requestStart.isPending,
    confirmPending: confirm.isPending,
    onRequestSubmit: (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setStatus(null);
      requestStart.mutate();
    },
    onConfirmSubmit: (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setStatus(null);
      confirm.mutate();
    },
    reset,
  };
}

// 401 is ambiguous (wrong password OR missing/wrong 2FA code). First
// 401 reveals the field with defensive copy; subsequent 401s with
// the code visible nudge the user to recheck both.
function requestErrorCopy(
  err: unknown,
  codeRequired: boolean,
  setCodeRequired: (v: boolean) => void
): string {
  const e = err as ApiErrorShape;
  if (e.status === 401) {
    if (!codeRequired) {
      setCodeRequired(true);
      return "Couldn't verify — if you have two-factor on, enter your TOTP or backup code below.";
    }
    return "Couldn't verify — check your password and 2FA code.";
  }
  if (e.status === 409) return 'That email is already in use by another account.';
  if (e.status === 400) return 'The new email is the same as your current one.';
  if (e.status === 429) return 'Too many attempts. Please try again later.';
  return e.detail || e.error || 'Failed to start email change.';
}

// 409/429 on confirm are spec-terminal — kick back to step 1.
// 400 (wrong OTP) keeps the confirm view open so the user retries.
function confirmErrorCopy(err: unknown): { message: string; restart: boolean } {
  const e = err as ApiErrorShape;
  if (e.status === 409) {
    return {
      message:
        'That address was claimed by someone else in the meantime — start over with a different email.',
      restart: true,
    };
  }
  if (e.status === 429) {
    return {
      message: 'Too many wrong codes. Start the email change over.',
      restart: true,
    };
  }
  if (e.status === 400) {
    return {
      message: "That code didn't match. Try again or re-request a new one.",
      restart: false,
    };
  }
  return {
    message: e.detail || e.error || 'Failed to confirm the new email.',
    restart: false,
  };
}

// Two-step authenticated email change backed by BE Phase 2.8
// (`auth.email-change`). Step 1 POSTs the new email + password
// (+ 2FA code when on) and the BE emails an OTP to the new
// address; step 2 POSTs that OTP to swap the identity atomically.
export function EmailChangeForm() {
  const vm = useEmailChangeForm();
  if (vm.step.kind === 'done') return <DoneStep newEmail={vm.step.newEmail} onReset={vm.reset} />;
  if (vm.step.kind === 'confirm') return <ConfirmStep vm={vm} />;
  return <RequestStep vm={vm} />;
}

interface VM {
  newEmail: string;
  setNewEmail: (s: string) => void;
  password: string;
  setPassword: (s: string) => void;
  code: string;
  setCode: (s: string) => void;
  codeRequired: boolean;
  otp: string;
  setOtp: (s: string) => void;
  status: string | null;
  requestStartPending: boolean;
  confirmPending: boolean;
  onRequestSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onConfirmSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  reset: () => void;
  step: Step;
}

function RequestStep({ vm }: { vm: VM }) {
  return (
    <form
      onSubmit={vm.onRequestSubmit}
      className="grid gap-3"
      data-testid="email-change-request"
    >
      <p className="text-sm text-slate-600 dark:text-slate-300">
        We&rsquo;ll email a code to your new address and a heads-up
        to your current one. Other devices will be signed out after
        the change goes through.
      </p>
      <div>
        <label htmlFor="email-change-new" className="form-label">
          New email
        </label>
        <input
          id="email-change-new"
          type="email"
          autoComplete="email"
          value={vm.newEmail}
          onChange={(e) => vm.setNewEmail(e.target.value)}
          className="form-input"
          required
        />
      </div>
      <div>
        <label htmlFor="email-change-password" className="form-label">
          Current password
        </label>
        <input
          id="email-change-password"
          type="password"
          autoComplete="current-password"
          value={vm.password}
          onChange={(e) => vm.setPassword(e.target.value)}
          className="form-input"
          required
        />
      </div>
      {vm.codeRequired && (
        <div>
          <label htmlFor="email-change-2fa" className="form-label">
            2FA code (or backup)
          </label>
          <input
            id="email-change-2fa"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={vm.code}
            onChange={(e) => vm.setCode(e.target.value)}
            className="form-input"
            data-testid="email-change-2fa-code"
          />
        </div>
      )}
      {vm.status && (
        <div role="alert" className="form-error">
          {vm.status}
        </div>
      )}
      <button
        type="submit"
        disabled={vm.requestStartPending || !vm.newEmail || !vm.password}
        className="btn-primary !w-auto"
        data-testid="email-change-request-submit"
      >
        {vm.requestStartPending ? 'Sending…' : 'Send code'}
      </button>
    </form>
  );
}

function ConfirmStep({ vm }: { vm: VM }) {
  const target = vm.step.kind === 'confirm' ? vm.step.newEmail : '';
  return (
    <form
      onSubmit={vm.onConfirmSubmit}
      className="grid gap-3"
      data-testid="email-change-confirm"
    >
      <p className="text-sm text-slate-700 dark:text-slate-200">
        We sent a code to <strong>{target}</strong>. A security
        notice also went to your current address. Enter the code
        below to finish.
      </p>
      <label htmlFor="email-change-otp" className="form-label">
        One-time code
      </label>
      <input
        id="email-change-otp"
        inputMode="numeric"
        autoComplete="one-time-code"
        value={vm.otp}
        onChange={(e) => vm.setOtp(e.target.value)}
        className="form-input"
        required
        data-testid="email-change-otp"
      />
      {vm.status && (
        <div role="alert" className="form-error">
          {vm.status}
        </div>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={vm.confirmPending || !vm.otp}
          className="btn-primary !w-auto"
          data-testid="email-change-confirm-submit"
        >
          {vm.confirmPending ? 'Confirming…' : 'Confirm change'}
        </button>
        <button
          type="button"
          onClick={vm.reset}
          disabled={vm.confirmPending}
          className="btn-link"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function DoneStep({
  newEmail,
  onReset,
}: {
  newEmail: string;
  onReset: () => void;
}) {
  return (
    <div className="grid gap-3" data-testid="email-change-done">
      <p className="text-sm font-medium text-success-700 dark:text-success-300">
        Email updated to <strong>{newEmail}</strong>.
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Your other devices were signed out as a precaution. This
        device stays logged in.
      </p>
      <button type="button" onClick={onReset} className="self-start btn-link">
        Change again
      </button>
    </div>
  );
}
