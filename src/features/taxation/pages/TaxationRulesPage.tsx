import { useQueryClient } from '@tanstack/react-query';
import { MoreHorizontal } from 'lucide-react';
import { useMemo, useState } from 'react';

import { useRowHighlight } from '../../../shared/hooks/useRowHighlight';
import { useAuthStore } from '../../../shared/state/auth.store';
import { taxationKeys } from '../api/keys';
import { useTaxationRulesQuery, type TaxationRule } from '../api/queries';
import { TaxationRuleFormDialog } from '../components/TaxationRuleFormDialog';

const DEFAULT_TXN_TYPES = [
  'committed',
  'essential',
  'discretionary',
  'uncategorized',
] as const;

function formatRate(fraction: number): string {
  const pct = fraction * 100;
  const fixed = pct.toFixed(2).replace(/\.?0+$/, '');
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
  const ringClass = isHighlighted
    ? 'ring-2 ring-inset ring-indigo-500'
    : 'ring-0';

  return (
    <article
      data-testid={`rule-card-${rule.txn_type}`}
      className={`rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-shadow dark:border-slate-800 dark:bg-slate-900 ${ringClass}`}
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-slate-900 capitalize dark:text-slate-100">
          {rule.txn_type}
        </h3>
        <button
          type="button"
          onClick={() => onEdit(rule)}
          aria-label={`View / edit ${rule.txn_type} rule`}
          title="View / edit"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
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
        Base tax applied to every <span className="capitalize">{rule.txn_type}</span>{' '}
        debit. Budget breaches stack the penalty (overridable per budget).
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
      <dd className="text-base font-semibold tabular-nums text-slate-900 dark:text-slate-100">
        {value}
      </dd>
    </div>
  );
}

export function TaxationRulesPage() {
  const queryClient = useQueryClient();
  const constants = useAuthStore((s) => s.constants);
  const { data, isLoading, error } = useTaxationRulesQuery();
  const { id: highlighted, flash } = useRowHighlight<string>();

  const [editingRule, setEditingRule] = useState<TaxationRule | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const taxableTypes = useMemo<string[]>(() => {
    const fromConstants = constants?.TAXABLE_TXN_TYPES;
    if (fromConstants && fromConstants.length > 0) return fromConstants;
    return [...DEFAULT_TXN_TYPES];
  }, [constants]);

  // Only render user-customized rules. Backend marks unconfigured types
  // with `is_default=true` (a synthetic fallback row); those are NOT
  // rules in the user's mental model — they're missing-and-Add-able.
  const userRules = useMemo<TaxationRule[]>(() => {
    return (data?.rules ?? []).filter((r) => r.is_default !== true);
  }, [data]);

  const customizedTypes = useMemo<Set<string>>(
    () => new Set(userRules.map((r) => r.txn_type)),
    [userRules]
  );

  const missingTypes = useMemo<string[]>(
    () => taxableTypes.filter((t) => !customizedTypes.has(t)),
    [taxableTypes, customizedTypes]
  );

  async function handleSaved(savedType: string) {
    await queryClient.invalidateQueries({ queryKey: taxationKeys.rulesList() });
    flash(savedType);
  }

  // Card-anchored layout (Batch 9 polish): page mounted under
  // SettingsLayout shell. Outer gutter + breadcrumb ("Settings ›
  // Taxation Rules") are already provided; the in-page hand-rolled
  // breadcrumb + h1 + description block is gone. Add-rule CTA lives
  // in a compact top toolbar so the rule cards still align with the
  // sidebar's first NavLink.
  return (
    <>
      {missingTypes.length > 0 && (
        <div className="mb-4 flex justify-end">
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="btn-primary !w-auto"
            data-testid="rule-add-button"
          >
            Add rule
          </button>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800/60 dark:bg-red-950/40 dark:text-red-200"
        >
          Failed to load taxation rules.
        </div>
      )}

      <div className="grid grid-cols-1 gap-3" data-testid="rule-list">
        {isLoading && !data ? (
          <div className="text-sm text-slate-500 dark:text-slate-400">
            Loading…
          </div>
        ) : userRules.length === 0 ? (
          <div className="rounded-md border border-dashed border-slate-200 px-3 py-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            No rules configured yet. Click <strong>Add rule</strong> above to
            customize the rate for a transaction type.
          </div>
        ) : (
          userRules.map((r) => (
            <RuleCard
              key={r.txn_type}
              rule={r}
              isHighlighted={highlighted === r.txn_type}
              onEdit={(rule) => setEditingRule(rule)}
            />
          ))
        )}
      </div>

      <TaxationRuleFormDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSaved={handleSaved}
        availableTypes={missingTypes}
      />

      <TaxationRuleFormDialog
        open={editingRule != null}
        onClose={() => setEditingRule(null)}
        onSaved={handleSaved}
        editingRule={editingRule}
      />
    </>
  );
}
