import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { useAdminGateQuery } from '../../../shared/api/adminGate';
import { usePreferencesStore } from '../../../shared/state/preferences.store';
import { formatMoney } from '../../../shared/utils/currency';
import { formatDate, formatDateTime } from '../../../shared/utils/dateUtils';
import {
  useAdminCemeteryDetailQuery,
  type AdminCemeteryBillReplica,
  type AdminCemeteryDetail,
  type AdminCemeteryExpenseReplica,
} from '../api/cemetery';

function formatPeriod(start: string, end: string, tz: string): string {
  return `${formatDate(start, tz, { dateStyle: 'medium' })} – ${formatDate(end, tz, { dateStyle: 'medium' })}`;
}

// One cemetery headstone + truncated replica peeks (≤10 each).
// Replica counts in the headstone are the full DB count; the
// peeked tables here are capped server-side. Collapsible sections
// keep the main view focused on the deletion timestamp.

function Section({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-6 py-4 text-left text-base font-semibold text-slate-900 dark:text-slate-100"
        aria-expanded={open}
      >
        <span>{title}</span>
        <span aria-hidden className="text-slate-500 dark:text-slate-400">
          {open ? '−' : '+'}
        </span>
      </button>
      {open ? <div className="px-6 pb-6">{children}</div> : null}
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
      <dt className="text-xs tracking-wider text-slate-500 uppercase dark:text-slate-400">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-slate-800 dark:text-slate-200">
        {children}
      </dd>
    </div>
  );
}

function HeadstoneSection({
  row,
  tz,
}: {
  row: AdminCemeteryDetail;
  tz: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h2 className="mb-3 text-base font-semibold text-slate-900 dark:text-slate-100">
        Deletion summary
      </h2>
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KeyValue label="Email">{row.email ?? '(no email retained)'}</KeyValue>
        <KeyValue label="Former user ID">{row.former_user_id}</KeyValue>
        <KeyValue label="Deleted at">
          {formatDateTime(row.deleted_at, tz)}
        </KeyValue>
        <KeyValue label="Account opened">
          {row.account_opened_at
            ? formatDate(row.account_opened_at, tz, { dateStyle: 'medium' })
            : '—'}
        </KeyValue>
        <KeyValue label="Country">{row.country ?? '—'}</KeyValue>
        <KeyValue label="Currency">{row.currency ?? '—'}</KeyValue>
        <KeyValue label="Committee bills">
          {row.committee_bill_replicas_count}
        </KeyValue>
        <KeyValue label="Expense replicas">
          {row.expense_total_replicas_count}
        </KeyValue>
      </dl>
    </div>
  );
}

function BillReplicasTable({
  rows,
  tz,
  currency,
}: {
  rows: AdminCemeteryBillReplica[];
  tz: string;
  currency: string | null;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        No committee-bill replicas retained.
      </p>
    );
  }
  const cur = currency ?? 'USD';
  return (
    <div className="overflow-x-auto">
      <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
        Showing up to 10 rows. Full data is in the cemetery tables (SQL only).
      </p>
      <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
        <thead className="text-xs tracking-wider text-slate-500 uppercase dark:text-slate-400">
          <tr>
            <th className="py-2 pr-3 text-left font-medium">Bill ID</th>
            <th className="py-2 pr-3 text-left font-medium">Period</th>
            <th className="py-2 pr-3 text-left font-medium">Status</th>
            <th className="py-2 pr-3 text-right font-medium">Amount</th>
            <th className="py-2 pr-3 text-left font-medium">Billed at</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {rows.map((b) => (
            <tr
              key={b.original_bill_id}
              className="text-slate-700 dark:text-slate-300"
            >
              <td className="py-2 pr-3 font-mono text-xs">
                {b.original_bill_id}
              </td>
              <td className="py-2 pr-3">
                {formatPeriod(b.period_start, b.period_end, tz)}
              </td>
              <td className="py-2 pr-3">{b.bill_status}</td>
              <td className="py-2 pr-3 text-right tabular-nums">
                {formatMoney(b.amount, cur, null)}
              </td>
              <td className="py-2 pr-3">{formatDateTime(b.billed_at, tz)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ExpenseReplicasTable({
  rows,
  tz,
  currency,
}: {
  rows: AdminCemeteryExpenseReplica[];
  tz: string;
  currency: string | null;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        No expense replicas retained.
      </p>
    );
  }
  const cur = currency ?? 'USD';
  return (
    <div className="overflow-x-auto">
      <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
        Showing up to 10 rows. Full data is in the cemetery tables (SQL only).
      </p>
      <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
        <thead className="text-xs tracking-wider text-slate-500 uppercase dark:text-slate-400">
          <tr>
            <th className="py-2 pr-3 text-left font-medium">Period</th>
            <th className="py-2 pr-3 text-left font-medium">Type</th>
            <th className="py-2 pr-3 text-right font-medium">Txns</th>
            <th className="py-2 pr-3 text-right font-medium">Debit</th>
            <th className="py-2 pr-3 text-right font-medium">Credit</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {rows.map((r, i) => (
            <tr
              key={`${r.period_type}-${r.period_start}-${i}`}
              className="text-slate-700 dark:text-slate-300"
            >
              <td className="py-2 pr-3">
                {formatPeriod(r.period_start, r.period_end, tz)}
              </td>
              <td className="py-2 pr-3">{r.period_type}</td>
              <td className="py-2 pr-3 text-right tabular-nums">
                {r.total_count}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums">
                {formatMoney(r.total_debit, cur, null)}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums">
                {formatMoney(r.total_credit, cur, null)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NotFoundPanel() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Headstone not found
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          No cemetery record with that ID. It may have been pre-cemetery (the
          soft-delete grace window) or never existed.
        </p>
        <Link
          to="/admin/cemetery"
          className="text-accent-600 hover:text-accent-700 dark:text-accent-400 dark:hover:text-accent-300 mt-3 inline-flex text-sm font-medium"
        >
          ← Back to cemetery
        </Link>
      </div>
    </div>
  );
}

function NotAvailablePanel() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="border-danger-300 bg-danger-50/40 dark:border-danger-900/60 dark:bg-danger-950/20 rounded-xl border p-6">
        <h1 className="text-danger-700 dark:text-danger-300 text-lg font-semibold">
          Not available
        </h1>
        <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">
          The admin portal is only available to operators.
        </p>
      </div>
    </div>
  );
}

export function AdminCemeteryDetailPage() {
  const { deletedUserId } = useParams<{ deletedUserId: string }>();
  const numericId = Number(deletedUserId);
  const validId = Number.isFinite(numericId) && numericId > 0;
  const { data: isAdmin, isLoading: gateLoading } = useAdminGateQuery();
  const operatorTz = usePreferencesStore((s) => s.timezone);

  const { data, isLoading, error } = useAdminCemeteryDetailQuery(
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

  if (!isAdmin) return <NotAvailablePanel />;
  if (!validId) return <NotFoundPanel />;

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 text-sm text-slate-500 dark:text-slate-400">
        Loading headstone…
      </div>
    );
  }

  if (error && error.status === 404) return <NotFoundPanel />;
  if (error || !data) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="border-danger-300 bg-danger-50/40 text-danger-700 dark:border-danger-900/60 dark:bg-danger-950/20 dark:text-danger-300 rounded-md border p-4 text-sm">
          Failed to load headstone.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-8">
      <header>
        <Link
          to="/admin/cemetery"
          className="hover:text-accent-600 dark:hover:text-accent-400 text-xs font-medium text-slate-500 dark:text-slate-400"
        >
          ← Back to cemetery
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">
          {data.email ?? `Deleted user #${data.former_user_id}`}
        </h1>
      </header>

      <HeadstoneSection row={data} tz={operatorTz} />

      <Section title="Committee-bill replicas">
        <BillReplicasTable
          rows={data.committee_bill_replicas}
          tz={operatorTz}
          currency={data.currency}
        />
      </Section>

      <Section title="Expense replicas">
        <ExpenseReplicasTable
          rows={data.expense_total_replicas}
          tz={operatorTz}
          currency={data.currency}
        />
      </Section>
    </div>
  );
}
