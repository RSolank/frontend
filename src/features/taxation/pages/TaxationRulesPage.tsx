import { useQueryClient } from '@tanstack/react-query';
import { MoreHorizontal } from 'lucide-react';
import { useMemo, useState } from 'react';

import { SystemChip } from '../../../shared/components/SystemChip';
import { useRowHighlight } from '../../../shared/hooks/useRowHighlight';
import { highlightClass } from '../../../shared/utils/highlight';
import { taxationKeys } from '../api/keys';
import { useTaxationRulesQuery, type TaxationRule } from '../api/queries';
import { TaxationRuleFormDialog } from '../components/TaxationRuleFormDialog';

function formatRate(fraction: number): string {
  const pct = fraction * 100;
  // parseFloat drops trailing zeros numerically (5.00 -> 5, 12.50 -> 12.5)
  // — no regex needed.
  const fixed = String(parseFloat(pct.toFixed(2)));
  return `${fixed || '0'}%`;
}

interface RuleCardProps {
  rule: TaxationRule;
  isHighlighted: boolean;
  onEdit: (rule: TaxationRule) => void;
}

// Read-only card. Per the 2026-05-26 design-principle lock: list /
// view surfaces show label-value pairs only. Editing happens in a
// modal opened by the row-level ⋯ trigger (Batch 9.8 convention).
// Add/Edit are the only surfaces that render form fields.
function RuleCard({ rule, isHighlighted, onEdit }: RuleCardProps) {
  const ringClass = highlightClass(isHighlighted);

  return (
    <article
      data-testid={`rule-card-${rule.txn_type}`}
      className={`rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-shadow dark:border-slate-800 dark:bg-slate-900 ${ringClass}`}
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <span className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold text-slate-900 capitalize dark:text-slate-100">
            {rule.txn_type}
          </h3>
          {rule.is_system && <SystemChip />}
        </span>
        <button
          type="button"
          onClick={() => onEdit(rule)}
          aria-label={`View / edit ${rule.txn_type} rule`}
          title="View / edit"
          className="focus-visible:ring-accent-500 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700 focus-visible:ring-2 focus-visible:outline-none dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          <MoreHorizontal aria-hidden size={16} />
        </button>
      </header>

      <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
        <LabelValue label="Tax rate" value={formatRate(rule.tax_rate)} />
        <LabelValue
          label="Default penalty"
          value={formatRate(rule.default_penalty_rate)}
        />
      </dl>

      <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
        Base tax applied to every{' '}
        <span className="capitalize">{rule.txn_type}</span> debit. Budget
        breaches stack the penalty (overridable per budget).
      </p>
    </article>
  );
}

function LabelValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-start sm:justify-start sm:gap-0.5">
      <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">
        {label}
      </dt>
      <dd className="text-base font-semibold text-slate-900 tabular-nums dark:text-slate-100">
        {value}
      </dd>
    </div>
  );
}

export function TaxationRulesPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useTaxationRulesQuery();
  const { id: highlighted, flash } = useRowHighlight<string>();

  const [editingRule, setEditingRule] = useState<TaxationRule | null>(null);

  // Render every taxable type's effective rule. The backend always returns
  // one row per taxable type (seeded default or user-overridden); each is an
  // editable card carrying a "System" chip when it's system-created. All types
  // are always present, so there is no separate "configure a missing type"
  // step — the user edits a rate in place via the row's ⋯ trigger.
  const rules = useMemo<TaxationRule[]>(() => data?.rules ?? [], [data]);

  async function handleSaved(savedType: string) {
    await queryClient.invalidateQueries({ queryKey: taxationKeys.rulesList() });
    flash(savedType);
  }

  // Rule list via early returns (loading / empty / list) instead of a nested
  // ternary in the JSX — keeps it off sonarjs/no-nested-conditional.
  function renderRuleList() {
    if (isLoading && !data) {
      return (
        <div className="text-sm text-slate-500 dark:text-slate-400">
          Loading…
        </div>
      );
    }
    if (rules.length === 0) {
      return (
        <div className="rounded-md border border-dashed border-slate-200 px-3 py-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          No taxation rules available.
        </div>
      );
    }
    return rules.map((r) => (
      <RuleCard
        key={r.txn_type}
        rule={r}
        isHighlighted={highlighted === r.txn_type}
        onEdit={(rule) => setEditingRule(rule)}
      />
    ));
  }

  // Card-anchored layout (Batch 9 polish): page mounted under
  // SettingsLayout shell. Outer gutter + breadcrumb ("Settings ›
  // Taxation Rules") are already provided; the in-page hand-rolled
  // breadcrumb + h1 + description block is gone. Add-rule CTA lives
  // in a compact top toolbar so the rule cards still align with the
  // sidebar's first NavLink.
  return (
    <>
      {error && (
        <div
          role="alert"
          className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800/60 dark:bg-red-950/40 dark:text-red-200"
        >
          Failed to load taxation rules.
        </div>
      )}

      <div className="grid grid-cols-1 gap-3" data-testid="rule-list">
        {renderRuleList()}
      </div>

      <TaxationRuleFormDialog
        open={editingRule != null}
        onClose={() => setEditingRule(null)}
        onSaved={handleSaved}
        editingRule={editingRule}
      />
    </>
  );
}
