import { useState } from 'react';

import { useBrandingQuery } from '../../../shared/api/branding';
import { Modal } from '../../../shared/components/Modal';
import { QrCode } from '../../../shared/components/QrCode';
import { useSecurityStatusQuery } from '../../auth/api/security';
import {
  disableTwoFactorRequest,
  enrollTwoFactorRequest,
  verifyEnrollTwoFactorRequest,
  type TwoFactorEnrollResponse,
} from '../../auth/api/twoFactor';

// BE Phase 2.7 (T-2fa-enroll). Two-factor authentication surface on
// `/account/security`.
//
// Three flow states:
//   - **idle** — initial state. Renders the Enable CTA (off) or
//     Disable card (on).
//   - **enrolling** — `/2fa/enroll` succeeded; FE renders the
//     `provisioning_uri` as a scannable QR (plus a deep link) and the
//     base32 `secret` for manual entry, and prompts for the first TOTP
//     code.
//   - **showing-backup-codes** — `/2fa/verify-enroll` succeeded; FE
//     shows the 10 one-time backup codes WITH a Download button.
//     BE only returns these once; lose them, lose them.
//
// The provisioning URI is rendered via the shared <QrCode> primitive
// (which lazy-loads qrcode.react into its own chunk). No `caption` is
// passed: the otpauth:// URI carries the TOTP secret, so it is never
// printed as copyable text — the base32 secret below is the intended
// manual-entry path.
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

// Brand identity is reactive: when the BE rebrands, the downloaded file header
// + filename reflect the new product name on the next page load. No hardcoded
// fallback — the header reads "Backup codes" without a brand prefix on the rare
// first-ever-load case before the branding query resolves.
function downloadBackupCodes(codes: string[], brandName: string) {
  const headerPrefix = brandName ? `${brandName} — ` : '';
  const content = [
    `# ${headerPrefix}two-factor backup codes`,
    '# Each code is single-use. Store these somewhere safe.',
    '',
    ...codes,
    '',
  ].join('\n');
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const slug = brandName
    ? `${brandName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-`
    : '';
  a.download = `${slug}2fa-backup-codes.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

export function TwoFactorSection() {
  // Auth-owned account-protection snapshot — `GET /api/v1/auth/security`
  // (BE `auth.security-status`). `UserAuth` security state lives on the
  // auth route, not `/me`, so the profile/auth domain split stays clean
  // across FE + BE. The Enable CTA reads `two_factor_enabled` straight
  // from this snapshot; `backup_codes_remaining` powers the running
  // count surfaced after enrollment.
  const { data: security, refetch: refetchSecurity } = useSecurityStatusQuery();
  const enabled = security?.two_factor_enabled ?? false;
  const backupCodesRemaining = security?.backup_codes_remaining ?? 0;
  const brandName = useBrandingQuery().data?.name ?? '';

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
    // Only reachable from the `enrolling` panel — the enroll_token
    // lives in the flow state captured at `/2fa/enroll` time and
    // rides back to `/2fa/verify-enroll` here.
    if (flow.kind !== 'enrolling') return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await verifyEnrollTwoFactorRequest(
        flow.data.enroll_token,
        code.trim()
      );
      setCode('');
      setFlow({ kind: 'showing-backup-codes', codes: res.backup_codes });
      await refetchSecurity();
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
      await refetchSecurity();
    } catch (err) {
      setError(errorMessage(err, 'Failed to disable 2FA'));
    } finally {
      setSubmitting(false);
    }
  }

  function handleDoneWithBackupCodes() {
    setFlow({ kind: 'idle' });
  }

  function cancelEnroll() {
    if (submitting) return;
    setFlow({ kind: 'idle' });
    setCode('');
    setError(null);
  }

  return (
    <div>
      {enabled ? (
        <EnabledIdlePanel
          onDisable={() => setConfirmDisable(true)}
          backupCodesRemaining={backupCodesRemaining}
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
              className="bg-danger-600 hover:bg-danger-700 focus-visible:ring-danger-500 inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold text-white transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
              data-testid="2fa-disable-confirm"
            >
              {submitting ? 'Disabling…' : 'Disable 2FA'}
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-3 text-sm">
          <p className="text-slate-700 dark:text-slate-200">
            Re-enter your password to confirm. Your account will sign in with
            just a password until you re-enable 2FA.
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

      {/* Enroll → verify. Opened by the Enable CTA (which mints the secret
          on demand via /2fa/enroll) — never on page load. */}
      {flow.kind === 'enrolling' && (
        <EnrollModal
          data={flow.data}
          code={code}
          onCodeChange={setCode}
          onCancel={cancelEnroll}
          onSubmit={handleVerifyEnroll}
          submitting={submitting}
          error={error}
        />
      )}

      {/* Backup codes — one-time reveal in a non-dismissible modal. */}
      {flow.kind === 'showing-backup-codes' && (
        <BackupCodesModal
          codes={flow.codes}
          brandName={brandName}
          onDone={handleDoneWithBackupCodes}
        />
      )}
    </div>
  );
}

// Enroll + verify modal. CTAs live in the footer (modal-CTA convention); the
// submit button targets the body `<form id>` by id to keep Enter-to-submit.
function EnrollModal({
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
    <Modal
      open
      onClose={onCancel}
      title="Set up your authenticator app"
      size="md"
      footer={
        <>
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="twofa-enroll-form"
            disabled={submitting || code.trim() === ''}
            className="btn-primary !w-auto"
            data-testid="2fa-enroll-verify"
          >
            {submitting ? 'Verifying…' : 'Verify & enable'}
          </button>
        </>
      }
    >
      <EnrollingPanel
        data={data}
        code={code}
        onCodeChange={onCodeChange}
        onSubmit={onSubmit}
        error={error}
      />
    </Modal>
  );
}

// One-time backup-codes reveal. Non-dismissible (no close X, Escape/overlay
// blocked) so the codes can't be lost to a stray dismiss — closes only via the
// explicit "I've saved them" action.
function BackupCodesModal({
  codes,
  brandName,
  onDone,
}: {
  codes: string[];
  brandName: string;
  onDone: () => void;
}) {
  return (
    <Modal
      open
      onClose={onDone}
      dismissible={false}
      title="Save your backup codes"
      size="md"
      footer={
        <>
          <button
            type="button"
            onClick={() => downloadBackupCodes(codes, brandName)}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            data-testid="2fa-backup-download"
          >
            Download codes
          </button>
          <button
            type="button"
            onClick={onDone}
            className="btn-primary !w-auto"
            data-testid="2fa-backup-done"
          >
            I&rsquo;ve saved them
          </button>
        </>
      }
    >
      <BackupCodesPanel codes={codes} />
    </Modal>
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
        Add a second step at sign-in using an authenticator app (Google
        Authenticator, 1Password, Authy, …). Your password alone won&rsquo;t be
        enough to access your account.
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

function backupClassFor(exhausted: boolean, low: boolean): string {
  if (exhausted)
    return 'text-sm font-medium text-danger-700 dark:text-danger-300';
  if (low) return 'text-sm font-medium text-warning-700 dark:text-warning-300';
  return 'text-sm text-slate-500 dark:text-slate-400';
}

function EnabledIdlePanel({
  onDisable,
  backupCodesRemaining,
  error,
}: {
  onDisable: () => void;
  backupCodesRemaining: number;
  error: string | null;
}) {
  // BE issues 10 codes on enroll + delete-on-use; surface the running
  // count + warn (warning tone) when ≤ 3 remain so the user knows to
  // re-enroll or regenerate before getting locked out.
  const low = backupCodesRemaining > 0 && backupCodesRemaining <= 3;
  const exhausted = backupCodesRemaining === 0;
  const backupClass = backupClassFor(exhausted, low);
  const noun = backupCodesRemaining === 1 ? 'code' : 'codes';
  const backupCopy = exhausted
    ? 'No backup codes remaining — disable and re-enable 2FA to issue a fresh batch.'
    : `${backupCodesRemaining} backup ${noun} remaining.`;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="bg-success-500 inline-block h-2 w-2 rounded-full"
        />
        <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
          Two-factor authentication is enabled.
        </p>
      </div>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        You&rsquo;ll be asked for a 6-digit code from your authenticator every
        time you sign in. Use a backup code if you lose access to your
        authenticator.
      </p>
      <p className={backupClass} data-testid="2fa-backup-codes-remaining">
        {backupCopy}
      </p>
      <div>
        <button
          type="button"
          onClick={onDisable}
          className="border-danger-300 text-danger-700 hover:bg-danger-50 dark:border-danger-900/60 dark:text-danger-300 dark:hover:bg-danger-950/30 rounded-md border bg-white px-4 py-2 text-sm font-medium transition-colors dark:bg-slate-900"
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
  onSubmit,
  error,
}: {
  data: TwoFactorEnrollResponse;
  code: string;
  onCodeChange: (s: string) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  error: string | null;
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Add the account to your authenticator app, then enter the first 6-digit
        code to confirm.
      </p>
      <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
        <div>
          <div className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
            Add via authenticator
          </div>
          <QrCode
            value={data.provisioning_uri}
            label="Scan with your authenticator app"
            className="mt-2 flex justify-center"
          />
          <a
            href={data.provisioning_uri}
            className="text-accent-600 hover:text-accent-700 dark:text-accent-300 dark:hover:text-accent-200 mt-2 inline-block text-sm font-medium underline underline-offset-2"
          >
            Open in authenticator app
          </a>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Scan the QR with your authenticator app. On mobile, tap the link to
            open your default authenticator with the account preloaded. On
            desktop, copy the secret below.
          </p>
        </div>
        <div>
          <div className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
            Manual entry (base32 secret)
          </div>
          <code
            data-testid="2fa-enroll-secret"
            className="mt-1 block rounded-md border border-slate-200 bg-white px-3 py-2 font-mono text-sm tracking-wider break-all text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            {data.secret}
          </code>
        </div>
      </div>
      {/* The submit button lives in the modal footer (per the modal-CTA
          convention) and targets this form by id, preserving Enter-to-submit. */}
      <form id="twofa-enroll-form" onSubmit={onSubmit} className="grid gap-3">
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
      </form>
    </div>
  );
}

function BackupCodesPanel({ codes }: { codes: string[] }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="border-success-300 bg-success-50 text-success-800 dark:border-success-900/60 dark:bg-success-950/30 dark:text-success-200 rounded-md border px-3 py-2 text-sm">
        Two-factor authentication is now enabled.
      </div>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Each code can be used once if you lose access to your authenticator app.{' '}
        <strong>We won&rsquo;t show them again</strong> — download a copy or write
        them down before you close this dialog.
      </p>
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
    </div>
  );
}
