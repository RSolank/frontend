import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { Modal } from '../../../shared/components/Modal';
import { userKeys } from '../../users/api/keys';
import { resetMyDataRequest } from '../../users/api/mutations';

interface ApiErrorShape {
  detail?: string;
  error?: string;
  status?: number;
}

// BE Phase 2.15 (T-data-reset, `9668f16`) — "clean restart" surface.
// Lives above the Danger Zone on /account/privacy as a warning-tone
// card so the lesser severity reads at a glance: account, login,
// and preferences stay; every domain row is wiped + reseeded; the
// current session is preserved.
export function ResetZone() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (pw: string) => resetMyDataRequest(pw),
    onSuccess: (resp) => {
      // Seed the post-reset stats into the cache so the Profile
      // card flips to zeros without a refetch round-trip; then
      // invalidate every other domain query so cards / pages
      // refetch on next view.
      qc.setQueryData(userKeys.stats(), resp);
      void qc.invalidateQueries();
      setOpen(false);
      setPassword('');
      setError(null);
      setStatus('Your data was reset. Starting fresh.');
    },
    onError: (err: unknown) => {
      const e = err as ApiErrorShape;
      if (e.status === 403) {
        setError('Incorrect password.');
      } else {
        setError(e.detail || e.error || 'Failed to reset data.');
      }
    },
  });

  function handleClose() {
    if (mutation.isPending) return;
    setOpen(false);
    setPassword('');
    setError(null);
  }

  function handleOpen() {
    setStatus(null);
    setOpen(true);
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
    <div className="border-warning-300 bg-warning-50/40 dark:border-warning-900/60 dark:bg-warning-950/20 rounded-xl border p-6">
      <h2 className="text-warning-700 dark:text-warning-300 text-lg font-semibold">
        Reset zone
      </h2>
      <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
        Wipe all your data and start fresh — your{' '}
        <strong>account, login, and preferences</strong> stay. Transactions,
        budgets, tags, beneficiaries, recurring templates, statement uploads,
        and bills are removed.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleOpen}
          className="bg-warning-600 hover:bg-warning-700 focus-visible:ring-warning-500 inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold text-white transition-colors focus-visible:ring-2 focus-visible:outline-none"
          data-testid="reset-zone-trigger"
        >
          Reset my data…
        </button>
        {status ? (
          <span
            role="status"
            data-testid="reset-zone-status"
            className="text-success-700 dark:text-success-300 text-sm"
          >
            {status}
          </span>
        ) : null}
      </div>

      <Modal
        open={open}
        onClose={handleClose}
        title="Reset your data"
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
              form="reset-zone-form"
              disabled={mutation.isPending || !password}
              className="bg-warning-600 hover:bg-warning-700 inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              data-testid="reset-zone-confirm"
            >
              {mutation.isPending ? 'Resetting…' : 'Reset my data'}
            </button>
          </>
        }
      >
        <form
          id="reset-zone-form"
          onSubmit={handleSubmit}
          className="grid gap-3"
        >
          <p className="text-sm text-slate-700 dark:text-slate-200">
            Re-enter your password to confirm. This wipes every transaction,
            budget, tag, beneficiary, recurring template, statement upload, and
            bill from your account. Your account, login, and preferences are
            kept.
          </p>
          <p className="text-warning-700 dark:text-warning-300 text-sm font-medium">
            This action cannot be undone.
          </p>
          <label htmlFor="reset-zone-password" className="form-label">
            Password
          </label>
          <input
            id="reset-zone-password"
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
