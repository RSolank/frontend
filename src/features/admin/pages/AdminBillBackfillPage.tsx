import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { useAdminGateQuery } from '../../../shared/api/adminGate';
import type { ApiError } from '../../../shared/api/apiClient';
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog';
import { useAdminGenerateBillsMutation } from '../api/billBackfill';
import type { AdminUserRow } from '../api/users';
import { AdminUserPicker } from '../components/AdminUserPicker';

// Bill-backfill ops form — T-admin D1 (FE-only; BE Phase 2.6 shipped
// the endpoint). Picks a target user, a date range, confirms with the
// resolved identity + range, POSTs to /consumption-tax/admin/bills/
// generate, and appends to a session-local log so the operator has
// recent context without leaving the page. The log is purely
// ephemeral (no react-query, no localStorage) — the canonical record
// is on the BE side via the activity feed / bills tables.

const MAX_RANGE_DAYS = 365;

interface LogEntry {
  user: AdminUserRow;
  periodStart: string;
  periodEnd: string;
  billIds: number[];
  at: Date;
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

function todayIsoDate(): string {
  // Browser-local YYYY-MM-DD (date input format).
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function daysBetweenInclusive(start: string, end: string): number | null {
  const ms = Date.parse(end) - Date.parse(start);
  if (!Number.isFinite(ms)) return null;
  return Math.floor(ms / 86_400_000) + 1;
}

function deriveValidation(args: {
  user: AdminUserRow | null;
  start: string;
  end: string;
}): { valid: boolean; reason: string | null } {
  if (!args.user) return { valid: false, reason: 'Select a target user.' };
  if (!args.start || !args.end)
    return { valid: false, reason: 'Pick both period dates.' };
  if (args.start > args.end)
    return { valid: false, reason: 'Period end must be on or after start.' };
  const today = todayIsoDate();
  if (args.end >= today)
    return { valid: false, reason: 'Period end must be earlier than today.' };
  const span = daysBetweenInclusive(args.start, args.end);
  if (span === null) return { valid: false, reason: 'Invalid date.' };
  if (span > MAX_RANGE_DAYS)
    return {
      valid: false,
      reason: `Range exceeds ${MAX_RANGE_DAYS} days (got ${span}).`,
    };
  return { valid: true, reason: null };
}

function apiErrorMessage(err: unknown, fallback: string): string {
  const e = err as ApiError;
  const detail = typeof e?.detail === 'string' ? e.detail : undefined;
  return detail ?? e?.error ?? fallback;
}

function LogBlock({ entries }: { entries: LogEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <section
      aria-label="Recent backfills"
      className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <h2 className="mb-3 text-base font-semibold text-slate-900 dark:text-slate-100">
        Recent backfills (this session)
      </h2>
      <ul className="space-y-2 text-sm">
        {entries.map((e) => (
          <li
            key={`${e.user.user_id}-${e.at.toISOString()}`}
            className="flex flex-wrap items-baseline justify-between gap-2 rounded-md border border-slate-200 px-3 py-2 dark:border-slate-800"
          >
            <div>
              <span className="font-medium text-slate-800 dark:text-slate-200">
                {e.user.full_name}
              </span>{' '}
              <span className="text-slate-500 dark:text-slate-400">
                ({e.user.email})
              </span>
              <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
                {e.periodStart} → {e.periodEnd}
              </span>
            </div>
            <span className="text-xs text-success-700 dark:text-success-300">
              {e.billIds.length} bill{e.billIds.length === 1 ? '' : 's'}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function AdminBillBackfillPage() {
  const { data: isAdmin, isLoading: gateLoading } = useAdminGateQuery();
  const [user, setUser] = useState<AdminUserRow | null>(null);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [status, setStatus] = useState<
    { tone: 'success' | 'danger'; text: string } | null
  >(null);
  const [log, setLog] = useState<LogEntry[]>([]);

  const mutation = useAdminGenerateBillsMutation();

  const validation = useMemo(
    () => deriveValidation({ user, start, end }),
    [user, start, end]
  );

  function reset() {
    setUser(null);
    setStart('');
    setEnd('');
  }

  function onSubmit() {
    setStatus(null);
    if (!validation.valid || !user) return;
    setConfirmOpen(true);
  }

  function doGenerate() {
    if (!user) return;
    mutation.mutate(
      { user_id: user.user_id, period_start: start, period_end: end },
      {
        onSuccess: (resp) => {
          setConfirmOpen(false);
          setStatus({
            tone: 'success',
            text: `Generated ${resp.bill_ids.length} bill${resp.bill_ids.length === 1 ? '' : 's'}.`,
          });
          setLog((prev) => [
            {
              user,
              periodStart: start,
              periodEnd: end,
              billIds: resp.bill_ids,
              at: new Date(),
            },
            ...prev,
          ]);
          reset();
        },
        onError: (err) => {
          setStatus({
            tone: 'danger',
            text: apiErrorMessage(err, 'Bill generation failed.'),
          });
        },
      }
    );
  }

  if (gateLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 text-sm text-slate-500 dark:text-slate-400">
        Checking access…
      </div>
    );
  }

  if (!isAdmin) return <NotAvailablePanel />;

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-8">
      <header>
        <Link
          to="/admin"
          className="text-xs font-medium text-slate-500 hover:text-accent-600 dark:text-slate-400 dark:hover:text-accent-400"
        >
          ← Admin tools
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">
          Bill backfill
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Generate consumption-tax bills on behalf of a user for an
          arbitrary date range. Bypasses the auto-mode guard.
        </p>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="space-y-4">
          <div>
            {/* span instead of <label>: AdminUserPicker swaps between a
                summary div and an <input> internally; it carries its own
                aria-label on the input. */}
            <span className="form-label">Target user</span>
            <AdminUserPicker
              value={user}
              onChange={setUser}
              enabled={isAdmin === true}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="bf-start" className="form-label">
                Period start
              </label>
              <input
                id="bf-start"
                type="date"
                value={start}
                max={todayIsoDate()}
                onChange={(e) => setStart(e.target.value)}
                className="form-input"
              />
            </div>
            <div>
              <label htmlFor="bf-end" className="form-label">
                Period end
              </label>
              <input
                id="bf-end"
                type="date"
                value={end}
                max={todayIsoDate()}
                onChange={(e) => setEnd(e.target.value)}
                className="form-input"
              />
            </div>
          </div>

          {validation.reason && (user || start || end) ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {validation.reason}
            </p>
          ) : null}

          {status ? (
            <p
              role="status"
              className={
                status.tone === 'success'
                  ? 'text-sm text-success-700 dark:text-success-300'
                  : 'text-sm text-danger-700 dark:text-danger-300'
              }
            >
              {status.text}
            </p>
          ) : null}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onSubmit}
              disabled={!validation.valid || mutation.isPending}
              className="btn-primary !w-auto"
            >
              {mutation.isPending ? 'Generating…' : 'Generate bills'}
            </button>
          </div>
        </div>
      </section>

      <LogBlock entries={log} />

      <ConfirmDialog
        open={confirmOpen}
        title="Generate bills?"
        message={
          user
            ? `Generate consumption-tax bills for ${user.full_name} (${user.email}) over ${start} → ${end}? This bypasses the auto-mode guard.`
            : ''
        }
        confirmLabel="Generate bills"
        intent="primary"
        busy={mutation.isPending}
        onConfirm={doGenerate}
        onClose={() => setConfirmOpen(false)}
      />
    </div>
  );
}
