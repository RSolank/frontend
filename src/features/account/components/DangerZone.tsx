import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';

import { Modal } from '../../../shared/components/Modal';
import { deleteAccountRequest } from '../../users/api/mutations';

interface ApiErrorShape {
  detail?: string;
  error?: string;
  status?: number;
}

// Hard logout: drop tokens locally and bounce to landing. The BE
// already invalidated every session, but the FE token cache lives
// independently in localStorage and would let us linger on a stale
// view for one more render. Reload via assignment so React state
// resets cleanly.
function hardLogoutToLanding(): void {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  if (typeof window !== 'undefined') {
    window.location.href = '/';
  }
}

// Danger Zone card on Account / Privacy. Two-step delete: open the
// confirm modal, re-enter the password, POST `/api/users/me/delete`.
// On success the BE drops every session — we hard-logout and bounce
// to the landing page, which carries a banner explaining the 14-day
// cancel window.
export function DangerZone() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (pw: string) => deleteAccountRequest(pw),
    onSuccess: () => {
      // Carry a one-shot banner across the redirect via
      // sessionStorage. The HomePage reads + clears it.
      try {
        sessionStorage.setItem('pba.account-pending-deletion', '1');
      } catch {
        // sessionStorage may be unavailable (private mode); banner
        // simply won't show — the email still arrives.
      }
      hardLogoutToLanding();
    },
    onError: (err: unknown) => {
      const e = err as ApiErrorShape;
      if (e.status === 403) {
        setError('Incorrect password.');
      } else {
        setError(e.detail || e.error || 'Failed to schedule deletion.');
      }
    },
  });

  function handleClose() {
    if (mutation.isPending) return;
    setOpen(false);
    setPassword('');
    setError(null);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    // `.mutate()` (not `.mutateAsync`) so the rejection routes
    // exclusively through `onError` — no dangling unhandled promise
    // when the password is wrong.
    mutation.mutate(password);
  }

  return (
    <div className="rounded-xl border border-rose-300 bg-rose-50/40 p-6 dark:border-rose-900/60 dark:bg-rose-950/20">
      <h2 className="text-lg font-semibold text-rose-700 dark:text-rose-300">
        Danger zone
      </h2>
      <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
        Schedule your account for deletion. You&rsquo;ll have{' '}
        <strong>14 days</strong> to cancel from the link we&rsquo;ll
        email you. After that, your data is permanently removed —
        bills and taxation records are anonymised so committee
        history stays intact.
      </p>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 inline-flex items-center justify-center rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-rose-700 focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:outline-none"
        data-testid="danger-zone-delete"
      >
        Delete account…
      </button>

      <Modal
        open={open}
        onClose={handleClose}
        title="Delete account"
        size="sm"
        footer={
          <>
            <button
              type="button"
              onClick={handleClose}
              disabled={mutation.isPending}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="delete-account-form"
              disabled={mutation.isPending || !password}
              className="inline-flex items-center justify-center rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
              data-testid="danger-zone-confirm"
            >
              {mutation.isPending ? 'Scheduling…' : 'Schedule deletion'}
            </button>
          </>
        }
      >
        <form id="delete-account-form" onSubmit={handleSubmit} className="grid gap-3">
          <p className="text-sm text-slate-700 dark:text-slate-200">
            Re-enter your password to confirm. You can cancel the
            deletion any time in the next 14 days via the link
            we&rsquo;ll email you.
          </p>
          <label htmlFor="danger-zone-password" className="form-label">
            Password
          </label>
          <input
            id="danger-zone-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="form-input"
            required
          />
          {error && (
            <div role="alert" className="form-error">
              {error}
            </div>
          )}
        </form>
      </Modal>
    </div>
  );
}
