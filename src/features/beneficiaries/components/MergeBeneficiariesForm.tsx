import { useMemo } from 'react';

import { SearchableSelect } from '../../../shared/components/SearchableSelect';
import { ModalReveal, RevealField } from '../../../shared/motion/ModalReveal';
import type { Beneficiary } from '../api/queries';

// One typeahead option per beneficiary, with a pinned placeholder as the
// "no selection" no-op. Shared by the source + target pickers (identical
// bodies before — extracting also drops the duplicated `||` branches out
// of the component body).
function buildBeneficiaryOptions(
  beneficiaries: Beneficiary[],
  placeholder: string
) {
  return [
    { value: '', label: placeholder },
    ...beneficiaries.map((b) => ({
      value: String(b.uid),
      label: `${b.name} (${b.beneficiary_type || 'unknown'})`,
    })),
  ];
}

// Resolve the selected source/target rows + their display types and
// whether they're a type mismatch. Pure derivation pulled out of the
// component so the body is just render.
function describeMergePair(
  beneficiaries: Beneficiary[],
  mergeSource: string,
  mergeTarget: string
) {
  const source = beneficiaries.find(
    (b) => String(b.uid) === String(mergeSource)
  );
  const target = beneficiaries.find(
    (b) => String(b.uid) === String(mergeTarget)
  );
  const typeMismatch = Boolean(
    source &&
    target &&
    source.beneficiary_type &&
    target.beneficiary_type &&
    source.beneficiary_type !== target.beneficiary_type
  );
  return {
    source,
    target,
    sourceType: source?.beneficiary_type || '—',
    targetType: target?.beneficiary_type || '—',
    typeMismatch,
  };
}

interface MergeBeneficiariesFormProps {
  beneficiaries: Beneficiary[];
  mergeSource: string;
  mergeTarget: string;
  onSourceChange: (value: string) => void;
  onTargetChange: (value: string) => void;
  onSwap: () => void;
  onMerge: () => void;
}

export function MergeBeneficiariesForm({
  beneficiaries,
  mergeSource,
  mergeTarget,
  onSourceChange,
  onTargetChange,
  onSwap,
  onMerge,
}: MergeBeneficiariesFormProps) {
  const { source, target, sourceType, targetType, typeMismatch } =
    describeMergePair(beneficiaries, mergeSource, mergeTarget);
  const sourceSelectId = 'merge-source-select';
  const targetSelectId = 'merge-target-select';

  // Build the typeahead options once per render. Empty option pinned
  // at the top doubles as the "no selection" no-op state (matches the
  // FilterSidebar tag picker pattern). Per CONTRIBUTING.md §6, a
  // data-driven dropdown over the beneficiary list meets the
  // searchable-dropdown threshold (>15 items / data-driven /
  // no scan-order).
  const sourceOptions = useMemo(
    () => buildBeneficiaryOptions(beneficiaries, 'Select source...'),
    [beneficiaries]
  );
  const targetOptions = useMemo(
    () => buildBeneficiaryOptions(beneficiaries, 'Select target...'),
    [beneficiaries]
  );

  return (
    <ModalReveal className="border-warning-200 bg-warning-50 dark:border-warning-900/50 dark:bg-warning-950/30 mt-6 rounded-xl border p-5">
      <RevealField>
        <h3 className="text-warning-900 dark:text-warning-200 mt-0 mb-3 text-base font-semibold">
          Consolidate Beneficiaries
        </h3>
      </RevealField>

      <RevealField className="border-warning-200 dark:border-warning-900/50 mb-4 rounded-lg border bg-white px-4 py-3 dark:bg-slate-900">
        <div className="flex flex-wrap gap-4 text-sm text-slate-700 dark:text-slate-200">
          <span>
            <strong>Source:</strong> {source?.name || 'Select a source'} (
            {sourceType})
          </span>
          <span>
            <strong>Target:</strong> {target?.name || 'Select a target'} (
            {targetType})
          </span>
        </div>
        {typeMismatch ? (
          <p className="text-warning-800 dark:text-warning-300 mt-3 mb-0 text-sm font-semibold">
            Type mismatch detected. The source detail row will be merged into
            the matching target side first: merchant fields map to merchant
            fields, person fields map to person fields, and any missing values
            on the target are filled in before the source row is removed.
          </p>
        ) : (
          source &&
          target && (
            <p className="mt-3 mb-0 text-sm text-slate-500 dark:text-slate-400">
              Types match. The selected beneficiary record will be consolidated
              into the target.
            </p>
          )
        )}
      </RevealField>

      {/*
        Mobile-first layout: stack source above target on narrow
        viewports, then move to a 2-up grid at sm+. Keeping Swap +
        Merge on their own action row stops the swap arrow from
        landing between the selects when flex-wrap triggered (the
        prior layout left ⇄ orphaned on its own row at <sm).
      */}
      <RevealField className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={sourceSelectId} className="form-label">
            Merge Source (will be deleted)
          </label>
          <SearchableSelect
            id={sourceSelectId}
            ariaLabel="Merge source beneficiary"
            placeholder="Select source..."
            value={mergeSource}
            options={sourceOptions}
            onChange={onSourceChange}
          />
        </div>
        <div>
          <label htmlFor={targetSelectId} className="form-label">
            Into Target (will keep)
          </label>
          <SearchableSelect
            id={targetSelectId}
            ariaLabel="Merge target beneficiary"
            placeholder="Select target..."
            value={mergeTarget}
            options={targetOptions}
            onChange={onTargetChange}
          />
        </div>
      </RevealField>

      <RevealField className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onSwap}
          title="Swap source and target"
          aria-label="Swap source and target"
          className="tap-press inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <span aria-hidden="true">⇄</span>
          <span>Swap</span>
        </button>

        <button
          type="button"
          onClick={onMerge}
          className="tap-press bg-warning-700 hover:bg-warning-800 focus-visible:ring-warning-500 dark:bg-warning-600 dark:hover:bg-warning-500 ml-auto rounded-md px-4 py-2 text-sm font-semibold text-white transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none dark:focus-visible:ring-offset-slate-950"
        >
          Merge
        </button>
      </RevealField>
    </ModalReveal>
  );
}
