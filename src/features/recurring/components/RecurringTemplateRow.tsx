import {
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Pencil,
  X,
} from 'lucide-react';

import { useMoneyFormatter } from '../../../shared/hooks/useMoneyFormatter';
import { usePreferencesStore } from '../../../shared/state/preferences.store';
import { formatDate } from '../../../shared/utils/dateUtils';
import { highlightClass } from '../../../shared/utils/highlight';
import type { Beneficiary } from '../../beneficiaries/api/queries';
import type { RecurringCadence, RecurringTemplate } from '../api/schemas';

import { RecurringStatusChip } from './RecurringStatusChip';

interface Props {
  template: RecurringTemplate;
  beneficiaryById: Map<number, Beneficiary>;
  // Confirm = PATCH status:'locked'. Hidden when already locked.
  onConfirm?: () => void;
  onEdit: () => void;
  onDismiss: () => void;
  // Triggers the row highlight on save (conventions.md "Row highlight").
  highlighted?: boolean;
}

function cadenceLabel(cadence: RecurringCadence, interval: number): string {
  const base = cadence[0] + cadence.slice(1).toLowerCase();
  return interval === 1 ? base : `Every ${interval} ${base.toLowerCase()}`;
}

export function RecurringTemplateRow({
  template,
  beneficiaryById,
  onConfirm,
  onEdit,
  onDismiss,
  highlighted = false,
}: Props) {
  const { money } = useMoneyFormatter();
  const timezone = usePreferencesStore((s) => s.timezone);
  const beneficiary = beneficiaryById.get(template.beneficiary_id);
  const directionIcon =
    template.debit_credit === 'debit' ? (
      <ArrowUpRight size={14} className="text-danger-500" aria-hidden />
    ) : (
      <ArrowDownLeft size={14} className="text-success-500" aria-hidden />
    );

  return (
    <li
      id={`recurring-template-${template.uid}`}
      data-testid={`recurring-row-${template.uid}`}
      className={`flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 transition-shadow dark:border-slate-800 dark:bg-slate-900 ${highlightClass(highlighted)}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        {directionIcon}
        <span className="font-medium text-slate-900 dark:text-slate-100">
          {beneficiary?.name ?? `Beneficiary #${template.beneficiary_id}`}
        </span>
        <RecurringStatusChip status={template.status} />
        {!template.active && (
          <span
            className="inline-flex items-center rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            data-testid="recurring-inactive-chip"
          >
            Inactive
          </span>
        )}
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-slate-600 sm:grid-cols-4 dark:text-slate-400">
        <div>
          <dt className="text-xs tracking-wide text-slate-500 uppercase">
            Amount
          </dt>
          <dd className="money font-medium text-slate-900 dark:text-slate-100">
            {money(template.expected_amount)}
          </dd>
        </div>
        <div>
          <dt className="text-xs tracking-wide text-slate-500 uppercase">
            Cadence
          </dt>
          <dd>{cadenceLabel(template.cadence, template.cadence_interval)}</dd>
        </div>
        <div>
          <dt className="text-xs tracking-wide text-slate-500 uppercase">
            Next due
          </dt>
          <dd>
            {formatDate(template.next_due_date, timezone, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </dd>
        </div>
        <div>
          <dt className="text-xs tracking-wide text-slate-500 uppercase">
            Seen
          </dt>
          <dd>{template.occurrence_count}×</dd>
        </div>
      </dl>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {onConfirm && (
          <button
            type="button"
            onClick={onConfirm}
            className="bg-success-600 hover:bg-success-700 focus-visible:ring-success-500 inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-semibold text-white transition-colors focus-visible:ring-2 focus-visible:outline-none"
            data-testid={`recurring-confirm-${template.uid}`}
          >
            <CheckCircle2 size={14} aria-hidden />
            Confirm
          </button>
        )}
        <button
          type="button"
          onClick={onEdit}
          className="focus-visible:ring-accent-500 inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          data-testid={`recurring-edit-${template.uid}`}
        >
          <Pencil size={14} aria-hidden />
          Edit
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="text-danger-600 hover:bg-danger-50 focus-visible:ring-danger-500 dark:text-danger-400 dark:hover:bg-danger-950/40 inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
          data-testid={`recurring-dismiss-${template.uid}`}
        >
          <X size={14} aria-hidden />
          Dismiss
        </button>
      </div>
    </li>
  );
}
