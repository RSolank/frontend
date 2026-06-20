import { useMemo } from 'react';

import { useDomainActivityQuery } from '../../../shared/api/activityFeed';
import { ActivityCallout } from '../../../shared/components/ActivityCallout';

// B1 dashboard enrichment — the one *additive* taxation signal the
// other cards don't already render: overdue committee bills. The
// TaxTracker card shows the in-progress week's accrual and the
// UpcomingBills widget shows the forward forecast; neither surfaces a
// bill that has gone *overdue*, which today lives only in the bell.
//
// Sits in the secondary grid (conditional, like BreachAlertsWidget) —
// renders nothing when no bill is overdue, so it costs no space on the
// happy path. `bill_overdue` is an ALERT/P1, so dismissing a callout
// hard-acks → BE MUTEs it and it resurfaces later (the snooze ladder),
// rather than vanishing for good.
const DOMAIN = 'taxation';
const FEED_LIMIT = 10;

export function OverdueBillsWidget() {
  const { data } = useDomainActivityQuery(DOMAIN, FEED_LIMIT);

  const overdue = useMemo(
    () => (data?.items ?? []).filter((i) => i.kind === 'bill_overdue'),
    [data]
  );

  if (overdue.length === 0) return null;

  return (
    <section
      data-testid="dashboard-overdue-bills"
      aria-labelledby="overdue-bills-heading"
      className="border-danger-300 bg-danger-50 dark:border-danger-800/60 dark:bg-danger-950/30 rounded-lg border p-3 shadow-sm"
    >
      <header className="mb-2 flex items-baseline justify-between">
        <h3
          id="overdue-bills-heading"
          className="text-danger-800 dark:text-danger-200 text-sm font-semibold"
        >
          Overdue bills
        </h3>
        <span className="text-danger-700 dark:text-danger-300 text-xs font-medium">
          {overdue.length} overdue
        </span>
      </header>
      <ul className="flex flex-col gap-2" data-testid="dashboard-overdue-list">
        {overdue.map((item) => (
          <li key={`${item.uid}-${item.kind}`}>
            <ActivityCallout
              item={item}
              testId={`dashboard-overdue-${item.subject_id}`}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
