import { useState } from 'react';
import { Link } from 'react-router-dom';

import { useAdminGateQuery } from '../../../shared/api/adminGate';
import { useDebouncedValue } from '../../../shared/hooks/useDebouncedValue';
import { usePreferencesStore } from '../../../shared/state/preferences.store';
import { formatDate } from '../../../shared/utils/dateUtils';
import {
  useAdminCemeteryInfiniteQuery,
  type AdminCemeteryRow,
} from '../api/cemetery';

// Cemetery audit list — T-admin C1. Read-only inventory of deleted
// users (post-purge tombstones); `deleted_at` is the entomb
// timestamp, `email` is the one retained PII field. Search + date
// range filter inputs are local-state (URL-state-free in v1, same
// posture as the user list). Lazy-loaded.

function dateOrDash(iso: string | null, tz: string): string {
  if (!iso) return '—';
  return formatDate(iso, tz, { dateStyle: 'medium' });
}

interface CemeteryTableProps {
  rows: AdminCemeteryRow[];
  isLoading: boolean;
  emptyHint: string;
  operatorTz: string;
}

function CemeteryTable({
  rows,
  isLoading,
  emptyHint,
  operatorTz,
}: CemeteryTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
        <thead className="bg-slate-50 text-xs tracking-wider text-slate-500 uppercase dark:bg-slate-950/40 dark:text-slate-400">
          <tr>
            <th className="px-4 py-2 text-left font-medium">Email</th>
            <th className="px-4 py-2 text-left font-medium">Deleted</th>
            <th className="px-4 py-2 text-left font-medium">Country</th>
            <th className="px-4 py-2 text-right font-medium">Bills</th>
            <th className="px-4 py-2 text-right font-medium">Expense rows</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {!isLoading && rows.length === 0 ? (
            <tr>
              <td
                colSpan={5}
                className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400"
              >
                {emptyHint}
              </td>
            </tr>
          ) : null}
          {rows.map((r) => (
            <tr
              key={r.deleted_user_id}
              className="hover:bg-accent-50/60 dark:hover:bg-accent-950/30 cursor-pointer text-slate-700 dark:text-slate-300"
            >
              <td className="px-4 py-2">
                <Link
                  to={`/admin/cemetery/${r.deleted_user_id}`}
                  className="text-accent-600 dark:text-accent-400 hover:underline"
                >
                  {r.email ?? '(no email)'}
                </Link>
              </td>
              <td className="px-4 py-2">
                {dateOrDash(r.deleted_at, operatorTz)}
              </td>
              <td className="px-4 py-2">{r.country ?? '—'}</td>
              <td className="px-4 py-2 text-right tabular-nums">
                {r.committee_bill_replicas_count}
              </td>
              <td className="px-4 py-2 text-right tabular-nums">
                {r.expense_total_replicas_count}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AdminCemeteryPage() {
  const { data: isAdmin, isLoading: gateLoading } = useAdminGateQuery();
  const operatorTz = usePreferencesStore((s) => s.timezone);
  const [rawQuery, setRawQuery] = useState('');
  const debouncedQuery = useDebouncedValue(rawQuery, 300);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const {
    data,
    isLoading,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error,
  } = useAdminCemeteryInfiniteQuery(
    {
      q: debouncedQuery,
      from: from || null,
      to: to || null,
    },
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

  const rows = data?.pages.flatMap((p) => p.deleted_users) ?? [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-4">
        <Link
          to="/admin"
          className="hover:text-accent-600 dark:hover:text-accent-400 text-xs font-medium text-slate-500 dark:text-slate-400"
        >
          ← Admin tools
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">
          Cemetery
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Post-deletion audit trail. Soft-delete grace already elapsed; email is
          the only retained PII.
        </p>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          aria-label="Search cemetery by email"
          placeholder="Search by email…"
          value={rawQuery}
          onChange={(e) => setRawQuery(e.target.value)}
          className="form-input max-w-md"
        />
        <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
          From
          <input
            type="date"
            aria-label="Deleted from date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="form-input"
          />
        </label>
        <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
          To
          <input
            type="date"
            aria-label="Deleted to date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="form-input"
          />
        </label>
        {isFetching && !isFetchingNextPage ? (
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Loading…
          </span>
        ) : null}
      </div>

      {error ? (
        <div className="border-danger-300 bg-danger-50/40 text-danger-700 dark:border-danger-900/60 dark:bg-danger-950/20 dark:text-danger-300 rounded-md border p-4 text-sm">
          Failed to load cemetery. Try refreshing.
        </div>
      ) : null}

      <CemeteryTable
        rows={rows}
        isLoading={isLoading}
        emptyHint={
          debouncedQuery
            ? `No deleted users match "${debouncedQuery}".`
            : 'No deleted users to show.'
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
