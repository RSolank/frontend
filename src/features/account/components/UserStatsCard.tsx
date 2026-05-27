import { usePreferencesStore } from '../../../shared/state/preferences.store';
import { formatDate } from '../../../shared/utils/dateUtils';
import { useUserStatsQuery } from '../../users/api/queries';

// Lightweight "since you joined" summary on the Profile page. Backed by
// `GET /api/users/me/stats` (Batch 9.1 backend ask — see
// `.scratch/task-handoff-fe-to-be.md §5`). The endpoint is not live
// yet; the query swallows 404 / 501 and resolves to `null`, in which
// case this card renders a friendly "Coming soon" empty state instead
// of an error. Same pattern as the Tax Tracker pending state.
export function UserStatsCard() {
  const { data, isLoading } = useUserStatsQuery();
  const timezone = usePreferencesStore((s) => s.timezone);

  if (isLoading) {
    return (
      <div className="rounded-xl bg-white p-6 shadow-sm dark:bg-slate-900 dark:shadow-none dark:ring-1 dark:ring-slate-800">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          Activity
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Loading…
        </p>
      </div>
    );
  }

  // Endpoint not yet implemented — pending empty state. Mirrors the
  // Tax Tracker pattern; the card lights up automatically when the
  // backend ships the endpoint (no FE follow-up required).
  if (!data) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-6 dark:border-slate-700 dark:bg-slate-900/40">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          Activity
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          A summary of how much you&rsquo;ve tracked since joining will
          land here once the backend stats endpoint ships. Filed under
          backend follow-ups.
        </p>
      </div>
    );
  }

  const joinedLabel = formatDate(data.joined_at, timezone, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm dark:bg-slate-900 dark:shadow-none dark:ring-1 dark:ring-slate-800">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          Activity
        </h2>
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
          Joined {joinedLabel}
        </span>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Transactions" value={data.total_transactions} />
        <Stat label="Beneficiaries" value={data.total_beneficiaries} />
        <Stat label="Budgets" value={data.total_budgets} />
        {typeof data.active_recurring === 'number' && (
          <Stat label="Recurring" value={data.active_recurring} />
        )}
      </dl>
    </div>
  );
}

interface StatProps {
  label: string;
  value: number;
}

function Stat({ label, value }: StatProps) {
  return (
    <div>
      <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">
        {label}
      </dt>
      <dd className="mt-0.5 text-lg font-semibold text-slate-900 dark:text-slate-100">
        {value.toLocaleString()}
      </dd>
    </div>
  );
}
