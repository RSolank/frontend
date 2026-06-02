import { useState } from 'react';

import { useBrandingQuery } from '../../../shared/api/branding';
import { Modal } from '../../../shared/components/Modal';
import {
  disableTwoFactorRequest,
  enrollTwoFactorRequest,
  verifyEnrollTwoFactorRequest,
  type TwoFactorEnrollResponse,
} from '../../auth/api/twoFactor';
import { useCurrentUserQuery } from '../../users/api/queries';

// BE Phase 2.7 (T-2fa-enroll). Two-factor authentication surface on
// `/account/security`.
//
// Three flow states:
//   - **idle** — initial state. Renders the Enable CTA (off) or
//     Disable card (on).
//   - **enrolling** — `/2fa/enroll` succeeded; FE shows the
//     `provisioning_uri` deep link + the base32 `secret` for manual
//     entry, and prompts for the first TOTP code.
//   - **showing-backup-codes** — `/2fa/verify-enroll` succeeded; FE
//     shows the 10 one-time backup codes WITH a Download button.
//     BE only returns these once; lose them, lose them.
//
// NOTE: a proper QR render is queued for a follow-up — bundle headroom
// is currently 0.73 kB and a QR library would push us over the §3
// ceiling. The provisioning URI is shown as a deep link (mobile
// authenticators register `otpauth://`) plus the base32 secret for
// manual entry, which every authenticator app accepts.
type FlowState =
  | { kind: 'idle' }
  | { kind: 'enrolling'; data: TwoFactorEnrollResponse }
  | { kind: 'showing-backup-codes'; codes: string[] };

interface ApiErrorShape {
  detail?: string;
  error?: string;
  status?: number;
}

function errorMessage(err: unknown, fallback: string): string {
  const e = err as ApiErrorShape;
  return e?.detail || e?.error || fallback;
}

export function TwoFactorSection() {
  const { data: meData, refetch: refetchMe } = useCurrentUserQuery();
  // BE Phase 2.7 added `two_factor_enabled` to `UserAuth` but the
  // current `/me` payload doesn't carry it yet (out-of-scope follow-
  // up). Treat absence as `false` so the FE renders the Enable CTA
  // by default; a 409 from `/2fa/enroll` is the authoritative signal
  // and the catch path handles it.
  const enabled = meData?.user.two_factor_enabled ?? false;

  const [flow, setFlow] = useState<FlowState>({ kind: 'idle' });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmDisable, setConfirmDisable] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [code, setCode] = useState('');

  async function handleStartEnroll() {
    setError(null);
    setSubmitting(true);
    try {
      const data = await enrollTwoFactorRequest();
      setFlow({ kind: 'enrolling', data });
    } catch (err) {
      setError(errorMessage(err, 'Failed to start 2FA enrollment'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerifyEnroll(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await verifyEnrollTwoFactorRequest(code.trim());
      setCode('');
      setFlow({ kind: 'showing-backup-codes', codes: res.backup_codes });
      await refetchMe();
    } catch (err) {
      setError(errorMessage(err, 'Invalid code — try again'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDisable() {
    setError(null);
    setSubmitting(true);
    try {
      await disableTwoFactorRequest(disablePassword);
      setDisablePassword('');
      setConfirmDisable(false);
      await refetchMe();
    } catch (err) {
      setError(errorMessage(err, 'Failed to disable 2FA'));
    } finally {
      setSubmitting(false);
    }
  }

  function handleDoneWithBackupCodes() {
    setFlow({ kind: 'idle' });
  }

  if (flow.kind === 'enrolling') {
    return (
      <EnrollingPanel
        data={flow.data}
        code={code}
        onCodeChange={setCode}
        onCancel={() => setFlow({ kind: 'idle' })}
        onSubmit={handleVerifyEnroll}
        submitting={submitting}
        error={error}
      />
    );
  }

  if (flow.kind === 'showing-backup-codes') {
    return (
      <BackupCodesPanel codes={flow.codes} onDone={handleDoneWithBackupCodes} />
    );
  }

  return (
    <div>
      {enabled ? (
        <EnabledIdlePanel
          onDisable={() => setConfirmDisable(true)}
          error={error}
        />
      ) : (
        <DisabledIdlePanel
          onEnable={handleStartEnroll}
          submitting={submitting}
          error={error}
        />
      )}

      <Modal
        open={confirmDisable}
        onClose={() => {
          if (!submitting) {
            setConfirmDisable(false);
            setDisablePassword('');
            setError(null);
          }
        }}
        title="Disable two-factor authentication?"
        size="sm"
        footer={
          <>
            <button
              type="button"
              onClick={() => {
                if (!submitting) {
                  setConfirmDisable(false);
                  setDisablePassword('');
                  setError(null);
                }
              }}
              disabled={submitting}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleDisable()}
              disabled={submitting || disablePassword.length === 0}
              className="inline-flex items-center justify-center rounded-md bg-danger-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-danger-700 focus-visible:ring-2 focus-visible:ring-danger-500 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
              data-testid="2fa-disable-confirm"
            >
              {submitting ? 'Disabling…' : 'Disable 2FA'}
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-3 text-sm">
          <p className="text-slate-700 dark:text-slate-200">
            Re-enter your password to confirm. Your account will sign
            in with just a password until you re-enable 2FA.
          </p>
          <label htmlFor="2fa-disable-password" className="form-label">
            Password
          </label>
          <input
            id="2fa-disable-password"
            type="password"
            autoComplete="current-password"
            value={disablePassword}
            onChange={(e) => setDisablePassword(e.target.value)}
            className="form-input"
            data-testid="2fa-disable-password"
          />
          {error && (
            <span className="form-error" role="alert">
              {error}
            </span>
          )}
        </div>
      </Modal>
    </div>
  );
}

function DisabledIdlePanel({
  onEnable,
  submitting,
  error,
}: {
  onEnable: () => void;
  submitting: boolean;
  error: string | null;
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Add a second step at sign-in using an authenticator app
        (Google Authenticator, 1Password, Authy, …). Your password
        alone won&rsquo;t be enough to access your account.
      </p>
      <div>
        <button
          type="button"
          onClick={onEnable}
          disabled={submitting}
          className="btn-primary !w-auto"
          data-testid="2fa-enable-button"
        >
          {submitting ? 'Starting…' : 'Enable two-factor authentication'}
        </button>
      </div>
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}

function EnabledIdlePanel({
  onDisable,
  error,
}: {
  onDisable: () => void;
  error: string | null;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="inline-block h-2 w-2 rounded-full bg-success-500"
        />
        <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
          Two-factor authentication is enabled.
        </p>
      </div>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        You&rsquo;ll be asked for a 6-digit code from your authenticator
        every time you sign in. Use a backup code if you lose access
        to your authenticator.
      </p>
      <div>
        <button
          type="button"
          onClick={onDisable}
          className="rounded-md border border-danger-300 bg-white px-4 py-2 text-sm font-medium text-danger-700 transition-colors hover:bg-danger-50 dark:border-danger-900/60 dark:bg-slate-900 dark:text-danger-300 dark:hover:bg-danger-950/30"
          data-testid="2fa-disable-button"
        >
          Disable two-factor authentication
        </button>
      </div>
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}

function EnrollingPanel({
  data,
  code,
  onCodeChange,
  onCancel,
  onSubmit,
  submitting,
  error,
}: {
  data: TwoFactorEnrollResponse;
  code: string;
  onCodeChange: (s: string) => void;
  onCancel: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  submitting: boolean;
  error: string | null;
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Add the account to your authenticator app, then enter the
        first 6-digit code to confirm.
      </p>
      <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
        <div>
          <div className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
            Add via authenticator
          </div>
          <a
            href={data.provisioning_uri}
            className="mt-1 inline-block text-sm font-medium text-accent-600 underline underline-offset-2 hover:text-accent-700 dark:text-accent-300 dark:hover:text-accent-200"
          >
            Open in authenticator app
          </a>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            On mobile, this opens your default authenticator with the
            account preloaded. On desktop, copy the secret below.
          </p>
        </div>
        <div>
          <div className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
            Manual entry (base32 secret)
          </div>
          <code
            data-testid="2fa-enroll-secret"
            className="mt-1 block break-all rounded-md border border-slate-200 bg-white px-3 py-2 font-mono text-sm tracking-wider text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            {data.secret}
          </code>
        </div>
      </div>
      <form onSubmit={onSubmit} className="grid gap-3">
        <div>
          <label htmlFor="2fa-enroll-code" className="form-label">
            First 6-digit code <span className="text-danger-600">*</span>
          </label>
          <input
            id="2fa-enroll-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => onCodeChange(e.target.value)}
            placeholder="123456"
            required
            className="form-input font-mono tracking-wider"
            data-testid="2fa-enroll-code"
          />
        </div>
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={submitting || code.trim() === ''}
            className="btn-primary !w-auto"
            data-testid="2fa-enroll-verify"
          >
            {submitting ? 'Verifying…' : 'Verify & enable'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="text-sm text-slate-500 underline-offset-2 hover:underline dark:text-slate-400"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

function BackupCodesPanel({
  codes,
  onDone,
}: {
  codes: string[];
  onDone: () => void;
}) {
  // Brand identity is reactive: when the BE rebrands, the downloaded
  // file header reflects the new product name on the next page load.
  const brandName = useBrandingQuery().data?.name ?? 'Aevum';
  function handleDownload() {
    const content = [
      `# ${brandName} — two-factor backup codes`,
      '# Each code is single-use. Store these somewhere safe.',
      '',
      ...codes,
      '',
    ].join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'personal-budget-2fa-backup-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-md border border-success-300 bg-success-50 px-3 py-2 text-sm text-success-800 dark:border-success-900/60 dark:bg-success-950/30 dark:text-success-200">
        Two-factor authentication is now enabled.
      </div>
      <div>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Save your backup codes
        </h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Each code can be used once if you lose access to your
          authenticator app. <strong>We won&rsquo;t show them again</strong> —
          download a copy or write them down before you leave this
          page.
        </p>
      </div>
      <ul
        className="grid grid-cols-2 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-3 dark:border-slate-800 dark:bg-slate-950/40"
        data-testid="2fa-backup-codes"
      >
        {codes.map((code) => (
          <li
            key={code}
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-center font-mono text-sm tracking-wider text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            {code}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleDownload}
          className="btn-primary !w-auto"
          data-testid="2fa-backup-download"
        >
          Download codes
        </button>
        <button
          type="button"
          onClick={onDone}
          className="text-sm text-slate-500 underline-offset-2 hover:underline dark:text-slate-400"
          data-testid="2fa-backup-done"
        >
          I&rsquo;ve saved them
        </button>
      </div>
    </div>
  );
}
