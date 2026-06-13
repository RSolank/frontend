import { Modal } from './Modal';

export interface RuleReviewTag {
  tag_id: number;
  tag_name: string;
}

interface RuleReviewModalProps {
  open: boolean;
  beneficiaryName: string;
  // The existing rule's tags (what's saved today) vs. the transaction's new
  // tags. The modal renders the delta so the user sees the change before it's
  // made. Read-only — the actual edit happens on the categorization page.
  currentTags: RuleReviewTag[];
  newTags: RuleReviewTag[];
  // Keep the new tags on this transaction only; the rule is left untouched.
  onOverrideForTransaction: () => void;
  // Proceed to update the rule (the caller saves the txn, then navigates to the
  // rule editor pre-filled with the new tags).
  onUpdateRule: () => void;
  // Dismiss without doing either — returns to the form, nothing is saved.
  onClose: () => void;
}

function Chip({
  label,
  tone,
  prefix,
  strike,
}: {
  label: string;
  tone: 'neutral' | 'added' | 'removed';
  prefix?: string;
  strike?: boolean;
}) {
  const toneClass = {
    neutral:
      'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    added:
      'bg-success-100 text-success-800 dark:bg-success-950/50 dark:text-success-300',
    removed:
      'bg-slate-100 text-slate-400 line-through dark:bg-slate-800 dark:text-slate-500',
  }[tone];
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full px-2.5 py-0.5 text-sm font-medium ${toneClass}`}
    >
      {prefix && <span aria-hidden="true">{prefix}</span>}
      <span className={strike ? 'line-through' : undefined}>{label}</span>
    </span>
  );
}

// Read-only "a rule already exists" review surface, shown when a transaction's
// tags diverge from its beneficiary's saved rule. Presentational + prop-driven
// so it can be imported by any feature (it lives in shared/, depends on nothing
// feature-specific); the caller owns persistence + navigation to the editor.
export function RuleReviewModal({
  open,
  beneficiaryName,
  currentTags,
  newTags,
  onOverrideForTransaction,
  onUpdateRule,
  onClose,
}: RuleReviewModalProps) {
  const newIds = new Set(newTags.map((t) => t.tag_id));
  const currentIds = new Set(currentTags.map((t) => t.tag_id));
  const unchanged = currentTags.filter((t) => newIds.has(t.tag_id));
  const removed = currentTags.filter((t) => !newIds.has(t.tag_id));
  const added = newTags.filter((t) => !currentIds.has(t.tag_id));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="A rule already exists"
      description={`${beneficiaryName || 'This beneficiary'} already has a categorization rule. Your tags differ from it — review the change below.`}
      footer={
        <>
          <button
            type="button"
            onClick={onOverrideForTransaction}
            className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Use for this transaction only
          </button>
          <button
            type="button"
            onClick={onUpdateRule}
            className="bg-accent-600 hover:bg-accent-700 focus-visible:ring-accent-500 dark:bg-accent-500 dark:hover:bg-accent-400 inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold text-white transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            Update rule…
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <p className="mb-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
            Current rule tags
          </p>
          <div className="flex flex-wrap gap-2">
            {currentTags.length === 0 ? (
              <span className="text-sm text-slate-400 italic dark:text-slate-500">
                None
              </span>
            ) : (
              currentTags.map((t) => (
                <Chip key={t.tag_id} label={t.tag_name} tone="neutral" />
              ))
            )}
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
            If you update the rule
          </p>
          <div className="flex flex-wrap gap-2">
            {unchanged.map((t) => (
              <Chip key={`u-${t.tag_id}`} label={t.tag_name} tone="neutral" />
            ))}
            {added.map((t) => (
              <Chip
                key={`a-${t.tag_id}`}
                label={t.tag_name}
                tone="added"
                prefix="+"
              />
            ))}
            {removed.map((t) => (
              <Chip
                key={`r-${t.tag_id}`}
                label={t.tag_name}
                tone="removed"
                prefix="−"
                strike
              />
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="text-success-700 dark:text-success-400">
              + added
            </span>
            {' · '}
            <span className="line-through">− removed</span>
            {' · '}
            unchanged stays neutral. Future transactions for this beneficiary
            will follow the updated tags.
          </p>
        </div>
      </div>
    </Modal>
  );
}
