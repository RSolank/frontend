import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';

import { ConfirmDialog } from '../../../shared/components/ConfirmDialog';
import { Modal } from '../../../shared/components/Modal';
import { BeneficiaryFormDialog } from '../../beneficiaries/components/BeneficiaryFormDialog';
import { TagFormDialog } from '../../tags/components/TagFormDialog';
import type { CreatedTag } from '../../tags/api/mutations';
import {
  fetchBeneficiaries,
  type Beneficiary,
} from '../../beneficiaries/api/queries';
import {
  createCategorizationRule,
  deleteCategorizationRule,
} from '../../beneficiaries/api/mutations';
import { fetchTagConstants, fetchTags } from '../../tags/api/queries';
import { GroupedRulesList } from '../components/GroupedRulesList';
import { categorizationKeys } from '../api/keys';
import { tagSetKey } from '../api/grouping';
import {
  reRunCategorizationRequest,
  updateCategorizationRuleRequest,
} from '../api/mutations';
import {
  useCategorizationRulesQuery,
  type CategorizationRule,
} from '../api/queries';
import {
  buildRuleName,
  flattenTags,
  formatTagAssignment,
  type FlatTag,
} from '../api/ruleUtils';

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

interface FormState {
  uid: number | null;
  beneficiary_id: number | '';
  beneficiary_name: string;
  tag_ids: number[];
  notes: string;
}

const EMPTY_FORM: FormState = {
  uid: null,
  beneficiary_id: '',
  beneficiary_name: '',
  tag_ids: [],
  notes: '',
};

// How long the post-save indigo ring stays on the destination rule row
// before fading out. Long enough for the user to spot it after the list
// rebuckets; short enough not to feel like a stuck loading state.
const HIGHLIGHT_DURATION_MS = 1500;

function errorMessage(err: unknown, fallback: string): string {
  const e = err as ApiErrorShape;
  return e?.detail || e?.error || fallback;
}

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

  const [isFormVisible, setIsFormVisible] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<CategorizationRule | null>(
    null
  );
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [bSearch, setBSearch] = useState('');
  const [bSearchFocused, setBSearchFocused] = useState(false);
  const [beneficiaryConflict, setBeneficiaryConflict] = useState<string | null>(
    null
  );

  // Tag picker (SearchableList pattern — see CONTRIBUTING.md §6).
  // Text-input search + dropdown + sticky "+ Add new tag" as the
  // first item; selections shown as chips below.
  const [tagSearch, setTagSearch] = useState('');
  const [tagSearchFocused, setTagSearchFocused] = useState(false);

  // Create-beneficiary modal state. Pre-fill is the current search text
  // so a user typing a brand-new name doesn't retype it.
  const [createBeneficiaryOpen, setCreateBeneficiaryOpen] = useState(false);

  // Create-tag modal — mirrors the beneficiary CTA so users can mint a
  // missing tag inline without losing their in-flight rule draft.
  const [createTagOpen, setCreateTagOpen] = useState(false);

  // Post-save UX: auto-expand the destination group + ring the saved
  // rule row briefly so the user can see where the rule landed after a
  // potential group rebucket.
  const [highlightedGroupKey, setHighlightedGroupKey] = useState<string | null>(
    null
  );
  const [highlightedRuleUid, setHighlightedRuleUid] = useState<number | null>(
    null
  );
  const highlightTimer = useRef<number | null>(null);

  const isEditing = form.uid != null;

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

  useEffect(() => {
    if (!form.beneficiary_id) {
      setBeneficiaryConflict(null);
      return;
    }
    const existing = rules.find(
      (r) =>
        r.beneficiary_id === form.beneficiary_id &&
        (!isEditing || r.uid !== form.uid)
    );
    setBeneficiaryConflict(
      existing
        ? `A rule already exists for beneficiary "${existing.beneficiary_name}"`
        : null
    );
  }, [form.beneficiary_id, form.uid, rules, isEditing]);

  const filteredTags = useMemo(
    () =>
      tags.filter(
        (t) =>
          t.tag_id !== constants?.TOTAL_TAG_ID &&
          t.tag_id !== constants?.MISCELLANEOUS_TAG_ID
      ),
    [tags, constants]
  );

  const generatedRuleName = useMemo(
    () => buildRuleName(form.beneficiary_name, form.tag_ids, tags),
    [form.beneficiary_name, form.tag_ids, tags]
  );

  const availableBeneficiaries = useMemo(
    () =>
      beneficiaries.filter(
        (b) => !bSearch || b.name.toLowerCase().includes(bSearch.toLowerCase())
      ),
    [beneficiaries, bSearch]
  );

  function invalidateRules() {
    return queryClient.invalidateQueries({
      queryKey: categorizationKeys.rules(),
    });
  }

  function isUserRule(rule: CategorizationRule): boolean {
    return (
      rule.created_by != null && rule.created_by !== constants?.SYSTEM_USER_ID
    );
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setBSearch('');
    setBeneficiaryConflict(null);
    setIsFormVisible(false);
  }

  function selectBeneficiaryById(id: number, name: string) {
    setBSearch(name);
    setForm((f) => ({
      ...f,
      beneficiary_id: id,
      beneficiary_name: name,
    }));
    setBSearchFocused(false);
  }

  function handleSelectBeneficiary(b: Beneficiary) {
    selectBeneficiaryById(b.uid, b.name);
  }

  function handleAddNewBeneficiary() {
    setCreateBeneficiaryOpen(true);
    setBSearchFocused(false);
  }

  async function handleBeneficiaryCreated(b: Beneficiary) {
    // Refresh the local list so the new id appears in the dropdown +
    // any future search, then auto-select it for the in-flight rule.
    try {
      const next = await fetchBeneficiaries();
      setBeneficiaries(next);
    } catch (err) {
      console.warn('Failed to refresh beneficiaries after create', err);
    }
    selectBeneficiaryById(b.uid, b.name);
  }

  async function handleTagCreated(created?: CreatedTag) {
    // Refresh the local tag list so the new tag is selectable. Then
    // auto-pick it into the in-flight rule (same UX as the
    // beneficiary auto-select after CreateBeneficiaryDialog).
    try {
      const next = await fetchTags();
      setTags(flattenTags(next.tags));
    } catch (err) {
      console.warn('Failed to refresh tags after create', err);
    }
    if (created?.tag_id != null && !form.tag_ids.includes(created.tag_id)) {
      setForm((f) => ({ ...f, tag_ids: [...f.tag_ids, created.tag_id] }));
    }
  }

  // One-click tag pick — fires immediately on dropdown change. The
  // dropdown is value-bound to '' so it resets to the prompt after
  // every pick. Already-selected tags are filtered out of the
  // options below so re-picking the same tag isn't possible. Undo =
  // chip × button.
  function handlePickTag(raw: string) {
    if (!raw) return;
    const tid = parseInt(raw, 10);
    if (Number.isNaN(tid) || form.tag_ids.includes(tid)) return;
    setForm((f) => ({ ...f, tag_ids: [...f.tag_ids, tid] }));
  }

  function handleRemoveTag(tid: number) {
    setForm((f) => ({
      ...f,
      tag_ids: f.tag_ids.filter((id) => id !== tid),
    }));
  }

  function handlePromoteTag(tid: number) {
    setForm((f) => ({
      ...f,
      tag_ids: [tid, ...f.tag_ids.filter((id) => id !== tid)],
    }));
  }

  function highlightRule(uid: number, tagIds: readonly number[]) {
    setHighlightedGroupKey(tagSetKey(tagIds));
    setHighlightedRuleUid(uid);
    if (highlightTimer.current != null) {
      window.clearTimeout(highlightTimer.current);
    }
    highlightTimer.current = window.setTimeout(() => {
      setHighlightedRuleUid(null);
      // Keep the group expanded; the user can collapse it manually.
      // Only the ring fades.
    }, HIGHLIGHT_DURATION_MS);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!form.beneficiary_id) {
      setError('Please select a beneficiary');
      return;
    }
    if (beneficiaryConflict) {
      setError(beneficiaryConflict);
      return;
    }
    if (form.tag_ids.length === 0) {
      setError('At least one tag is required');
      return;
    }
    if (!generatedRuleName) {
      setError('Could not generate rule name');
      return;
    }

    const payload = {
      name: generatedRuleName,
      beneficiary_id: form.beneficiary_id,
      tag_ids: form.tag_ids,
      notes: form.notes || null,
    };

    try {
      setBusy(true);
      let savedUid: number;
      if (isEditing && form.uid != null) {
        await updateCategorizationRuleRequest(form.uid, payload);
        savedUid = form.uid;
      } else {
        const res = await createCategorizationRule(payload);
        savedUid = res.rule.uid;
      }
      resetForm();
      await invalidateRules();
      highlightRule(savedUid, payload.tag_ids);
    } catch (err) {
      setError(errorMessage(err, 'Failed to save rule'));
    } finally {
      setBusy(false);
    }
  }

  function handleEdit(r: CategorizationRule) {
    setError(null);
    setForm({
      uid: r.uid,
      beneficiary_id: r.beneficiary_id,
      beneficiary_name: r.beneficiary_name || '',
      tag_ids: [...(r.tag_ids || [])],
      notes: r.notes || '',
    });
    setBSearch(r.beneficiary_name || '');
    setIsFormVisible(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleDelete(uid: number) {
    const rule = rules.find((r) => r.uid === uid);
    if (!rule) return;
    setConfirmDelete(rule);
  }

  async function handleConfirmDelete() {
    if (!confirmDelete) return;
    setError(null);
    setBusy(true);
    try {
      await deleteCategorizationRule(confirmDelete.uid);
      await invalidateRules();
      setConfirmDelete(null);
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

  // Card-anchored layout (Batch 9 polish): page mounted under
  // SettingsLayout shell — outer gutter + breadcrumb + sidebar are
  // already provided. Page renders only its cards so card top aligns
  // with sidebar first NavLink.
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
              onClick={() => setIsFormVisible(true)}
              className="btn-primary !w-auto"
            >
              Add Rule
            </button>
          </div>
        </div>

        <Modal
          open={isFormVisible}
          onClose={resetForm}
          size="lg"
          title={isEditing ? 'Edit categorization rule' : 'Add categorization rule'}
        >
          <form
            onSubmit={handleSubmit}
            className="grid gap-4"
          >
            <div>
              <span className="form-label">Rule name</span>
              {/* Computed display, not an input. Renders on the form
                  panel's own background so it doesn't masquerade as an
                  editable field. Min-height matches a form-input so
                  the row doesn't shift when the placeholder text
                  swaps in. */}
              <output
                aria-live="polite"
                className="block min-h-[2.5rem] px-1 py-2 text-sm leading-6 break-words text-slate-700 dark:text-slate-200"
              >
                {generatedRuleName || (
                  <span className="text-slate-400 italic dark:text-slate-500">
                    Select a beneficiary and at least one tag…
                  </span>
                )}
              </output>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Auto-generated from the selected beneficiary and tags.
              </p>
            </div>

            <div className="relative">
              <label htmlFor="rule-beneficiary-search" className="form-label">
                Beneficiary
              </label>
              <input
                id="rule-beneficiary-search"
                value={bSearch}
                onChange={(e) => {
                  setBSearch(e.target.value);
                  setForm((f) => ({
                    ...f,
                    beneficiary_id: '',
                    beneficiary_name: '',
                  }));
                }}
                onFocus={() => setBSearchFocused(true)}
                onBlur={() => window.setTimeout(() => setBSearchFocused(false), 200)}
                placeholder="Search beneficiary..."
                required
                className="form-input"
              />
              {bSearchFocused && (
                <div className="absolute top-full right-0 left-0 z-10 mt-1 max-h-52 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
                  <button
                    type="button"
                    onMouseDown={handleAddNewBeneficiary}
                    className="flex w-full items-center gap-1.5 border-b border-slate-200 bg-indigo-50/40 px-3 py-2 text-left text-sm font-semibold text-indigo-700 hover:bg-indigo-100 dark:border-slate-700 dark:bg-indigo-950/30 dark:text-indigo-300 dark:hover:bg-indigo-950/50"
                  >
                    <span aria-hidden="true">＋</span>
                    Add new beneficiary
                  </button>
                  {availableBeneficiaries.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-slate-400 dark:text-slate-500">
                      No matches
                    </div>
                  ) : (
                    availableBeneficiaries.map((b) => (
                      <div
                        key={b.uid}
                        role="option"
                        aria-selected={form.beneficiary_id === b.uid}
                        tabIndex={0}
                        onMouseDown={() => handleSelectBeneficiary(b)}
                        className="cursor-pointer px-3 py-2 text-sm text-slate-700 hover:bg-indigo-50 dark:text-slate-200 dark:hover:bg-indigo-950/40"
                      >
                        {b.name}
                        {b.aliases?.length > 0 && (
                          <span className="ml-2 text-xs text-slate-400 dark:text-slate-500">
                            ({b.aliases.join(', ')})
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
              {beneficiaryConflict && (
                <div className="form-error mt-1">{beneficiaryConflict}</div>
              )}
            </div>

            <div className="relative">
              <label htmlFor="rule-tag-search" className="form-label">
                Tags
              </label>
              {/*
                SearchableList (CONTRIBUTING.md §6 "Searchable list with
                inline create"). Text input filters the dropdown; the
                "+ Add new tag" CTA is the sticky first item and stays
                visible even when zero tags match the query. Already-
                selected tag ids are filtered out of the dropdown; the
                chip × button is the undo path.
              */}
              <input
                id="rule-tag-search"
                value={tagSearch}
                onChange={(e) => setTagSearch(e.target.value)}
                onFocus={() => setTagSearchFocused(true)}
                onBlur={() =>
                  window.setTimeout(() => setTagSearchFocused(false), 200)
                }
                placeholder="Search tags..."
                className="form-input"
                autoComplete="off"
              />
              {tagSearchFocused &&
                (() => {
                  const q = tagSearch.trim().toLowerCase();
                  const matches = filteredTags.filter((t) => {
                    if (form.tag_ids.includes(t.tag_id)) return false;
                    if (!q) return true;
                    return formatTagAssignment(t.tag_id, tags)
                      .toLowerCase()
                      .includes(q);
                  });
                  return (
                    <div className="absolute top-full right-0 left-0 z-10 mt-1 max-h-52 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
                      <button
                        type="button"
                        onMouseDown={() => {
                          setCreateTagOpen(true);
                          setTagSearchFocused(false);
                        }}
                        className="flex w-full items-center gap-1.5 border-b border-slate-200 bg-indigo-50/40 px-3 py-2 text-left text-sm font-semibold text-indigo-700 hover:bg-indigo-100 dark:border-slate-700 dark:bg-indigo-950/30 dark:text-indigo-300 dark:hover:bg-indigo-950/50"
                      >
                        <span aria-hidden="true">＋</span>
                        Add new tag
                      </button>
                      {matches.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-slate-400 dark:text-slate-500">
                          No matches
                        </div>
                      ) : (
                        matches.map((t) => (
                          <button
                            key={t.tag_id}
                            type="button"
                            onMouseDown={() => {
                              handlePickTag(String(t.tag_id));
                              setTagSearch('');
                            }}
                            className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-indigo-50 dark:text-slate-200 dark:hover:bg-indigo-950/40"
                          >
                            {formatTagAssignment(t.tag_id, tags)}
                          </button>
                        ))
                      )}
                    </div>
                  );
                })()}
              <div className="mt-2 flex min-h-12 flex-wrap gap-2 rounded-md border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900">
                {form.tag_ids.length === 0 ? (
                  <span className="text-sm text-slate-400 dark:text-slate-500">
                    No tags selected
                  </span>
                ) : (
                  form.tag_ids.map((tid, idx) => {
                    const isPrimary = idx === 0;
                    const chipBase =
                      'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold border';
                    const chipColor = isPrimary
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50'
                      : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700';
                    return (
                      <span key={tid} className={`${chipBase} ${chipColor}`}>
                        {formatTagAssignment(tid, tags)}
                        {isPrimary ? (
                          <span className="rounded-sm bg-emerald-700 px-1 py-px text-[10px] font-bold tracking-wide text-white uppercase">
                            Primary
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handlePromoteTag(tid)}
                            className="rounded-sm bg-indigo-600 px-1 py-px text-[10px] font-bold tracking-wide text-white uppercase hover:bg-indigo-700"
                          >
                            Set Primary
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tid)}
                          aria-label={`Remove tag ${formatTagAssignment(tid, tags)}`}
                          className="ml-0.5 text-base leading-none font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                        >
                          ×
                        </button>
                      </span>
                    );
                  })
                )}
              </div>
            </div>

            <div>
              <label htmlFor="rule-notes" className="form-label">
                Notes (optional)
              </label>
              <input
                id="rule-notes"
                value={form.notes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notes: e.target.value }))
                }
                className="form-input"
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={resetForm}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy || !!beneficiaryConflict || !form.beneficiary_id}
                className="btn-primary !w-auto"
              >
                {isEditing ? 'Update Rule' : 'Create Rule'}
              </button>
            </div>
          </form>
        </Modal>

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
            onDelete={handleDelete}
            highlightedGroupKey={highlightedGroupKey}
            highlightedRuleUid={highlightedRuleUid}
          />
        )}
      </section>

      <BeneficiaryFormDialog
        open={createBeneficiaryOpen}
        onClose={() => setCreateBeneficiaryOpen(false)}
        onSaved={handleBeneficiaryCreated}
        initialName={bSearch}
      />

      <TagFormDialog
        open={createTagOpen}
        onClose={() => setCreateTagOpen(false)}
        onSaved={handleTagCreated}
        flatTags={tags.map((t) => ({ tag_id: t.tag_id, tag_name: t.tag_name }))}
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
