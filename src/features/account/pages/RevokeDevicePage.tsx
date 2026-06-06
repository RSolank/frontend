import { useMutation } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { revokeNewDeviceRequest } from '../../auth/api/newDevice';

type Outcome =
  | { kind: 'idle' }
  | { kind: 'working' }
  | { kind: 'success' }
  | { kind: 'invalid' }
  | { kind: 'error'; message: string };

interface ApiErrorShape {
  detail?: string;
  error?: string;
  status?: number;
}

// BE Phase 2.3 (T-new-device-otp) — unauthenticated landing for the
// one-click revoke link in the new-device intimation email. POSTs
// `/api/auth/new-device/revoke {token}`; 204 on success, 400 on
// bad/expired token. Idempotent: a second click against the same
// token still 204s (the BE swallows already-revoked devices).
//
// Auto-fires the POST on mount when the URL carries a token; with
// no token the page explains where the link comes from. The email's
// "this wasn't me" CTA is the only way to reach this page — the
// account-pending-deletion redirect doesn't route here.
export function RevokeDevicePage() {
  const [params] = useSearchParams();
  const token = useMemo(() => params.get('token') ?? '', [params]);
  const [outcome, setOutcome] = useState<Outcome>({ kind: 'idle' });

  const mutation = useMutation({
    mutationFn: (t: string) => revokeNewDeviceRequest(t),
    onSuccess: () => setOutcome({ kind: 'success' }),
    onError: (err: unknown) => {
      const e = err as ApiErrorShape;
      if (e.status === 400) {
        setOutcome({ kind: 'invalid' });
      } else {
        setOutcome({
          kind: 'error',
          message: e.detail || e.error || 'Failed to revoke this device.',
        });
      }
    },
  });

  useEffect(() => {
    if (!token || outcome.kind !== 'idle') return;
    setOutcome({ kind: 'working' });
    // `.mutate()` rather than `mutateAsync` so React Query's
    // `onError` is the only error sink — `void mutateAsync(token)`
    // would dangle the rejection and trip vitest's unhandled-
    // rejection guard on the 400-invalid path.
    mutation.mutate(token);
  }, [token, outcome.kind, mutation]);

  return (
    <div className="mx-auto max-w-xl px-4 py-10 sm:px-6">
      <div className="rounded-xl bg-white p-6 shadow-sm dark:bg-slate-900 dark:shadow-none dark:ring-1 dark:ring-slate-800">
        {!token && <NoTokenContent />}
        {token && outcome.kind === 'working' && (
          <p className="text-sm text-slate-700 dark:text-slate-200">
            Revoking this device…
          </p>
        )}
        {token && outcome.kind === 'success' && <Success />}
        {token && outcome.kind === 'invalid' && <Invalid />}
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
        Revoke a device
      </h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
        This page is reached from the one-click revoke link in the new-device
        sign-in email we send when you sign in from an unfamiliar device. Open
        that email and tap the revoke link to forget the device.
      </p>
      <Link
        to="/"
        className="text-accent-600 hover:text-accent-700 dark:text-accent-400 dark:hover:text-accent-300 mt-4 inline-flex text-sm font-medium"
      >
        Back to home
      </Link>
    </>
  );
}

function Success() {
  return (
    <>
      <h1 className="text-success-700 dark:text-success-300 text-xl font-semibold">
        Device revoked
      </h1>
      <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
        That device has been signed out and will need to verify again on its
        next sign-in. If you didn&rsquo;t authorize this sign-in, also{' '}
        <Link
          to="/login"
          className="text-accent-600 hover:text-accent-700 dark:text-accent-400 dark:hover:text-accent-300 font-medium"
        >
          change your password
        </Link>{' '}
        from a trusted device.
      </p>
    </>
  );
}

function Invalid() {
  return (
    <>
      <h1 className="text-danger-700 dark:text-danger-300 text-xl font-semibold">
        Link expired or invalid
      </h1>
      <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
        This revoke link is no longer valid. Revoke links are single-use and
        expire after the device verifies, becomes trusted, or is already
        revoked. Sign in from a trusted device and manage your devices under{' '}
        <Link
          to="/account/security"
          className="text-accent-600 hover:text-accent-700 dark:text-accent-400 dark:hover:text-accent-300 font-medium"
        >
          Account → Security
        </Link>
        .
      </p>
    </>
  );
}

function ErrorPanel({ message }: { message: string }) {
  return (
    <>
      <h1 className="text-danger-700 dark:text-danger-300 text-xl font-semibold">
        Something went wrong
      </h1>
      <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
        {message} Try refreshing, or contact support if it persists.
      </p>
    </>
  );
}
