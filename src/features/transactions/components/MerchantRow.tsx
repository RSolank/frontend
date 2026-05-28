import { Link } from 'react-router-dom';

import { formatMoney } from '../../../shared/utils/currency';
import type { MerchantGroup } from '../api/schemas';

interface MerchantRowProps {
  group: MerchantGroup;
  currencyCode: string;
  currencySymbol: string | null;
  onDetails: (beneficiaryId: number) => void;
}

// One merchant aggregation row. Same responsive shape as
// TransactionRow (column stack at <md, single-line at >=md). Beneficiary
// name is the header (clicks → beneficiary detail page); the "Details"
// CTA drills into a filtered List view (existing behaviour).
export function MerchantRow({
  group,
  currencyCode,
  currencySymbol,
  onDetails,
}: MerchantRowProps) {
  const totalSign = group.total_amount > 0 ? '+' : group.total_amount < 0 ? '-' : '';
  const totalColor =
    group.total_amount > 0
      ? 'text-emerald-600 dark:text-emerald-400'
      : group.total_amount < 0
        ? 'text-rose-600 dark:text-rose-400'
        : 'text-slate-700 dark:text-slate-200';

  return (
    <li className="flex flex-col gap-2 border-b border-slate-100 px-3 py-2.5 transition-colors last:border-b-0 hover:bg-slate-50 md:flex-row md:items-center md:gap-3 md:py-2 dark:border-slate-800 dark:hover:bg-slate-900/60">
      {/* Beneficiary name — primary identity. */}
      <div className="min-w-0 flex-1">
        <Link
          to={`/beneficiaries/${group.beneficiary_id}`}
          className="truncate text-sm font-medium text-indigo-700 hover:text-indigo-800 dark:text-indigo-300 dark:hover:text-indigo-200"
        >
          {group.beneficiary_name}
        </Link>
      </div>

      {/* Frequency + total + details. Inline on desktop, justified
          on mobile so amount stays right-aligned. */}
      <div className="flex items-center justify-between gap-3 md:justify-end">
        <span className="text-xs text-slate-500 md:w-32 md:text-right dark:text-slate-400">
          {group.frequency}{' '}
          {group.frequency === 1 ? 'transaction' : 'transactions'}
        </span>
        <span
          className={`money text-sm font-bold tabular-nums md:w-28 md:text-right ${totalColor}`}
        >
          {totalSign}
          {formatMoney(
            Math.abs(group.total_amount || 0),
            currencyCode,
            currencySymbol
          )}
        </span>
        <button
          type="button"
          onClick={() => onDetails(group.beneficiary_id)}
          className="text-xs font-semibold text-indigo-600 transition-colors hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
        >
          Details
        </button>
      </div>
    </li>
  );
}
