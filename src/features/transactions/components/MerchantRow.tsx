import { Link } from 'react-router-dom';

import {
  amountColorClass,
  amountSign,
  formatMoney,
} from '../../../shared/utils/currency';
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
//
// BE Phase 1.7 (T-aggregates-engine) field shape:
// `total_count` (was `frequency`) + `net_expense` (was `total_amount`,
// = `total_debit − total_credit`, expense-positive).
export function MerchantRow({
  group,
  currencyCode,
  currencySymbol,
  onDetails,
}: MerchantRowProps) {
  const beneficiaryId = group.beneficiary_id ?? 0;
  const beneficiaryName = group.beneficiary_name ?? '—';
  const total = group.net_expense;
  const count = group.total_count;
  const totalSign = amountSign(total);
  const totalColor = amountColorClass(total);

  return (
    <li className="flex flex-col gap-2 border-b border-slate-100 px-3 py-2.5 transition-colors last:border-b-0 hover:bg-slate-50 md:flex-row md:items-center md:gap-3 md:py-2 dark:border-slate-800 dark:hover:bg-slate-900/60">
      {/* Beneficiary name — primary identity. */}
      <div className="min-w-0 flex-1">
        <Link
          to={`/beneficiaries/${beneficiaryId}`}
          className="truncate text-sm font-medium text-accent-700 hover:text-accent-800 dark:text-accent-300 dark:hover:text-accent-200"
        >
          {beneficiaryName}
        </Link>
      </div>

      {/* Frequency + total + details. Inline on desktop, justified
          on mobile so amount stays right-aligned. */}
      <div className="flex items-center justify-between gap-3 md:justify-end">
        <span className="text-xs text-slate-500 md:w-32 md:text-right dark:text-slate-400">
          {count} {count === 1 ? 'transaction' : 'transactions'}
        </span>
        <span
          className={`money text-sm font-bold tabular-nums md:w-28 md:text-right ${totalColor}`}
        >
          {totalSign}
          {formatMoney(Math.abs(total || 0), currencyCode, currencySymbol)}
        </span>
        <button
          type="button"
          onClick={() => onDetails(beneficiaryId)}
          className="text-xs font-semibold text-accent-600 transition-colors hover:text-accent-700 dark:text-accent-400 dark:hover:text-accent-300"
        >
          Details
        </button>
      </div>
    </li>
  );
}
