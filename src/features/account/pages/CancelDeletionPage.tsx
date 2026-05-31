import { useMutation } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { cancelDeletionRequest } from '../../users/api/mutations';

type Outcome =
  | { kind: 'idle' }
  | { kind: 'working' }
  | { kind: 'success' }
  | { kind: 'expired' }
  | { kind: 'purged' }
  | { kind: 'error'; message: string };

interface ApiErrorShape {
  detail?: string;
  error?: string;
  status?: number;
}

// Unauthenticated route that:
//   (a) lands the email's "Cancel deletion" link — `?token=<opaque>`
//       → POST `/api/users/me/delete/cancel`. 200 reactivates the
//       account; 400 means bad/expired token; 410 means the BE
//       already purged.
//   (b) handles the in-app 403 ACCOUNT_PENDING_DELETION interceptor
//       redirect — no token in the URL, so we render the
//       informational copy explaining the email + 14-day window.
export function CancelDeletionPage() {
  const [params] = useSearchParams();
  const token = useMemo(() => params.get('token') ?? '', [params]);
  const [outcome, setOutcome] = useState<Outcome>({ kind: 'idle' });

  const mutation = useMutation({
    mutationFn: (t: string) => cancelDeletionRequest(t),
    onSuccess: () => setOutcome({ kind: 'success' }),
    onError: (err: unknown) => {
      const e = err as ApiErrorShape;
      if (e.status === 400) {
        setOutcome({ kind: 'expired' });
      } else if (e.status === 410) {
        setOutcome({ kind: 'purged' });
      } else {
        setOutcome({
          kind: 'error',
          message: e.detail || e.error || 'Failed to cancel deletion.',
        });
      }
    },
  });

  // Auto-fire the cancel POST when the user lands with a token. No
  // confirm step — the email link IS the confirmation.
  useEffect(() => {
    if (!token || outcome.kind !== 'idle') return;
    setOutcome({ kind: 'working' });
    void mutation.mutateAsync(token);
  }, [token, outcome.kind, mutation]);

  return (
    <div className="mx-auto max-w-xl px-4 py-10 sm:px-6">
      <div className="rounded-xl bg-white p-6 shadow-sm dark:bg-slate-900 dark:shadow-none dark:ring-1 dark:ring-slate-800">
        {!token && <NoTokenContent />}
        {token && outcome.kind === 'working' && (
          <p className="text-sm text-slate-700 dark:text-slate-200">
            Cancelling deletion…
          </p>
        )}
        {token && outcome.kind === 'success' && (
          <Success />
        )}
        {token && outcome.kind === 'expired' && (
          <Expired />
        )}
        {token && outcome.kind === 'purged' && (
          <Purged />
        )}
        {token && outcome.kind === 'error' && (
          <ErrorPanel message={outcome.message} />
        )}
      </div>
    </div>
  );
}

function NoTokenContent() {
  return (
    <>
      <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
        Your account is scheduled for deletion
      </h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
        We&rsquo;ve sent a cancel link to your email. You have{' '}
        <strong>14 days</strong> from when you scheduled the deletion
        to reactivate. After that, your data is permanently removed —
        bills and taxation records are anonymised so committee
        history stays intact.
      </p>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
        Can&rsquo;t find the email? Check spam / promotions.
      </p>
      <Link
        to="/"
        className="mt-4 inline-flex text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
      >
        Back to home
      </Link>
    </>
  );
}

function Success() {
  return (
    <>
      <h1 className="text-xl font-semibold text-emerald-700 dark:text-emerald-300">
        Account reactivated
      </h1>
      <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
        Welcome back. Your data is intact and you can sign in again.
      </p>
      <Link
        to="/login"
        className="mt-4 inline-flex text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
      >
        Go to sign-in
      </Link>
    </>
  );
}

function Expired() {
  return (
    <>
      <h1 className="text-xl font-semibold text-rose-700 dark:text-rose-300">
        Link expired or invalid
      </h1>
      <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
        This cancel link is no longer valid. Cancel links are
        single-use and expire after 14 days. If you still want to
        keep your account, contact support.
      </p>
    </>
  );
}

function Purged() {
  return (
    <>
      <h1 className="text-xl font-semibold text-rose-700 dark:text-rose-300">
        Account already removed
      </h1>
      <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
        The 14-day window has elapsed and your data has been
        permanently deleted. You&rsquo;ll need to register a new
        account.
      </p>
      <Link
        to="/register"
        className="mt-4 inline-flex text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
      >
        Register
      </Link>
    </>
  );
}

function ErrorPanel({ message }: { message: string }) {
  return (
    <>
      <h1 className="text-xl font-semibold text-rose-700 dark:text-rose-300">
        Something went wrong
      </h1>
      <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
        {message} Try refreshing, or contact support if it persists.
      </p>
    </>
  );
}
