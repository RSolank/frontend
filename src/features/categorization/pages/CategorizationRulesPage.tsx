import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';

import { ConfirmDialog } from '../../../shared/components/ConfirmDialog';
import { deleteCategorizationRule } from '../../beneficiaries/api/mutations';
import { fetchBeneficiaries } from '../../beneficiaries/api/queries';
import type { Beneficiary } from '../../beneficiaries/api/queries';
import type { CreatedTag } from '../../tags/api/mutations';
import { fetchTagConstants, fetchTags } from '../../tags/api/queries';
import { tagSetKey } from '../api/grouping';
import { categorizationKeys } from '../api/keys';
import { reRunCategorizationRequest } from '../api/mutations';
import {
  useCategorizationRulesQuery,
  type CategorizationRule,
} from '../api/queries';
import { flattenTags, type FlatTag } from '../api/ruleUtils';
import { CategorizationRuleFormDialog } from '../components/CategorizationRuleFormDialog';
import { GroupedRulesList } from '../components/GroupedRulesList';

interface ApiErrorShape {
  detail?: string;
  error?: string;
}

interface Constants {
  SYSTEM_USER_ID?: number;
  TOTAL_TAG_ID?: number;
  MISCELLANEOUS_TAG_ID?: number;
  [key: string]: unknown;
}

// How long the post-save indigo ring stays on the destination rule row
// before fading out. Long enough for the user to spot it after the list
// rebuckets; short enough not to feel like a stuck loading state.
const HIGHLIGHT_DURATION_MS = 1500;

function errorMessage(err: unknown, fallback: string): string {
  const e = err as ApiErrorShape;
  return e?.detail || e?.error || fallback;
}

// Categorization rules screen. The page itself is now thin — list
// rendering + reference-data plumbing + delete confirmation. The full
// CRUD form lives in `<CategorizationRuleFormDialog />` so the
// add/edit/view path is a single canonical surface (Batch 9.8 KISS +
// per-feature FooFormDialog convention).
export function CategorizationRulesPage() {
  const queryClient = useQueryClient();
  const { data: rulesData, isLoading: rulesLoading } =
    useCategorizationRulesQuery();
  const rules: CategorizationRule[] = rulesData?.rules ?? [];

  const [tags, setTags] = useState<FlatTag[]>([]);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [constants, setConstants] = useState<Constants | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editingRule, setEditingRule] = useState<CategorizationRule | null>(
    null
  );
  const [addOpen, setAddOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<CategorizationRule | null>(
    null
  );

  const [highlightedGroupKey, setHighlightedGroupKey] = useState<string | null>(
    null
  );
  const [highlightedRuleUid, setHighlightedRuleUid] = useState<number | null>(
    null
  );
  const highlightTimer = useRef<number | null>(null);

  useEffect(() => {
    void loadReferenceData();
    return () => {
      if (highlightTimer.current != null) {
        window.clearTimeout(highlightTimer.current);
      }
    };
  }, []);

  async function loadReferenceData() {
    try {
      const [tagsRes, bList, c] = await Promise.all([
        fetchTags(),
        fetchBeneficiaries(),
        fetchTagConstants(),
      ]);
      setTags(flattenTags(tagsRes.tags));
      setBeneficiaries(bList);
      setConstants(c as Constants);
    } catch (err) {
      setError(errorMessage(err, 'Failed to load reference data'));
    }
  }

  function isUserRule(rule: CategorizationRule): boolean {
    return (
      rule.created_by != null && rule.created_by !== constants?.SYSTEM_USER_ID
    );
  }

  const editingIsUserRule = useMemo(
    () => (editingRule != null ? isUserRule(editingRule) : false),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editingRule, constants]
  );

  function invalidateRules() {
    return queryClient.invalidateQueries({
      queryKey: categorizationKeys.rules(),
    });
  }

  function highlightRule(uid: number, tagIds: readonly number[]) {
    setHighlightedGroupKey(tagSetKey(tagIds));
    setHighlightedRuleUid(uid);
    if (highlightTimer.current != null) {
      window.clearTimeout(highlightTimer.current);
    }
    highlightTimer.current = window.setTimeout(() => {
      setHighlightedRuleUid(null);
    }, HIGHLIGHT_DURATION_MS);
  }

  async function handleSaved(uid: number, tagIds: readonly number[]) {
    await invalidateRules();
    highlightRule(uid, tagIds);
  }

  async function handleBeneficiaryCreated(b: Beneficiary) {
    // Refresh the local list so subsequent picks see the new id; the
    // dialog auto-selects it via its own onSaved path.
    setBeneficiaries((prev) =>
      prev.some((x) => x.uid === b.uid) ? prev : [...prev, b]
    );
  }

  async function handleTagCreated(_created?: CreatedTag) {
    try {
      const next = await fetchTags();
      setTags(flattenTags(next.tags));
    } catch (err) {
      console.warn('Failed to refresh tags after create', err);
    }
  }

  function handleEdit(r: CategorizationRule) {
    setError(null);
    setEditingRule(r);
  }

  function handleCloseDialog() {
    setEditingRule(null);
    setAddOpen(false);
  }

  async function handleConfirmDelete() {
    if (!confirmDelete) return;
    setError(null);
    setBusy(true);
    try {
      await deleteCategorizationRule(confirmDelete.uid);
      await invalidateRules();
      setConfirmDelete(null);
      // Close the form dialog too — it was showing the now-deleted
      // rule.
      handleCloseDialog();
    } catch (err) {
      setError(errorMessage(err, 'Failed to delete rule'));
    } finally {
      setBusy(false);
    }
  }

  async function handleReRun() {
    setError(null);
    setBusy(true);
    try {
      await reRunCategorizationRequest();
      await invalidateRules();
    } catch (err) {
      setError(errorMessage(err, 'Re-run failed'));
    } finally {
      setBusy(false);
    }
  }

  const dialogOpen = addOpen || editingRule != null;

  return (
    <>
      <section className="mb-6 rounded-xl bg-white p-4 shadow-sm sm:p-6 dark:bg-slate-900 dark:shadow-none dark:ring-1 dark:ring-slate-800">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Rule management
          </h2>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleReRun}
              disabled={busy}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Re-run categorization
            </button>
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="btn-primary !w-auto"
            >
              Add Rule
            </button>
          </div>
        </div>

        {error && <div className="form-error mt-4">{error}</div>}
      </section>

      <section className="rounded-xl bg-white p-4 shadow-sm sm:p-6 dark:bg-slate-900 dark:shadow-none dark:ring-1 dark:ring-slate-800">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Existing rules
          </h2>
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {rulesLoading ? 'Loading…' : `${rules.length} rules total`}
          </span>
        </div>

        {rulesLoading && rules.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500">
            Loading rules…
          </p>
        ) : (
          <GroupedRulesList
            rules={rules}
            flatTags={tags}
            isUserRule={isUserRule}
            onEdit={handleEdit}
            highlightedGroupKey={highlightedGroupKey}
            highlightedRuleUid={highlightedRuleUid}
          />
        )}
      </section>

      <CategorizationRuleFormDialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        editingRule={editingRule}
        tags={tags}
        beneficiaries={beneficiaries}
        constants={constants}
        rules={rules}
        isUserRule={editingIsUserRule}
        onSaved={handleSaved}
        onRequestDelete={() => {
          if (editingRule) setConfirmDelete(editingRule);
        }}
        onBeneficiaryCreated={handleBeneficiaryCreated}
        onTagCreated={handleTagCreated}
      />

      <ConfirmDialog
        open={confirmDelete != null}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleConfirmDelete}
        intent="danger"
        title="Delete categorization rule"
        message={
          confirmDelete
            ? `Delete the rule for "${confirmDelete.beneficiary_name || 'this beneficiary'}"? Existing transactions keep their tags.`
            : ''
        }
        confirmLabel="Delete"
        busy={busy}
      />
    </>
  );
}
