import { useState } from 'react';
import { Link } from 'react-router-dom';

import { useAdminGateQuery } from '../../../shared/api/adminGate';
import { useDebouncedValue } from '../../../shared/hooks/useDebouncedValue';
import { usePreferencesStore } from '../../../shared/state/preferences.store';
import { formatDate } from '../../../shared/utils/dateUtils';
import { useAdminUsersInfiniteQuery, type AdminUserRow } from '../api/users';

// User inventory — T-admin A2. Sectioned list backed by the cursor-
// paginated `GET /api/v1/admin/users` endpoint. Search + soft-delete
// toggle are URL-state-free in v1 (kept local) — admins typically
// poke around in a single session; deep-link sharing is a B-phase
// concern. Click-through navigates to `/admin/users/:id` (rendered
// by A3 when it lands).
//
// Lazy-loaded via `admin.routes.tsx` so the table + infinite-query
// machinery stays out of the first-paint chunk.

interface StatusChip {
  label: string;
  tone: 'success' | 'warning' | 'danger' | 'neutral';
}

// Status precedence (most-severe wins):
//   pending deletion > admin-disabled > failed-login locked > active.
// `disabled_at` is recovery-proof (B1); `locked_until` is the
// OTP-recoverable rolling lock from failed logins.
function deriveStatus(user: AdminUserRow): StatusChip {
  if (user.deleted_at) {
    return { label: 'Pending deletion', tone: 'danger' };
  }
  if (user.disabled_at) {
    return { label: 'Disabled', tone: 'danger' };
  }
  if (user.locked_until) {
    return { label: 'Locked', tone: 'warning' };
  }
  return { label: 'Active', tone: 'success' };
}

const TONE_CLASSES: Record<StatusChip['tone'], string> = {
  success:
    'bg-success-100 text-success-800 dark:bg-success-950/40 dark:text-success-300',
  warning:
    'bg-warning-100 text-warning-800 dark:bg-warning-950/40 dark:text-warning-300',
  danger:
    'bg-danger-100 text-danger-800 dark:bg-danger-950/40 dark:text-danger-300',
  neutral: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
};

function StatusBadge({ chip }: { chip: StatusChip }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TONE_CLASSES[chip.tone]}`}
    >
      {chip.label}
    </span>
  );
}

function dateOrDash(iso: string | null, tz: string): string {
  if (!iso) return '—';
  // Renders in the *operator's* tz (the admin viewer), not the
  // target user's — admin surfaces consistently take the operator
  // viewpoint.
  return formatDate(iso, tz, { dateStyle: 'medium' });
}

interface UserTableProps {
  rows: AdminUserRow[];
  isLoading: boolean;
  emptyHint: string;
  operatorTz: string;
}

function UserTable({ rows, isLoading, emptyHint, operatorTz }: UserTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
        <thead className="bg-slate-50 text-xs tracking-wider text-slate-500 uppercase dark:bg-slate-950/40 dark:text-slate-400">
          <tr>
            <th scope="col" className="px-4 py-2 text-left font-medium">
              Email
            </th>
            <th scope="col" className="px-4 py-2 text-left font-medium">
              Name
            </th>
            <th scope="col" className="px-4 py-2 text-left font-medium">
              Role
            </th>
            <th scope="col" className="px-4 py-2 text-left font-medium">
              Registered
            </th>
            <th scope="col" className="px-4 py-2 text-left font-medium">
              Last active
            </th>
            <th scope="col" className="px-4 py-2 text-left font-medium">
              Status
            </th>
            <th scope="col" className="px-4 py-2 text-left font-medium">
              2FA
            </th>
            <th scope="col" className="px-4 py-2 text-right font-medium">
              Sessions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {!isLoading && rows.length === 0 ? (
            <tr>
              <td
                colSpan={8}
                className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400"
              >
                {emptyHint}
              </td>
            </tr>
          ) : null}
          {rows.map((u) => (
            <tr
              key={u.user_id}
              className="hover:bg-accent-50/60 dark:hover:bg-accent-950/30 cursor-pointer text-slate-700 dark:text-slate-300"
            >
              <td className="px-4 py-2">
                <Link
                  to={`/admin/users/${u.user_id}`}
                  className="text-accent-600 dark:text-accent-400 hover:underline"
                >
                  {u.email}
                </Link>
              </td>
              <td className="px-4 py-2">{u.full_name}</td>
              <td className="px-4 py-2">
                {u.role === 'admin' ? (
                  <span className="bg-accent-100 text-accent-800 dark:bg-accent-950/40 dark:text-accent-300 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium">
                    admin
                  </span>
                ) : (
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    user
                  </span>
                )}
              </td>
              <td className="px-4 py-2">
                {dateOrDash(u.registered_at, operatorTz)}
              </td>
              <td className="px-4 py-2">
                {dateOrDash(u.last_active_at, operatorTz)}
              </td>
              <td className="px-4 py-2">
                <StatusBadge chip={deriveStatus(u)} />
              </td>
              <td className="px-4 py-2 text-xs">
                {u.two_factor_enabled ? (
                  <span className="text-success-700 dark:text-success-400">
                    on
                  </span>
                ) : (
                  <span className="text-slate-400 dark:text-slate-500">
                    off
                  </span>
                )}
              </td>
              <td className="px-4 py-2 text-right tabular-nums">
                {u.session_count}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AdminUsersPage() {
  const { data: isAdmin, isLoading: gateLoading } = useAdminGateQuery();
  const operatorTz = usePreferencesStore((s) => s.timezone);
  const [rawQuery, setRawQuery] = useState('');
  const debouncedQuery = useDebouncedValue(rawQuery, 300);
  const [includeDeleted, setIncludeDeleted] = useState(false);

  const {
    data,
    isLoading,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error,
  } = useAdminUsersInfiniteQuery(
    { q: debouncedQuery, include_deleted: includeDeleted },
    isAdmin === true
  );

  if (gateLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 text-sm text-slate-500 dark:text-slate-400">
        Checking access…
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="border-danger-300 bg-danger-50/40 dark:border-danger-900/60 dark:bg-danger-950/20 rounded-xl border p-6">
          <h1 className="text-danger-700 dark:text-danger-300 text-lg font-semibold">
            Not available
          </h1>
          <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">
            The admin portal is only available to operators.
          </p>
          <Link
            to="/dashboard"
            className="text-accent-600 hover:text-accent-700 dark:text-accent-400 dark:hover:text-accent-300 mt-3 inline-flex text-sm font-medium"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  const rows = data?.pages.flatMap((p) => p.users) ?? [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link
            to="/admin"
            className="hover:text-accent-600 dark:hover:text-accent-400 text-xs font-medium text-slate-500 dark:text-slate-400"
          >
            ← Admin tools
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">
            Users
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Operator inventory of every non-SYSTEM account.
          </p>
        </div>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          aria-label="Search users by email or name"
          placeholder="Search by email or name…"
          value={rawQuery}
          onChange={(e) => setRawQuery(e.target.value)}
          className="form-input max-w-md"
        />
        <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
          <input
            type="checkbox"
            checked={includeDeleted}
            onChange={(e) => setIncludeDeleted(e.target.checked)}
          />
          Include soft-deleted
        </label>
        {isFetching && !isFetchingNextPage ? (
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Loading…
          </span>
        ) : null}
      </div>

      {error ? (
        <div className="border-danger-300 bg-danger-50/40 text-danger-700 dark:border-danger-900/60 dark:bg-danger-950/20 dark:text-danger-300 rounded-md border p-4 text-sm">
          Failed to load users. Try refreshing.
        </div>
      ) : null}

      <UserTable
        rows={rows}
        isLoading={isLoading}
        emptyHint={
          debouncedQuery
            ? `No users match "${debouncedQuery}".`
            : 'No users to show.'
        }
        operatorTz={operatorTz}
      />

      {hasNextPage ? (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {isFetchingNextPage ? 'Loading…' : 'Load more'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
