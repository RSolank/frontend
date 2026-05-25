import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  fetchBeneficiaries,
  type Beneficiary,
} from '../../beneficiaries/api/queries';
import { formatAliasesDisplay } from '../../beneficiaries/api/aliases';
import {
  createCategorizationRule,
  deleteCategorizationRule,
  updateCategorizationRuleTags,
} from '../../beneficiaries/api/mutations';
import { fetchTagConstants, fetchTags } from '../../tags/api/queries';
import { categorizationKeys } from '../api/keys';
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
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [bSearch, setBSearch] = useState('');
  const [bSearchFocused, setBSearchFocused] = useState(false);
  const [tempTagId, setTempTagId] = useState('');
  const [beneficiaryConflict, setBeneficiaryConflict] = useState<string | null>(
    null
  );

  const isEditing = form.uid != null;

  useEffect(() => {
    void (async () => {
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
    })();
  }, []);

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
          t.tag_id !== constants?.MISCELLANEOUS_TAG_ID &&
          // Only top-level entries are excluded from the picker if they
          // have no parent (root rows are the parents themselves).
          // Children + roots both qualify; the dropdown sorts naturally.
          true
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
    setTempTagId('');
    setBeneficiaryConflict(null);
    setIsFormVisible(false);
  }

  function handleSelectBeneficiary(b: Beneficiary) {
    setBSearch(b.name);
    setForm((f) => ({
      ...f,
      beneficiary_id: b.uid,
      beneficiary_name: b.name,
    }));
  }

  // Stub: the dropdown's "+ Add new beneficiary" CTA. The real
  // mechanism (popup vs same-tab nav vs modal) and target URL are
  // deferred to a follow-up session — see the Batch 6 handoff in
  // `.scratch/task-frontend.md`. Until then this just no-ops so the
  // dropdown entry's wiring is in place.
  function handleAddNewBeneficiary() {
    // TODO(batch-6-followup): wire the chosen Add-Beneficiary surface
    // here and re-open this dropdown with the newly-created
    // beneficiary pre-selected.
    console.warn(
      '[categorization] Add-new-beneficiary CTA clicked — wiring TBD'
    );
  }

  function handleAddTag() {
    if (!tempTagId) return;
    const tid = parseInt(tempTagId, 10);
    if (Number.isNaN(tid) || form.tag_ids.includes(tid)) return;
    setForm((f) => ({ ...f, tag_ids: [...f.tag_ids, tid] }));
    setTempTagId('');
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
      if (isEditing && form.uid != null) {
        await updateCategorizationRuleRequest(form.uid, payload);
      } else {
        await createCategorizationRule(payload);
      }
      resetForm();
      await invalidateRules();
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

  async function handleDelete(uid: number) {
    if (!window.confirm('Delete this categorization rule?')) return;
    setError(null);
    setBusy(true);
    try {
      await deleteCategorizationRule(uid);
      await invalidateRules();
    } catch (err) {
      setError(errorMessage(err, 'Failed to delete rule'));
    } finally {
      setBusy(false);
    }
  }

  async function handleRemoveTagFromRule(rule: CategorizationRule, tid: number) {
    const nextTags = (rule.tag_ids || []).filter((id) => id !== tid);
    try {
      if (nextTags.length === 0) {
        const confirmed = window.confirm(
          `Deleting the last tag will delete the categorization rule for "${rule.beneficiary_name}". Proceed?`
        );
        if (!confirmed) return;
        await deleteCategorizationRule(rule.uid);
      } else {
        await updateCategorizationRuleTags(rule.uid, nextTags);
      }
      await invalidateRules();
    } catch (err) {
      setError(errorMessage(err, 'Failed to update rule'));
    }
  }

  async function handleSetPrimaryInRule(
    rule: CategorizationRule,
    tid: number
  ) {
    const nextTags = [tid, ...(rule.tag_ids || []).filter((id) => id !== tid)];
    try {
      await updateCategorizationRuleTags(rule.uid, nextTags);
      await invalidateRules();
    } catch (err) {
      setError(errorMessage(err, 'Failed to update rule'));
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

  return (
    <div className="mx-auto my-8 max-w-5xl px-4">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Categorization rules
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Map beneficiaries to tags for{' '}
            <span className="font-semibold">statement</span> transactions.
            Beneficiary identification is handled separately.
          </p>
        </div>
        <Link
          to="/dashboard"
          className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:outline-none dark:text-indigo-400 dark:hover:text-indigo-300 dark:focus-visible:ring-offset-slate-950"
        >
          ← Back to dashboard
        </Link>
      </header>

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
              onClick={() => (isFormVisible ? resetForm() : setIsFormVisible(true))}
              className="btn-primary !w-auto"
            >
              {isFormVisible ? 'Cancel' : 'Add Rule'}
            </button>
          </div>
        </div>

        {isFormVisible && (
          <form
            onSubmit={handleSubmit}
            className="grid gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40"
          >
            <div>
              <label htmlFor="rule-name" className="form-label">
                Rule name
              </label>
              <input
                id="rule-name"
                readOnly
                tabIndex={-1}
                aria-readonly="true"
                value={generatedRuleName}
                className="form-input cursor-default border-dashed bg-slate-100 text-slate-600 focus:ring-0 focus:outline-none dark:bg-slate-800/70 dark:text-slate-300"
              />
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
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
                            {formatAliasesDisplay(b.aliases)}
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

            <div>
              <span className="form-label mb-1 block">Tags to apply</span>
              <div className="mb-2 flex flex-wrap gap-2 sm:flex-nowrap">
                <select
                  aria-label="Select tag"
                  value={tempTagId}
                  onChange={(e) => setTempTagId(e.target.value)}
                  className="form-input flex-1"
                >
                  <option value="">Select a tag</option>
                  {filteredTags.map((t) => (
                    <option key={t.tag_id} value={t.tag_id}>
                      {formatTagAssignment(t.tag_id, tags)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddTag}
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Add
                </button>
              </div>
              <div className="flex min-h-12 flex-wrap gap-2 rounded-md border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900">
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
                type="submit"
                disabled={busy || !!beneficiaryConflict || !form.beneficiary_id}
                className="btn-primary !w-auto"
              >
                {isEditing ? 'Update Rule' : 'Create Rule'}
              </button>
              {isEditing && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        )}

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

        {rules.length === 0 && !rulesLoading ? (
          <p className="text-sm text-slate-400 dark:text-slate-500">
            No rules found.
          </p>
        ) : (
          <ul className="grid list-none gap-3 p-0">
            {rules.map((r) => {
              const aliasText = formatAliasesDisplay(r.beneficiary_aliases);
              const userRule = isUserRule(r);
              return (
                <li
                  key={r.uid}
                  className="rounded-lg border border-slate-200 p-4 dark:border-slate-800"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <span className="text-base font-semibold text-slate-900 dark:text-slate-100">
                      {r.rule_name}
                    </span>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => handleEdit(r)}
                        className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        Edit
                      </button>
                      {userRule && (
                        <button
                          type="button"
                          onClick={() => handleDelete(r.uid)}
                          className="rounded-md border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700 transition-colors hover:bg-rose-100 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-950/60"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                    <span className="font-medium text-slate-700 dark:text-slate-200">
                      Beneficiary:
                    </span>{' '}
                    {r.beneficiary_name}
                    {aliasText && (
                      <>
                        <br />
                        <span className="font-medium text-slate-700 dark:text-slate-200">
                          Aliases:
                        </span>{' '}
                        <span className="text-slate-400 dark:text-slate-500">
                          {aliasText}
                        </span>
                      </>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                      Tags:
                    </span>
                    {(r.tag_ids || []).map((tid, idx) => {
                      const isPrimary = idx === 0;
                      const chipBase =
                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold border';
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
                              onClick={() => handleSetPrimaryInRule(r, tid)}
                              className="rounded-sm bg-indigo-600 px-1 py-px text-[10px] font-bold tracking-wide text-white uppercase hover:bg-indigo-700"
                            >
                              Set Primary
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemoveTagFromRule(r, tid)}
                            aria-label={`Remove tag ${formatTagAssignment(tid, tags)}`}
                            className="ml-0.5 text-sm leading-none font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                          >
                            ×
                          </button>
                        </span>
                      );
                    })}
                  </div>
                  {r.notes && (
                    <p className="mt-2 text-sm text-slate-500 italic dark:text-slate-400">
                      &ldquo;{r.notes}&rdquo;
                    </p>
                  )}
                  <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                    Created by: {userRule ? `User ${r.created_by}` : 'System'}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
