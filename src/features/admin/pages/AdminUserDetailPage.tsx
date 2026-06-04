import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { useActivityCatalogQuery } from '../../../shared/api/activityCatalog';
import { useAdminGateQuery } from '../../../shared/api/adminGate';
import type { ApiError } from '../../../shared/api/apiClient';
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog';
import { SignalSettingsEditor } from '../../../shared/components/SignalSettingsEditor';
import { usePreferencesStore } from '../../../shared/state/preferences.store';
import { formatDate, formatDateTime } from '../../../shared/utils/dateUtils';
import {
  useForceLogoutAdminUserMutation,
  useLockAdminUserMutation,
  useUnlockAdminUserMutation,
} from '../api/mutations';
import {
  useAdminUserSignalSettingsQuery,
  useTuneAdminSignalCatalogMutation,
  useUpdateAdminUserSignalMutation,
} from '../api/signalSettings';
import {
  useAdminUserDetailQuery,
  type AdminActivityEvent,
  type AdminDeviceRow,
  type AdminSessionRow,
  type AdminUserDetail,
} from '../api/userDetail';
import { LockUserDialog } from '../components/LockUserDialog';

// Single-user admin detail — T-admin A3. Read-only in this phase;
// write actions (lock / force-logout) land in B1/B2 and slot into the
// header action bar. Sections render top-down; Activity is hidden when
// BE returns `null` (per-user feed not yet wired in the activity
// module). Lazy-loaded via `admin.routes.tsx`.

function NotFoundPanel() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          User not found
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          The requested user does not exist, is the SYSTEM bootstrap, or has
          been hard-purged. Hard-purged users live in the cemetery audit.
        </p>
        <Link
          to="/admin/users"
          className="mt-3 inline-flex text-sm font-medium text-accent-600 hover:text-accent-700 dark:text-accent-400 dark:hover:text-accent-300"
        >
          ← Back to user list
        </Link>
      </div>
    </div>
  );
}

function NotAvailablePanel() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="rounded-xl border border-danger-300 bg-danger-50/40 p-6 dark:border-danger-900/60 dark:bg-danger-950/20">
        <h1 className="text-lg font-semibold text-danger-700 dark:text-danger-300">
          Not available
        </h1>
        <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">
          The admin portal is only available to operators.
        </p>
        <Link
          to="/dashboard"
          className="mt-3 inline-flex text-sm font-medium text-accent-600 hover:text-accent-700 dark:text-accent-400 dark:hover:text-accent-300"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}

function StatusChip({
  tone,
  children,
}: {
  tone: 'success' | 'warning' | 'danger' | 'neutral';
  children: React.ReactNode;
}) {
  const tones = {
    success:
      'bg-success-100 text-success-800 dark:bg-success-950/40 dark:text-success-300',
    warning:
      'bg-warning-100 text-warning-800 dark:bg-warning-950/40 dark:text-warning-300',
    danger:
      'bg-danger-100 text-danger-800 dark:bg-danger-950/40 dark:text-danger-300',
    neutral:
      'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  } as const;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h2 className="mb-3 text-base font-semibold text-slate-900 dark:text-slate-100">
        {title}
      </h2>
      {children}
    </div>
  );
}

function KeyValue({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-slate-800 dark:text-slate-200">
        {children}
      </dd>
    </div>
  );
}

function IdentitySection({ user }: { user: AdminUserDetail }) {
  return (
    <Section title="Identity">
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KeyValue label="Email">{user.email}</KeyValue>
        <KeyValue label="Full name">{user.full_name}</KeyValue>
        <KeyValue label="Role">
          {user.role === 'admin' ? (
            <StatusChip tone="neutral">admin</StatusChip>
          ) : (
            <span className="text-slate-500 dark:text-slate-400">user</span>
          )}
        </KeyValue>
        <KeyValue label="Country">{user.country ?? '—'}</KeyValue>
        <KeyValue label="Currency">{user.currency ?? '—'}</KeyValue>
        <KeyValue label="Timezone">{user.timezone ?? '—'}</KeyValue>
      </dl>
    </Section>
  );
}

// Status precedence (most-severe wins):
//   pending deletion > admin-disabled (B1, recovery-proof) >
//   failed-login locked (OTP-recoverable) > active.
function statusTone(user: AdminUserDetail) {
  if (user.cemetery_status || user.deleted_at)
    return { tone: 'danger' as const, label: 'Pending deletion' };
  if (user.disabled_at)
    return { tone: 'danger' as const, label: 'Disabled' };
  if (user.locked_until)
    return { tone: 'warning' as const, label: 'Locked' };
  return { tone: 'success' as const, label: 'Active' };
}

function StatusSection({
  user,
  tz,
}: {
  user: AdminUserDetail;
  tz: string;
}) {
  const status = statusTone(user);
  return (
    <Section title="Status">
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KeyValue label="Account state">
          <StatusChip tone={status.tone}>{status.label}</StatusChip>
        </KeyValue>
        <KeyValue label="Two-factor">
          {user.two_factor_enabled ? (
            <StatusChip tone="success">on</StatusChip>
          ) : (
            <StatusChip tone="neutral">off</StatusChip>
          )}
        </KeyValue>
        <KeyValue label="Active sessions">{user.session_count}</KeyValue>
        <KeyValue label="Registered">
          {formatDate(user.registered_at, tz, { dateStyle: 'medium' })}
        </KeyValue>
        <KeyValue label="Last active">
          {user.last_active_at
            ? formatDateTime(user.last_active_at, tz)
            : '—'}
        </KeyValue>
        <KeyValue label="Lock until">
          {user.locked_until ?? '—'}
        </KeyValue>
        {user.disabled_at ? (
          <KeyValue label="Disabled since">
            {formatDateTime(user.disabled_at, tz)}
          </KeyValue>
        ) : null}
        {user.cemetery_status ? (
          <KeyValue label="Scheduled purge">
            {formatDateTime(user.cemetery_status.scheduled_purge_at, tz)}
          </KeyValue>
        ) : null}
      </dl>
    </Section>
  );
}

function SessionsSection({
  rows,
  tz,
}: {
  rows: AdminSessionRow[];
  tz: string;
}) {
  return (
    <Section title="Recent sessions">
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          No recent sessions.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
            <thead className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <tr>
                <th className="py-2 pr-3 text-left font-medium">Device</th>
                <th className="py-2 pr-3 text-left font-medium">IP</th>
                <th className="py-2 pr-3 text-left font-medium">Created</th>
                <th className="py-2 pr-3 text-left font-medium">Expires</th>
                <th className="py-2 pr-3 text-left font-medium">Locked</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.map((s) => (
                <tr key={s.session_id} className="text-slate-700 dark:text-slate-300">
                  <td className="py-2 pr-3">{s.device_summary || '—'}</td>
                  <td className="py-2 pr-3 font-mono text-xs">{s.ip_address}</td>
                  <td className="py-2 pr-3">{formatDateTime(s.created_at, tz)}</td>
                  <td className="py-2 pr-3">{formatDateTime(s.expires_at, tz)}</td>
                  <td className="py-2 pr-3">
                    {s.is_locked ? (
                      <StatusChip tone="danger">locked</StatusChip>
                    ) : (
                      <StatusChip tone="success">active</StatusChip>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

function DevicesSection({
  rows,
  tz,
}: {
  rows: AdminDeviceRow[];
  tz: string;
}) {
  return (
    <Section title="Known devices">
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          No known devices.
        </p>
      ) : (
        <ul className="space-y-2 text-sm">
          {rows.map((d) => (
            <li
              key={d.device_uid}
              className="flex flex-wrap items-baseline justify-between gap-2 rounded-md border border-slate-200 px-3 py-2 dark:border-slate-800"
            >
              <div>
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {d.label ?? `Device #${d.device_uid}`}
                </span>
                <code className="ml-2 text-xs text-slate-500 dark:text-slate-400">
                  {d.fingerprint.slice(0, 12)}…
                </code>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Last seen {formatDateTime(d.last_seen_at, tz)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function ActivitySection({
  events,
  tz,
}: {
  events: AdminActivityEvent[];
  tz: string;
}) {
  return (
    <Section title="Recent activity">
      {events.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          No recent events.
        </p>
      ) : (
        <ul className="space-y-2 text-sm">
          {events.map((e) => (
            <li
              key={e.event_id}
              className="flex flex-wrap items-baseline justify-between gap-2 rounded-md border border-slate-200 px-3 py-2 dark:border-slate-800"
            >
              <div>
                <span className="text-slate-800 dark:text-slate-200">
                  {e.summary}
                </span>
                <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
                  {e.kind}
                </span>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {formatDateTime(e.at, tz)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function apiErrorMessage(err: unknown, fallback: string): string {
  const e = err as ApiError;
  const detail = typeof e?.detail === 'string' ? e.detail : undefined;
  if (e?.status === 409) return detail ?? 'Already in the target state.';
  if (e?.status === 404) return detail ?? 'User not found.';
  return detail ?? e?.error ?? fallback;
}

function ActionBar({ user }: { user: AdminUserDetail }) {
  const userLabel = `${user.full_name} (${user.email})`;
  const isDisabled = user.disabled_at !== null;

  const lockMutation = useLockAdminUserMutation(user.user_id);
  const unlockMutation = useUnlockAdminUserMutation(user.user_id);
  const forceLogoutMutation = useForceLogoutAdminUserMutation(user.user_id);

  const [lockOpen, setLockOpen] = useState(false);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [forceLogoutOpen, setForceLogoutOpen] = useState(false);
  const [status, setStatus] = useState<
    { tone: 'success' | 'danger'; text: string } | null
  >(null);

  function doLock(reason: string | undefined) {
    lockMutation.mutate(reason, {
      onSuccess: () => {
        setLockOpen(false);
        setStatus({ tone: 'success', text: 'Account locked.' });
      },
      onError: (err) =>
        setStatus({ tone: 'danger', text: apiErrorMessage(err, 'Lock failed.') }),
    });
  }

  function doUnlock() {
    unlockMutation.mutate(undefined, {
      onSuccess: () => {
        setUnlockOpen(false);
        setStatus({ tone: 'success', text: 'Account unlocked.' });
      },
      onError: (err) =>
        setStatus({ tone: 'danger', text: apiErrorMessage(err, 'Unlock failed.') }),
    });
  }

  function doForceLogout() {
    forceLogoutMutation.mutate(undefined, {
      onSuccess: (resp) => {
        setForceLogoutOpen(false);
        setStatus({
          tone: 'success',
          text: `Logged out ${resp.terminated} session${resp.terminated === 1 ? '' : 's'}.`,
        });
      },
      onError: (err) =>
        setStatus({
          tone: 'danger',
          text: apiErrorMessage(err, 'Force-logout failed.'),
        }),
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {isDisabled ? (
        <button
          type="button"
          onClick={() => setUnlockOpen(true)}
          className="btn-primary !w-auto"
        >
          Unlock account
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setLockOpen(true)}
          className="inline-flex items-center justify-center rounded-md bg-danger-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-danger-700 focus-visible:ring-2 focus-visible:ring-danger-500 focus-visible:outline-none"
        >
          Lock account
        </button>
      )}
      <button
        type="button"
        onClick={() => setForceLogoutOpen(true)}
        disabled={user.session_count === 0}
        className="inline-flex items-center justify-center rounded-md border border-danger-300 bg-white px-4 py-2 text-sm font-semibold text-danger-700 transition-colors hover:bg-danger-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-danger-900/60 dark:bg-slate-900 dark:text-danger-300 dark:hover:bg-danger-950/40"
      >
        Force logout all sessions
      </button>
      {status ? (
        <span
          role="status"
          className={
            status.tone === 'success'
              ? 'text-sm text-success-700 dark:text-success-300'
              : 'text-sm text-danger-700 dark:text-danger-300'
          }
        >
          {status.text}
        </span>
      ) : null}

      <LockUserDialog
        open={lockOpen}
        userLabel={userLabel}
        busy={lockMutation.isPending}
        onConfirm={doLock}
        onClose={() => setLockOpen(false)}
      />
      <ConfirmDialog
        open={unlockOpen}
        title="Unlock account"
        message={`Re-enable ${userLabel}? They will be able to sign in again immediately.`}
        confirmLabel="Unlock account"
        intent="primary"
        busy={unlockMutation.isPending}
        onConfirm={doUnlock}
        onClose={() => setUnlockOpen(false)}
      />
      <ConfirmDialog
        open={forceLogoutOpen}
        title="Force-logout sessions"
        message={`Terminate every active session for ${userLabel}? They will be signed out on their next request.`}
        confirmLabel="Force logout"
        intent="danger"
        busy={forceLogoutMutation.isPending}
        onConfirm={doForceLogout}
        onClose={() => setForceLogoutOpen(false)}
      />
    </div>
  );
}

function StatsSection({ stats }: { stats: AdminUserDetail['stats'] }) {
  return (
    <Section title="Activity stats">
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KeyValue label="Transactions">{stats.total_transactions}</KeyValue>
        <KeyValue label="Budgets">{stats.total_budgets}</KeyValue>
        <KeyValue label="Beneficiaries">
          {stats.total_beneficiaries}
        </KeyValue>
        <KeyValue label="Active recurring">{stats.active_recurring}</KeyValue>
      </dl>
    </Section>
  );
}

function SignalSettingsSection({ userId }: { userId: number }) {
  const catalog = useActivityCatalogQuery(true);
  const settings = useAdminUserSignalSettingsQuery(userId, true);
  const toggleMutation = useUpdateAdminUserSignalMutation(userId);
  const tuneMutation = useTuneAdminSignalCatalogMutation();
  const [status, setStatus] = useState<string | null>(null);

  function handleToggle(kind: string, enabled: boolean) {
    setStatus(null);
    toggleMutation.mutate(
      { kind, enabled },
      {
        onError: (err) => {
          const e = err as unknown as ApiError;
          const detail = typeof e?.detail === 'string' ? e.detail : undefined;
          setStatus(detail ?? e?.error ?? 'Toggle failed.');
        },
      }
    );
  }

  function handleTune(
    kind: string,
    patch: { priority?: number; rank_order?: number; system_enabled?: boolean }
  ) {
    setStatus(null);
    tuneMutation.mutate(
      { kind, patch },
      {
        onError: (err) => {
          const e = err as unknown as ApiError;
          const detail = typeof e?.detail === 'string' ? e.detail : undefined;
          setStatus(detail ?? e?.error ?? 'Tune failed.');
        },
      }
    );
  }

  return (
    <Section title="Signal settings">
      <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
        Toggle which feed kinds reach this user. System-wide tunables
        (priority / rank / platform enable) live under each row&apos;s
        advanced disclosure.
      </p>
      {status ? (
        <p
          role="status"
          className="mb-3 text-sm text-danger-700 dark:text-danger-300"
        >
          {status}
        </p>
      ) : null}
      {settings.isLoading || catalog.isLoading ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Loading…
        </p>
      ) : (
        <SignalSettingsEditor
          catalog={catalog.data}
          disabled={settings.data?.disabled ?? []}
          viewerRole="admin"
          onToggle={handleToggle}
          onTune={handleTune}
        />
      )}
    </Section>
  );
}

export function AdminUserDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const numericId = Number(userId);
  const { data: isAdmin, isLoading: gateLoading } = useAdminGateQuery();
  const operatorTz = usePreferencesStore((s) => s.timezone);
  const validId = Number.isFinite(numericId) && numericId > 0;

  const { data, isLoading, error } = useAdminUserDetailQuery(
    numericId,
    isAdmin === true && validId
  );

  if (gateLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 text-sm text-slate-500 dark:text-slate-400">
        Checking access…
      </div>
    );
  }

  if (!isAdmin) {
    return <NotAvailablePanel />;
  }

  if (!validId) {
    return <NotFoundPanel />;
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 text-sm text-slate-500 dark:text-slate-400">
        Loading user…
      </div>
    );
  }

  if (error && error.status === 404) {
    return <NotFoundPanel />;
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="rounded-md border border-danger-300 bg-danger-50/40 p-4 text-sm text-danger-700 dark:border-danger-900/60 dark:bg-danger-950/20 dark:text-danger-300">
          Failed to load user.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-8">
      <header>
        <Link
          to="/admin/users"
          className="text-xs font-medium text-slate-500 hover:text-accent-600 dark:text-slate-400 dark:hover:text-accent-400"
        >
          ← Back to user list
        </Link>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
              {data.full_name}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {data.email}
            </p>
          </div>
          <ActionBar user={data} />
        </div>
      </header>

      <IdentitySection user={data} />
      <StatusSection user={data} tz={operatorTz} />
      <SessionsSection rows={data.recent_sessions} tz={operatorTz} />
      <DevicesSection rows={data.recent_known_devices} tz={operatorTz} />
      {data.recent_activity ? (
        <ActivitySection events={data.recent_activity} tz={operatorTz} />
      ) : null}
      <StatsSection stats={data.stats} />
      <SignalSettingsSection userId={data.user_id} />
    </div>
  );
}
