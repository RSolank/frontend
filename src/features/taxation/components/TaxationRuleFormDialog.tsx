import { useEffect, useMemo, useState } from 'react';

import { LockedFieldBanner } from '../../../shared/components/LockedFieldBanner';
import { Modal } from '../../../shared/components/Modal';
import { updateTaxationRuleRequest } from '../api/mutations';
import type { TaxationRule } from '../api/queries';
import { taxationRuleFormSchema } from '../api/schemas';

interface ApiErrorShape {
  detail?: string;
  error?: string;
}

function errorMessage(err: unknown, fallback: string): string {
  const e = err as ApiErrorShape;
  return e?.detail || e?.error || fallback;
}

// Fractions → "5%" for display in the rate inputs. Trim trailing zeros.
function formatRateForInput(fraction: number): string {
  const pct = fraction * 100;
  // parseFloat drops trailing zeros numerically (5.00 -> 5, 12.50 -> 12.5)
  // — no regex needed.
  const fixed = String(parseFloat(pct.toFixed(2)));
  return `${fixed || '0'}%`;
}

// Parses "5", "5%", or "0.05" → fraction (0.05). `%` suffix → divide by
// 100; bare numbers > 1 are treated as percent for forgiveness (a user
// typing "5" almost certainly means 5%, not 500%). The schema's max=10
// catches the rare "500" landing as 500× rate.
function parseRateInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const hasPercent = trimmed.endsWith('%');
  const numeric = Number(trimmed.replace(/%\s*$/, ''));
  if (!Number.isFinite(numeric)) return null;
  if (hasPercent) return numeric / 100;
  // Forgive bare ">=1" entries as percents — see comment above.
  return numeric >= 1 ? numeric / 100 : numeric;
}

interface TaxationRuleFormDialogProps {
  open: boolean;
  onClose: () => void;
  // Called after a successful save. The saved txn_type is passed back
  // so the parent can flash the row via useRowHighlight.
  onSaved: (savedTxnType: string) => void | Promise<void>;
  // Edit mode: a fully-loaded rule with a fixed txn_type.
  editingRule?: TaxationRule | null;
  // Add mode: list of TAXABLE_TXN_TYPES the user hasn't customized
  // yet. Exactly one entry → prefilled + read-only. Two+ entries →
  // dropdown.
  availableTypes?: string[];
}

const DEFAULT_TAX_RATE = '0%';
const DEFAULT_PENALTY_RATE = '50%';

// Stable empty-array reference. A default-parameter `[]` produces a
// fresh array per render, which retrips the open-effect on every
// keystroke (the effect's deps include `availableTypes`) and resets
// the form mid-typing. Pinning to a module-level constant keeps the
// reference stable when the parent doesn't pass `availableTypes`.
const EMPTY_TYPES: readonly string[] = [];

// Per the DetailModal convention (Batch 9.8): the txn_type is a
// server-managed enum so the field is always read-only when
// editing. Add mode opens a picker since the user is choosing the
// type for the first time.
const TXN_TYPE_LOCK_REASON =
  'Transaction type is fixed once a rule exists. Edit Tax rate or Default penalty instead.';

export function TaxationRuleFormDialog({
  open,
  onClose,
  onSaved,
  editingRule = null,
  availableTypes = EMPTY_TYPES as string[],
}: TaxationRuleFormDialogProps) {
  const isEditing = editingRule != null;

  const [txnType, setTxnType] = useState<string>(
    isEditing ? editingRule.txn_type : (availableTypes[0] ?? '')
  );
  const [taxRate, setTaxRate] = useState<string>(
    isEditing ? formatRateForInput(editingRule.tax_rate) : DEFAULT_TAX_RATE
  );
  const [penaltyRate, setPenaltyRate] = useState<string>(
    isEditing
      ? formatRateForInput(editingRule.default_penalty_rate)
      : DEFAULT_PENALTY_RATE
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Reason surfaced by the LockedFieldBanner. Set when the user clicks
  // a read-only field; cleared by the first successful edit on an
  // editable field. See `LockedFieldBanner` for the auto-dismiss
  // contract.
  const [lockedReason, setLockedReason] = useState<string | null>(null);

  // Reset form on each open so a closed-then-reopened dialog doesn't
  // leak prior state.
  useEffect(() => {
    if (!open) return;
    if (isEditing) {
      setTxnType(editingRule.txn_type);
      setTaxRate(formatRateForInput(editingRule.tax_rate));
      setPenaltyRate(formatRateForInput(editingRule.default_penalty_rate));
    } else {
      setTxnType(availableTypes[0] ?? '');
      setTaxRate(DEFAULT_TAX_RATE);
      setPenaltyRate(DEFAULT_PENALTY_RATE);
    }
    setError(null);
    setSaving(false);
    setLockedReason(null);
  }, [open, isEditing, editingRule, availableTypes]);

  const isDirty = useMemo(() => {
    if (!isEditing) return true; // any open Add dialog is dirty
    if (taxRate !== formatRateForInput(editingRule.tax_rate)) return true;
    if (penaltyRate !== formatRateForInput(editingRule.default_penalty_rate))
      return true;
    return false;
  }, [isEditing, editingRule, taxRate, penaltyRate]);

  // First successful edit on an editable field clears any active
  // locked-field banner — the user has moved on from the locked
  // field they clicked.
  function clearLockedBannerOnEdit() {
    if (lockedReason) setLockedReason(null);
  }

  async function handleSave() {
    setError(null);
    if (!txnType) {
      setError('Pick a transaction type to add.');
      return;
    }
    const tax = parseRateInput(taxRate);
    const pen = parseRateInput(penaltyRate);
    const parsed = taxationRuleFormSchema.safeParse({
      tax_rate: tax,
      default_penalty_rate: pen,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid input');
      return;
    }
    setSaving(true);
    try {
      await updateTaxationRuleRequest(txnType, parsed.data);
      await onSaved(txnType);
      // Row highlight on the parent list communicates success — the
      // modal can close cleanly in both Add and Edit paths.
      onClose();
    } catch (err) {
      setError(errorMessage(err, 'Failed to save taxation rule'));
    } finally {
      setSaving(false);
    }
  }

  // Title = entity identifier per the locked convention. Add flow
  // gets a "New …" prefix so the user sees the operation context.
  const title = isEditing
    ? editingRule.txn_type.charAt(0).toUpperCase() + editingRule.txn_type.slice(1)
    : 'New taxation rule';

  // Add mode with multiple available types renders a picker; Edit
  // mode (and Add with a single available type) renders a locked
  // input that surfaces the banner on click.
  const showPicker = !isEditing && availableTypes.length > 1;
  const fixedTypeLabel =
    isEditing ? editingRule.txn_type : (availableTypes[0] ?? '');

  // Single button — text + behaviour switch on isDirty. Save lives
  // alongside it as the primary action and enables once dirty.
  const dismissLabel = isDirty ? 'Cancel' : 'Close';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="md"
      confirmOnDirty
      isDirty={isDirty}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {dismissLabel}
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || !isDirty}
            className="btn-primary !w-auto"
          >
            {saving ? 'Saving…' : isEditing ? 'Save changes' : 'Add rule'}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <LockedFieldBanner reason={lockedReason} />

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">
            Transaction type
          </span>
          {showPicker ? (
            <select
              value={txnType}
              onChange={(e) => {
                clearLockedBannerOnEdit();
                setTxnType(e.target.value);
              }}
              className="form-input capitalize"
              aria-label="Transaction type"
            >
              <option value="">Select a type…</option>
              {availableTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={fixedTypeLabel}
              readOnly
              onClick={() => setLockedReason(TXN_TYPE_LOCK_REASON)}
              aria-label="Transaction type (read-only)"
              data-testid="rule-form-fixed-type"
              className="form-input cursor-not-allowed capitalize bg-slate-50 text-slate-700 dark:bg-slate-800/60 dark:text-slate-200"
            />
          )}
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">
            Tax rate
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={taxRate}
            onChange={(e) => {
              clearLockedBannerOnEdit();
              setTaxRate(e.target.value);
            }}
            className="form-input"
            aria-label="Tax rate"
          />
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Accepts <code>5%</code>, <code>0.05</code>, or <code>5</code>{' '}
            (assumed %).
          </span>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">
            Default penalty
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={penaltyRate}
            onChange={(e) => {
              clearLockedBannerOnEdit();
              setPenaltyRate(e.target.value);
            }}
            className="form-input"
            aria-label="Default penalty rate"
          />
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Applied on top of base tax when a budget is breached. Per-budget
            overrides live on the Expense Tracker page.
          </span>
        </label>

        {error && (
          <div
            role="alert"
            className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800/60 dark:bg-red-950/40 dark:text-red-200"
          >
            {error}
          </div>
        )}
      </div>
    </Modal>
  );
}
