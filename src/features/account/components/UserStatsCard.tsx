import { usePreferencesStore } from '../../../shared/state/preferences.store';
import { formatCount } from '../../../shared/utils/currency';
import { formatDate } from '../../../shared/utils/dateUtils';
import { useUserStatsQuery } from '../../users/api/queries';

// Lightweight "since you joined" summary on the Profile page. Backed
// by `GET /api/users/me/stats` (shipped BE Phase 1.15, `1e05a17` —
// see `task-platform.md → users.me-stats`).
export function UserStatsCard() {
  const { data, isLoading } = useUserStatsQuery();
  const timezone = usePreferencesStore((s) => s.timezone);

  if (isLoading || !data) {
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
        <Stat label="Recurring" value={data.active_recurring} />
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
        {formatCount(value)}
      </dd>
    </div>
  );
}
