import { Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { Modal } from '../../../shared/components/Modal';
import {
  createCategorizationRule,
} from '../../beneficiaries/api/mutations';
import {
  fetchBeneficiaries,
  type Beneficiary,
} from '../../beneficiaries/api/queries';
import { BeneficiaryFormDialog } from '../../beneficiaries/components/BeneficiaryFormDialog';
import { fetchTags } from '../../tags/api/queries';
import type { CreatedTag } from '../../tags/api/mutations';
import { TagFormDialog } from '../../tags/components/TagFormDialog';
import { updateCategorizationRuleRequest } from '../api/mutations';
import type { CategorizationRule } from '../api/queries';
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
  TOTAL_TAG_ID?: number;
  MISCELLANEOUS_TAG_ID?: number;
  [key: string]: unknown;
}

interface FormState {
  beneficiary_id: number | '';
  beneficiary_name: string;
  tag_ids: number[];
  notes: string;
}

const EMPTY_FORM: FormState = {
  beneficiary_id: '',
  beneficiary_name: '',
  tag_ids: [],
  notes: '',
};

function errorMessage(err: unknown, fallback: string): string {
  const e = err as ApiErrorShape;
  return e?.detail || e?.error || fallback;
}

interface CategorizationRuleFormDialogProps {
  open: boolean;
  onClose: () => void;
  // Null = Add flow. Populated = Edit flow.
  editingRule: CategorizationRule | null;
  // Reference data the form binds to.
  tags: FlatTag[];
  beneficiaries: Beneficiary[];
  constants: Constants | null;
  // Existing rules — used to detect a beneficiary-already-has-a-rule
  // conflict before save (matches the legacy page-embedded UX).
  rules: CategorizationRule[];
  // Whether the editing rule is owned by the user. Drives the system /
  // user pill in the modal description and gates the trash in the
  // header per the DetailModal convention.
  isUserRule: boolean;
  // Fired after a successful save with the rule's uid + tag set, so
  // the parent can highlight the destination row + invalidate queries.
  onSaved: (uid: number, tagIds: readonly number[]) => void | Promise<void>;
  // Trash-in-header path. Only invoked for user rules in edit mode.
  onRequestDelete: () => void;
  // Local-list refresh callbacks — fired after the nested
  // BeneficiaryFormDialog / TagFormDialog finish creating, so the
  // parent's cached lists pick up the new id before this dialog
  // auto-selects it.
  onBeneficiaryCreated: (b: Beneficiary) => void | Promise<void>;
  onTagCreated: (created?: CreatedTag) => void | Promise<void>;
}

// Single canonical CRUD surface for a categorization rule. Wraps the
// shared Modal with the rule form, the SearchableList beneficiary +
// tag pickers, and the nested BeneficiaryFormDialog / TagFormDialog
// so users can mint a missing beneficiary/tag mid-rule without
// losing in-flight draft state. Add vs Edit branches purely on the
// presence of `editingRule`.
export function CategorizationRuleFormDialog({
  open,
  onClose,
  editingRule,
  tags,
  beneficiaries,
  constants,
  rules,
  isUserRule,
  onSaved,
  onRequestDelete,
  onBeneficiaryCreated,
  onTagCreated,
}: CategorizationRuleFormDialogProps) {
  const isEditing = editingRule != null;

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [bSearch, setBSearch] = useState('');
  const [bSearchFocused, setBSearchFocused] = useState(false);
  const [tagSearch, setTagSearch] = useState('');
  const [tagSearchFocused, setTagSearchFocused] = useState(false);
  const [beneficiaryConflict, setBeneficiaryConflict] = useState<string | null>(
    null
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createBeneficiaryOpen, setCreateBeneficiaryOpen] = useState(false);
  const [createTagOpen, setCreateTagOpen] = useState(false);

  // Reset / hydrate the form whenever the dialog (re)opens. Add
  // resets to empty; Edit copies the editing rule.
  useEffect(() => {
    if (!open) return;
    if (editingRule) {
      setForm({
        beneficiary_id: editingRule.beneficiary_id,
        beneficiary_name: editingRule.beneficiary_name || '',
        tag_ids: [...(editingRule.tag_ids || [])],
        notes: editingRule.notes || '',
      });
      setBSearch(editingRule.beneficiary_name || '');
    } else {
      setForm(EMPTY_FORM);
      setBSearch('');
    }
    setTagSearch('');
    setBSearchFocused(false);
    setTagSearchFocused(false);
    setBeneficiaryConflict(null);
    setBusy(false);
    setError(null);
  }, [open, isEditing, editingRule]);

  const originalForm = useMemo<FormState>(
    () =>
      editingRule
        ? {
            beneficiary_id: editingRule.beneficiary_id,
            beneficiary_name: editingRule.beneficiary_name || '',
            tag_ids: [...(editingRule.tag_ids || [])],
            notes: editingRule.notes || '',
          }
        : EMPTY_FORM,
    [editingRule]
  );

  const isDirty = useMemo(() => {
    if (!isEditing) return true;
    return JSON.stringify(form) !== JSON.stringify(originalForm);
  }, [isEditing, form, originalForm]);


  // Beneficiary-conflict check — one rule per beneficiary.
  useEffect(() => {
    if (!open) return;
    if (!form.beneficiary_id) {
      setBeneficiaryConflict(null);
      return;
    }
    const conflict = rules.find(
      (r) =>
        r.beneficiary_id === form.beneficiary_id &&
        (!isEditing || r.uid !== editingRule?.uid)
    );
    setBeneficiaryConflict(
      conflict
        ? `A rule already exists for beneficiary "${conflict.beneficiary_name}"`
        : null
    );
  }, [open, form.beneficiary_id, rules, isEditing, editingRule]);

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

  function selectBeneficiaryById(id: number, name: string) {
    setBSearch(name);
    setForm((f) => ({ ...f, beneficiary_id: id, beneficiary_name: name }));
    setBSearchFocused(false);
  }

  async function handleBeneficiaryCreated(b: Beneficiary) {
    // Refresh the parent's local list so the new id appears in the
    // dropdown + any future search, then auto-select it.
    try {
      const next = await fetchBeneficiaries();
      const created = next.find((x) => x.uid === b.uid) ?? b;
      await onBeneficiaryCreated(created);
    } catch (err) {
      console.warn('Failed to refresh beneficiaries after create', err);
      await onBeneficiaryCreated(b);
    }
    selectBeneficiaryById(b.uid, b.name);
  }

  async function handleTagCreated(created?: CreatedTag) {
    try {
      const next = await fetchTags();
      const flat = flattenTags(next.tags);
      await onTagCreated(created);
      // Auto-select the new tag if the backend surfaced its id.
      if (created?.tag_id != null && !form.tag_ids.includes(created.tag_id)) {
        setForm((f) => ({ ...f, tag_ids: [...f.tag_ids, created.tag_id] }));
      }
      // Silence the unused-local warning in case future code lifts
      // flat into this scope.
      void flat;
    } catch (err) {
      console.warn('Failed to refresh tags after create', err);
      await onTagCreated(created);
    }
  }

  function handlePickTag(raw: string) {
    if (!raw) return;
    const tid = parseInt(raw, 10);
    if (Number.isNaN(tid) || form.tag_ids.includes(tid)) return;
    setForm((f) => ({ ...f, tag_ids: [...f.tag_ids, tid] }));
  }

  function handleRemoveTag(tid: number) {
    setForm((f) => ({ ...f, tag_ids: f.tag_ids.filter((id) => id !== tid) }));
  }

  function handlePromoteTag(tid: number) {
    setForm((f) => ({
      ...f,
      tag_ids: [tid, ...f.tag_ids.filter((id) => id !== tid)],
    }));
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
      if (isEditing && editingRule) {
        await updateCategorizationRuleRequest(editingRule.uid, payload);
        savedUid = editingRule.uid;
      } else {
        const res = await createCategorizationRule(payload);
        savedUid = res.rule.uid;
      }
      await onSaved(savedUid, payload.tag_ids);
      // Row-highlight on the parent communicates success; close.
      onClose();
    } catch (err) {
      setError(errorMessage(err, 'Failed to save rule'));
    } finally {
      setBusy(false);
    }
  }

  // Title = the auto-generated rule name (or the loaded one). Add
  // flow falls back to a "New categorization rule" prefix until the
  // user picks a beneficiary + first tag.
  const title = isEditing
    ? generatedRuleName || editingRule.rule_name || 'Categorization rule'
    : 'New categorization rule';
  const dismissLabel = isDirty ? 'Cancel' : 'Close';

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        size="lg"
        title={title}
        description={
          isEditing ? (isUserRule ? 'Your rule' : 'System rule') : undefined
        }
        confirmOnDirty
        isDirty={isDirty}
        headerActions={
          isEditing && isUserRule ? (
            <button
              type="button"
              onClick={onRequestDelete}
              aria-label="Delete rule"
              title="Delete rule"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-rose-600 transition-colors hover:bg-rose-50 hover:text-rose-700 focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:outline-none dark:text-rose-400 dark:hover:bg-rose-950/40 dark:hover:text-rose-300"
            >
              <Trash2 aria-hidden size={16} />
            </button>
          ) : null
        }
      >
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div>
            <span className="form-label">Rule name</span>
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
              onBlur={() =>
                window.setTimeout(() => setBSearchFocused(false), 200)
              }
              placeholder="Search beneficiary..."
              required
              className="form-input"
            />
            {bSearchFocused && (
              <div className="absolute top-full right-0 left-0 z-10 mt-1 max-h-52 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
                <button
                  type="button"
                  onMouseDown={() => {
                    setCreateBeneficiaryOpen(true);
                    setBSearchFocused(false);
                  }}
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
                      onMouseDown={() => selectBeneficiaryById(b.uid, b.name)}
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

          {error && <div className="form-error">{error}</div>}

          {/* DetailModal footer convention (Batch 9.8): Cancel/Close
              on the left of the right-cluster, Save on the right;
              buttons size to their content (no `w-full`). The Modal's
              own `footer` prop right-justifies — this dialog uses an
              inline footer instead so the `<form onSubmit>` keeps
              Enter-to-submit semantics, so the alignment lives here. */}
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {dismissLabel}
            </button>
            <button
              type="submit"
              disabled={
                busy ||
                !!beneficiaryConflict ||
                !form.beneficiary_id ||
                !isDirty
              }
              className="btn-primary !w-auto"
            >
              {isEditing ? 'Update Rule' : 'Create Rule'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Nested create surfaces — open on top of the rule modal so the
          user can mint a missing beneficiary / tag without losing the
          in-flight draft. Radix Dialog supports modal-on-modal. */}
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
    </>
  );
}
