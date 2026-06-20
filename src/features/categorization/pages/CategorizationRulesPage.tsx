import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { apiFetch } from '../../../shared/api/apiClient';
import { routes } from '../../../shared/api/routes';
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog';
import {
  readRulePrefill,
  type RulePrefillState,
} from '../../../shared/navigation/rulePrefill';
import {
  HIGHLIGHT_DURATION_MS,
  scrollHighlightIntoView,
} from '../../../shared/utils/highlight';
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
import {
  CategorizationRuleFormDialog,
  type RulePrefillDraft,
} from '../components/CategorizationRuleFormDialog';
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


function errorMessage(err: unknown, fallback: string): string {
  const e = err as ApiErrorShape;
  return e?.detail || e?.error || fallback;
}

// View-model: owns the rules query, all the reference-data state and its
// load effect, the post-save highlight bookkeeping, and every handler.
// Keeps the page component a thin render (under the max-lines gate).
function useCategorizationRules() {
  const queryClient = useQueryClient();
  const { data: rulesData, isLoading: rulesLoading } =
    useCategorizationRulesQuery();
  const rules: CategorizationRule[] = useMemo(
    () => rulesData?.rules ?? [],
    [rulesData]
  );

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
  // Inbound pre-fill from another flow (e.g. a transaction redirect — see
  // shared/navigation/rulePrefill). `activePrefill` feeds the dialog; the ref
  // holds the originating txn whose rule_id we backfill after a create.
  const location = useLocation();
  const navigate = useNavigate();
  const [activePrefill, setActivePrefill] = useState<RulePrefillDraft | null>(
    null
  );
  const pendingBackfillTxnRef = useRef<number | null>(null);
  const prefillConsumedRef = useRef(false);

  const [highlightedGroupKey, setHighlightedGroupKey] = useState<string | null>(
    null
  );
  const [highlightedRuleUid, setHighlightedRuleUid] = useState<number | null>(
    null
  );
  const highlightTimer = useRef<number | null>(null);

  // Consume a one-shot rule pre-fill handed over via navigation state (another
  // feature redirected here to create/edit a rule). Open the right modal
  // pre-filled, remember any originating txn to backfill, then clear the state
  // so a re-render / back-nav doesn't re-trigger it. Edit waits for the rules
  // list so we can attach the persisted rule (the diff baseline).
  useEffect(() => {
    if (prefillConsumedRef.current) return;
    const prefill: RulePrefillState | null = readRulePrefill(location.state);
    if (!prefill) return;

    if (prefill.mode === 'edit') {
      if (rulesLoading) return; // wait for the rule to be available
      const rule = rules.find((r) => r.uid === prefill.ruleId);
      prefillConsumedRef.current = true;
      if (rule) {
        setActivePrefill({ tagIds: prefill.tagIds });
        setEditingRule(rule);
      }
    } else {
      prefillConsumedRef.current = true;
      setActivePrefill({
        beneficiaryId: prefill.beneficiaryId,
        beneficiaryName: prefill.beneficiaryName,
        tagIds: prefill.tagIds,
      });
      pendingBackfillTxnRef.current = prefill.originatingTxnId ?? null;
      setAddOpen(true);
    }
    // Clear the consumed state so it can't replay.
    navigate(location.pathname, { replace: true, state: null });
  }, [location.state, location.pathname, navigate, rules, rulesLoading]);

  useEffect(() => {
    void loadReferenceData();
    // clearTimeout(undefined) is a safe no-op, so no null-guard needed.
    return () => window.clearTimeout(highlightTimer.current ?? undefined);
  }, []);

  // Post-commit scroll to the highlighted rule row — runs after the save
  // rebuckets the list + force-opens its group, so the row is at its FINAL
  // position (an imperative scroll from the save handler would hit the stale
  // spot). Uses the shared helper (no-ops if already on screen).
  useEffect(() => {
    if (highlightedRuleUid == null) return;
    const raf = scrollHighlightIntoView(`rule-row-${highlightedRuleUid}`);
    return () => window.cancelAnimationFrame(raf);
  }, [highlightedRuleUid]);

  async function loadReferenceData() {
    try {
      const [tagsRes, bList, c] = await Promise.all([fetchTags(), fetchBeneficiaries(), fetchTagConstants()]); // prettier-ignore
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
    // Backfill: if this rule was created from a transaction redirect, stamp the
    // new rule_id onto that txn's tag rows via the transactions PATCH route
    // (shared client + route string — no transactions-feature import, so the
    // boundary holds). Provenance-only; nothing user-visible changes, so no
    // cache invalidation is needed.
    const txnId = pendingBackfillTxnRef.current;
    pendingBackfillTxnRef.current = null;
    if (txnId != null) {
      try {
        await apiFetch(`${routes.transactions.byId(txnId)}?rule_id=${uid}`, {
          method: 'PATCH',
          body: JSON.stringify({ tag_ids: [...tagIds] }),
        });
      } catch (err) {
        console.warn('rule_id backfill failed', err);
      }
    }
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
    setActivePrefill(null);
    pendingBackfillTxnRef.current = null;
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

  return {
    rules,
    rulesLoading,
    tags,
    beneficiaries,
    constants,
    busy,
    error,
    editingRule,
    activePrefill,
    confirmDelete,
    editingIsUserRule,
    dialogOpen: addOpen || editingRule != null,
    highlightedGroupKey,
    highlightedRuleUid,
    isUserRule,
    openAdd: () => setAddOpen(true),
    closeConfirm: () => setConfirmDelete(null),
    requestDeleteEditing: () => {
      if (editingRule) setConfirmDelete(editingRule);
    },
    handleEdit,
    handleCloseDialog,
    handleSaved,
    handleBeneficiaryCreated,
    handleTagCreated,
    handleConfirmDelete,
    handleReRun,
  };
}

// Categorization rules screen. The page itself is now thin — list
// rendering + reference-data plumbing + delete confirmation. The full
// CRUD form lives in `<CategorizationRuleFormDialog />` so the
// add/edit/view path is a single canonical surface (Batch 9.8 KISS +
// per-feature FooFormDialog convention).
export function CategorizationRulesPage() {
  const {
    rules,
    rulesLoading,
    tags,
    beneficiaries,
    constants,
    busy,
    error,
    editingRule,
    activePrefill,
    confirmDelete,
    editingIsUserRule,
    dialogOpen,
    highlightedGroupKey,
    highlightedRuleUid,
    isUserRule,
    openAdd,
    closeConfirm,
    requestDeleteEditing,
    handleEdit,
    handleCloseDialog,
    handleSaved,
    handleBeneficiaryCreated,
    handleTagCreated,
    handleConfirmDelete,
    handleReRun,
  } = useCategorizationRules();

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
              onClick={openAdd}
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
        prefill={activePrefill}
        tags={tags}
        beneficiaries={beneficiaries}
        constants={constants}
        rules={rules}
        isUserRule={editingIsUserRule}
        onSaved={handleSaved}
        onRequestDelete={requestDeleteEditing}
        onBeneficiaryCreated={handleBeneficiaryCreated}
        onTagCreated={handleTagCreated}
      />

      <ConfirmDialog
        open={confirmDelete != null}
        onClose={closeConfirm}
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
