import { Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { Modal } from '../../../shared/components/Modal';
import { SearchableMultiSelect } from '../../../shared/components/SearchableMultiSelect';
import { SearchableSelect } from '../../../shared/components/SearchableSelect';
import { createCategorizationRule } from '../../beneficiaries/api/mutations';
import {
  fetchBeneficiaries,
  type Beneficiary,
} from '../../beneficiaries/api/queries';
import { BeneficiaryFormDialog } from '../../beneficiaries/components/BeneficiaryFormDialog';
import type { CreatedTag } from '../../tags/api/mutations';
import { fetchTags } from '../../tags/api/queries';
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

// Inbound pre-fill from another flow (e.g. a transaction's diverged/created
// tags). Edit mode uses only `tagIds` (beneficiary stays the rule's); Add mode
// uses beneficiary + tags.
export interface RulePrefillDraft {
  beneficiaryId?: number;
  beneficiaryName?: string;
  tagIds: number[];
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

function tagName(tags: FlatTag[], id: number): string {
  return tags.find((t) => t.tag_id === id)?.tag_name ?? `Tag ${id}`;
}

interface CategorizationRuleFormDialogProps {
  open: boolean;
  onClose: () => void;
  // Null = Add flow. Populated = Edit flow.
  editingRule: CategorizationRule | null;
  // Pre-fill from another flow (e.g. a transaction redirect). In Edit mode the
  // tags pre-fill the form while `editingRule.tag_ids` stays the diff baseline;
  // in Add mode it seeds the beneficiary + tags.
  prefill?: RulePrefillDraft | null;
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

// Modal heading: the auto-generated rule name (or the loaded one) in Edit,
// a fixed prefix in Add. if/else (not a nested ternary) so it reads cleanly.
function ruleTitle(
  isEditing: boolean,
  generatedRuleName: string,
  editingRule: CategorizationRule | null
): string {
  if (!isEditing) return 'New categorization rule';
  return generatedRuleName || editingRule?.rule_name || 'Categorization rule';
}

// Modal sub-description: ownership pill in Edit, nothing in Add. if/else so
// it stays off sonarjs/no-nested-conditional.
function ruleDescription(
  isEditing: boolean,
  isUserRule: boolean
): string | undefined {
  if (!isEditing) return undefined;
  return isUserRule ? 'Your rule' : 'System rule';
}

interface UseRuleSubmitArgs {
  open: boolean;
  form: FormState;
  beneficiaryConflict: string | null;
  generatedRuleName: string;
  isEditing: boolean;
  editingRule: CategorizationRule | null;
  onSaved: (uid: number, tagIds: readonly number[]) => void | Promise<void>;
  onClose: () => void;
}

// The submit half of the form: validation + create/update mutation, plus the
// busy / error state it owns. Composed into useRuleForm; split out only to
// keep that hook under the line-count gate.
function useRuleSubmit({
  open,
  form,
  beneficiaryConflict,
  generatedRuleName,
  isEditing,
  editingRule,
  onSaved,
  onClose,
}: UseRuleSubmitArgs) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Clear busy/error on (re)open — the form-reset half of the original
  // single open-effect, kept here alongside the state it touches.
  useEffect(() => {
    if (!open) return;
    setBusy(false);
    setError(null);
  }, [open, editingRule]);

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

  return { busy, setBusy, error, setError, handleSubmit };
}

interface UseRuleFormArgs {
  open: boolean;
  editingRule: CategorizationRule | null;
  prefill?: RulePrefillDraft | null;
  tags: FlatTag[];
  constants: Constants | null;
  rules: CategorizationRule[];
  onSaved: (uid: number, tagIds: readonly number[]) => void | Promise<void>;
  onClose: () => void;
  onBeneficiaryCreated: (b: Beneficiary) => void | Promise<void>;
  onTagCreated: (created?: CreatedTag) => void | Promise<void>;
}

// All of the dialog's state, effects, derived values and handlers. Pulled
// out of the component so the render stays a presentational shell under the
// complexity / line-count gates. Reference data (tags, beneficiaries) arrives
// via props, so nothing here subscribes a query.
// eslint-disable-next-line max-lines-per-function -- a single cohesive form view-model (hydrate/dirty/diff/conflict effects + pick/promote/remove handlers); the pieces share `form` state and splitting would just scatter tightly-coupled logic.
function useRuleForm({
  open,
  editingRule,
  prefill,
  tags,
  constants,
  rules,
  onSaved,
  onClose,
  onBeneficiaryCreated,
  onTagCreated,
}: UseRuleFormArgs) {
  const isEditing = editingRule != null;

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [beneficiaryConflict, setBeneficiaryConflict] = useState<string | null>(
    null
  );
  const [createBeneficiaryOpen, setCreateBeneficiaryOpen] = useState(false);
  // The typed search text captured when the user clicks "+ Add new
  // beneficiary", used to pre-fill the nested create dialog's name field.
  const [createBeneficiaryName, setCreateBeneficiaryName] = useState('');
  const [createTagOpen, setCreateTagOpen] = useState(false);

  // Reset / hydrate the form whenever the dialog (re)opens. Add
  // resets to empty; Edit copies the editing rule.
  useEffect(() => {
    if (!open) return;
    if (editingRule) {
      // Edit: pre-fill tags from `prefill` if present (the originating flow's
      // proposed tags) — `editingRule.tag_ids` stays the persisted baseline the
      // diff compares against.
      setForm({
        beneficiary_id: editingRule.beneficiary_id,
        beneficiary_name: editingRule.beneficiary_name || '',
        tag_ids: [...(prefill?.tagIds ?? editingRule.tag_ids ?? [])],
        notes: editingRule.notes || '',
      });
    } else if (prefill) {
      // Add: seed beneficiary + tags from the originating flow.
      setForm({
        beneficiary_id: prefill.beneficiaryId ?? '',
        beneficiary_name: prefill.beneficiaryName ?? '',
        tag_ids: [...prefill.tagIds],
        notes: '',
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setBeneficiaryConflict(null);
  }, [open, isEditing, editingRule, prefill]);

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

  // Tag diff vs the persisted rule (edit mode only) — drives the
  // added/removed preview so the user sees the change before saving. `null`
  // when there's no baseline (Add) or nothing changed.
  const tagDiff = useMemo(() => {
    if (!isEditing) return null;
    const base = new Set(originalForm.tag_ids);
    const cur = new Set(form.tag_ids);
    const added = form.tag_ids.filter((id) => !base.has(id));
    const removed = originalForm.tag_ids.filter((id) => !cur.has(id));
    if (added.length === 0 && removed.length === 0) return null;
    return { added, removed };
  }, [isEditing, form.tag_ids, originalForm.tag_ids]);

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

  // Commit / clear the selected beneficiary. SearchableSelect owns its own
  // search text now, so these only touch the form-level id + name (the rule
  // name + conflict check read off them).
  function selectBeneficiary(id: number, name: string) {
    setForm((f) => ({ ...f, beneficiary_id: id, beneficiary_name: name }));
  }

  function clearBeneficiary() {
    setForm((f) => ({ ...f, beneficiary_id: '', beneficiary_name: '' }));
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
    selectBeneficiary(b.uid, b.name);
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

  const submit = useRuleSubmit({
    open,
    form,
    beneficiaryConflict,
    generatedRuleName,
    isEditing,
    editingRule,
    onSaved,
    onClose,
  });

  const saveDisabled =
    submit.busy || !!beneficiaryConflict || !form.beneficiary_id || !isDirty;

  return {
    form,
    setForm,
    beneficiaryConflict,
    error: submit.error,
    createBeneficiaryOpen,
    setCreateBeneficiaryOpen,
    createBeneficiaryName,
    setCreateBeneficiaryName,
    createTagOpen,
    setCreateTagOpen,
    isEditing,
    isDirty,
    tagDiff,
    filteredTags,
    generatedRuleName,
    saveDisabled,
    selectBeneficiary,
    clearBeneficiary,
    handleBeneficiaryCreated,
    handleTagCreated,
    handlePickTag,
    handleRemoveTag,
    handlePromoteTag,
    handleSubmit: submit.handleSubmit,
  };
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
  prefill,
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
  const f = useRuleForm({
    open,
    editingRule,
    prefill,
    tags,
    constants,
    rules,
    onSaved,
    onClose,
    onBeneficiaryCreated,
    onTagCreated,
  });

  const title = ruleTitle(f.isEditing, f.generatedRuleName, editingRule);
  const dismissLabel = f.isDirty ? 'Cancel' : 'Close';

  const beneficiaryOptions = useMemo(
    () => beneficiaries.map((b) => ({ value: String(b.uid), label: b.name })),
    [beneficiaries]
  );
  // Tag dropdown options: the non-reserved tags, minus the already-selected
  // ones (chips), labelled by their full ancestor path so the search matches
  // "Food (Groceries)".
  const tagOptions = useMemo(
    () =>
      f.filteredTags
        .filter((t) => !f.form.tag_ids.includes(t.tag_id))
        .map((t) => ({
          value: String(t.tag_id),
          label: formatTagAssignment(t.tag_id, tags),
        })),
    [f.filteredTags, f.form.tag_ids, tags]
  );

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        size="lg"
        title={title}
        description={ruleDescription(f.isEditing, isUserRule)}
        confirmOnDirty
        isDirty={f.isDirty}
        headerActions={
          f.isEditing && isUserRule ? (
            <button
              type="button"
              onClick={onRequestDelete}
              aria-label="Delete rule"
              title="Delete rule"
              className="text-danger-600 hover:bg-danger-50 hover:text-danger-700 focus-visible:ring-danger-500 dark:text-danger-400 dark:hover:bg-danger-950/40 dark:hover:text-danger-300 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              <Trash2 aria-hidden size={16} />
            </button>
          ) : null
        }
        footer={
          <>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {dismissLabel}
            </button>
            <button
              type="submit"
              form="categorization-rule-form"
              disabled={f.saveDisabled}
              className="btn-primary !w-auto"
            >
              {f.isEditing ? 'Update Rule' : 'Create Rule'}
            </button>
          </>
        }
      >
        {/* Footer holds the CTAs (modal-CTA convention); the submit button
            targets this form by id, preserving Enter-to-submit. */}
        <form
          id="categorization-rule-form"
          onSubmit={f.handleSubmit}
          className="grid gap-4"
        >
          <div>
            <span className="form-label">Rule name</span>
            <output
              aria-live="polite"
              className="block min-h-[2.5rem] px-1 py-2 text-sm leading-6 break-words text-slate-700 dark:text-slate-200"
            >
              {f.generatedRuleName || (
                <span className="text-slate-400 italic dark:text-slate-500">
                  Select a beneficiary and at least one tag…
                </span>
              )}
            </output>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Auto-generated from the selected beneficiary and tags.
            </p>
          </div>

          <BeneficiaryField
            value={f.form.beneficiary_id ? String(f.form.beneficiary_id) : ''}
            options={beneficiaryOptions}
            conflict={f.beneficiaryConflict}
            onChange={(next) => {
              if (!next) {
                f.clearBeneficiary();
                return;
              }
              const b = beneficiaries.find((x) => String(x.uid) === next);
              if (b) f.selectBeneficiary(b.uid, b.name);
            }}
            onCreate={(query) => {
              f.setCreateBeneficiaryName(query);
              f.setCreateBeneficiaryOpen(true);
            }}
          />

          <TagField
            options={tagOptions}
            selectedValues={f.form.tag_ids.map(String)}
            tags={tags}
            onAdd={f.handlePickTag}
            onRemove={(v) => f.handleRemoveTag(Number(v))}
            onPromote={f.handlePromoteTag}
            onCreate={() => f.setCreateTagOpen(true)}
          />

          {f.tagDiff && (
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/40">
              <p className="mb-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                Changes from the saved rule
              </p>
              <div className="flex flex-wrap gap-2">
                {f.tagDiff.added.map((id) => (
                  <span
                    key={`a-${id}`}
                    className="bg-success-100 text-success-800 dark:bg-success-950/50 dark:text-success-300 inline-flex items-center gap-0.5 rounded-full px-2.5 py-0.5 text-sm font-medium"
                  >
                    <span aria-hidden="true">+</span>
                    {tagName(tags, id)}
                  </span>
                ))}
                {f.tagDiff.removed.map((id) => (
                  <span
                    key={`r-${id}`}
                    className="inline-flex items-center gap-0.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-sm font-medium text-slate-400 line-through dark:bg-slate-800 dark:text-slate-500"
                  >
                    <span aria-hidden="true">−</span>
                    {tagName(tags, id)}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div>
            <label htmlFor="rule-notes" className="form-label">
              Notes (optional)
            </label>
            <input
              id="rule-notes"
              value={f.form.notes}
              onChange={(e) =>
                f.setForm((prev) => ({ ...prev, notes: e.target.value }))
              }
              className="form-input"
            />
          </div>

          {f.error && <div className="form-error">{f.error}</div>}
        </form>
      </Modal>

      {/* Nested create surfaces — open on top of the rule modal so the
          user can mint a missing beneficiary / tag without losing the
          in-flight draft. Radix Dialog supports modal-on-modal. */}
      <BeneficiaryFormDialog
        open={f.createBeneficiaryOpen}
        onClose={() => f.setCreateBeneficiaryOpen(false)}
        onSaved={f.handleBeneficiaryCreated}
        initialName={f.createBeneficiaryName}
      />
      <TagFormDialog
        open={f.createTagOpen}
        onClose={() => f.setCreateTagOpen(false)}
        onSaved={f.handleTagCreated}
        flatTags={tags.map((t) => ({ tag_id: t.tag_id, tag_name: t.tag_name }))}
      />
    </>
  );
}

interface BeneficiaryFieldProps {
  value: string;
  options: { value: string; label: string }[];
  conflict: string | null;
  onChange: (next: string) => void;
  onCreate: (query: string) => void;
}

// The rule's beneficiary slot: a single-select typeahead with inline
// "+ Add new beneficiary" (Type A create) + the one-rule-per-beneficiary
// conflict message. Split out so the dialog stays under the line-count gate.
function BeneficiaryField({
  value,
  options,
  conflict,
  onChange,
  onCreate,
}: BeneficiaryFieldProps) {
  return (
    <div>
      <label htmlFor="rule-beneficiary" className="form-label">
        Beneficiary
      </label>
      <SearchableSelect
        id="rule-beneficiary"
        ariaLabel="Beneficiary"
        placeholder="Search beneficiary..."
        value={value}
        options={options}
        onChange={onChange}
        onCreate={onCreate}
        createLabel="Add new beneficiary"
      />
      {conflict && <div className="form-error mt-1">{conflict}</div>}
    </div>
  );
}

interface TagFieldProps {
  options: { value: string; label: string }[];
  selectedValues: string[];
  tags: FlatTag[];
  onAdd: (value: string) => void;
  onRemove: (value: string) => void;
  onPromote: (tid: number) => void;
  onCreate: () => void;
}

// The rule's tag slot: a chip-accumulating multi-select with inline
// "+ Add new tag" (Type A) and the primary/promote chip variant via the
// `renderToken` slot. Split out to keep the dialog under the line gate.
function TagField({
  options,
  selectedValues,
  tags,
  onAdd,
  onRemove,
  onPromote,
  onCreate,
}: TagFieldProps) {
  return (
    <SearchableMultiSelect
      id="rule-tag"
      label="Tags"
      ariaLabel="Tags"
      placeholder="Search tags..."
      options={options}
      selectedValues={selectedValues}
      onAdd={onAdd}
      onRemove={onRemove}
      tokenLabel={(v) => formatTagAssignment(Number(v), tags)}
      onCreate={onCreate}
      createLabel="Add new tag"
      emptyTokensLabel="No tags selected"
      renderToken={(args) => <TagChipToken {...args} onPromote={onPromote} />}
    />
  );
}

interface TagChipTokenProps {
  value: string;
  label: string;
  index: number;
  remove: () => void;
  onPromote: (tid: number) => void;
}

// A selected-tag chip for the categorization rule's SearchableMultiSelect.
// The first chip (index 0) is the Primary (drives the rule name); the rest
// carry a "Set Primary" promote button. Passed as the `renderToken` slot so
// the shared multi-select stays generic (the transaction tag selector uses
// the default plain chip instead).
function TagChipToken({
  value,
  label,
  index,
  remove,
  onPromote,
}: TagChipTokenProps) {
  const isPrimary = index === 0;
  const chipBase =
    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold border';
  const chipColor = isPrimary
    ? 'bg-success-50 text-success-700 border-success-200 dark:bg-success-950/40 dark:text-success-300 dark:border-success-900/50'
    : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700';
  return (
    <span className={`${chipBase} ${chipColor}`}>
      {label}
      {isPrimary ? (
        <span className="bg-success-700 rounded-sm px-1 py-px text-[10px] font-bold tracking-wide text-white uppercase">
          Primary
        </span>
      ) : (
        <button
          type="button"
          onClick={() => onPromote(Number(value))}
          className="bg-accent-600 hover:bg-accent-700 rounded-sm px-1 py-px text-[10px] font-bold tracking-wide text-white uppercase"
        >
          Set Primary
        </button>
      )}
      <button
        type="button"
        onClick={remove}
        aria-label={`Remove tag ${label}`}
        className="ml-0.5 text-base leading-none font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
      >
        ×
      </button>
    </span>
  );
}
