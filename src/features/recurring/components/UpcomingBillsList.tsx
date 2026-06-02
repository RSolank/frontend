import { useMemo } from 'react';

import { useMoneyFormatter } from '../../../shared/hooks/useMoneyFormatter';
import { usePreferencesStore } from '../../../shared/state/preferences.store';
import { formatDate } from '../../../shared/utils/dateUtils';
import { useBeneficiariesQuery } from '../../beneficiaries/api/queries';
import { useRecurringUpcomingQuery } from '../api/queries';
import type { RecurringBill } from '../api/schemas';

interface Props {
  days: number;
}

// Shared list view used by both the /recurring "Upcoming" tab (days=30)
// and the dashboard widget (days=7). Renders the forecast rows from
// /api/recurring/upcoming?days=N — `matched_txn_id` is null for pending
// rows; once an inbound txn reconciles, the row would migrate to
// /history (so non-null here is unusual but rendered defensively).
export function UpcomingBillsList({ days }: Props) {
  const { money } = useMoneyFormatter();
  const timezone = usePreferencesStore((s) => s.timezone);
  const upcoming = useRecurringUpcomingQuery(days);
  const benQuery = useBeneficiariesQuery();
  const benById = useMemo(() => {
    const m = new Map<number, string>();
    for (const b of benQuery.data ?? []) m.set(b.uid, b.name);
    return m;
  }, [benQuery.data]);

  if (upcoming.isLoading)
    return (
      <p className="text-sm text-slate-500" data-testid="upcoming-loading">
        Loading upcoming bills…
      </p>
    );

  const bills = upcoming.data ?? [];
  if (bills.length === 0)
    return (
      <p
        className="text-sm text-slate-500"
        data-testid="upcoming-empty"
      >
        Nothing forecast in the next {days} days.
      </p>
    );

  return (
    <ul
      className="flex flex-col gap-2"
      data-testid="upcoming-list"
    >
      {bills.map((bill) => (
        <UpcomingRow
          key={bill.uid}
          bill={bill}
          beneficiaryName={
            benById.get(bill.beneficiary_id) ??
            `Beneficiary #${bill.beneficiary_id}`
          }
          moneyLabel={money(bill.expected_amount)}
          timezone={timezone}
        />
      ))}
    </ul>
  );
}

function UpcomingRow({
  bill,
  beneficiaryName,
  moneyLabel,
  timezone,
}: {
  bill: RecurringBill;
  beneficiaryName: string;
  moneyLabel: string;
  timezone: string;
}) {
  return (
    <li
      className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-900"
      data-testid={`upcoming-row-${bill.uid}`}
    >
      <div className="flex min-w-0 flex-col">
        <span className="truncate font-medium text-slate-900 dark:text-slate-100">
          {beneficiaryName}
        </span>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          Due{' '}
          {formatDate(bill.due_date, timezone, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </span>
      </div>
      <span
        className={`money shrink-0 font-medium ${
          bill.debit_credit === 'debit'
            ? 'text-danger-600 dark:text-danger-400'
            : 'text-success-600 dark:text-success-400'
        }`}
      >
        {bill.debit_credit === 'debit' ? '-' : '+'}
        {moneyLabel}
      </span>
    </li>
  );
}
