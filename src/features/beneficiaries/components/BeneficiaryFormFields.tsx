import { useEffect, useState } from 'react';

import { SearchableSelect } from '../../../shared/components/SearchableSelect';
import { fetchTags, type TagNode } from '../../tags/api/queries';
import {
  deleteCategorizationRule,
  updateCategorizationRuleTags,
} from '../api/mutations';
import {
  fetchCategorizationRules,
  fetchRelationships,
  type CategorizationRule,
} from '../api/queries';
import {
  switchBeneficiaryType,
  type BeneficiaryFormInput,
} from '../api/schemas';

import { AliasChipsInput } from './AliasChipsInput';

interface FlatTag {
  tag_id: number;
  tag_name: string;
  parent: number | null;
}

function flattenTags(
  nodes: TagNode[] | undefined,
  out: FlatTag[] = []
): FlatTag[] {
  for (const n of nodes ?? []) {
    out.push({
      tag_id: n.tag_id,
      tag_name: n.tag_name,
      parent: n.parent ?? null,
    });
    flattenTags(n.children, out);
  }
  return out;
}

function formatTagAssignment(tagId: number, flatTags: FlatTag[]): string {
  const tag = flatTags.find((t) => t.tag_id === tagId);
  if (!tag) return String(tagId);
  const parent = tag.parent
    ? flatTags.find((t) => t.tag_id === tag.parent)
    : null;
  if (parent) return `${parent.tag_name} (${tag.tag_name})`;
  return tag.tag_name;
}

// `TOTAL_TAG_ID` (1) and `MISCELLANEOUS_TAG_ID` (2) are not user-pickable
// merchant categories. Hardcoded here mirroring the legacy form — Batch 6's
// categorization feature can promote this to a shared constant if needed.
const SYSTEM_ONLY_TAG_IDS = [1, 2];

interface BeneficiaryFormFieldsProps {
  form: BeneficiaryFormInput;
  setForm:
    | ((next: BeneficiaryFormInput) => void)
    | React.Dispatch<React.SetStateAction<BeneficiaryFormInput>>;
  readOnly?: boolean;
  excludeUid?: number | null;
  onAliasValidityChange?: (invalid: boolean) => void;
  onTypeChange?: (
    next: 'merchant' | 'person',
    form: BeneficiaryFormInput
  ) => void;
}

// Internal helper so callers can pass either a setter function or a
// raw next-state to `setForm` without us having to know which.
function applyUpdate(
  setForm: BeneficiaryFormFieldsProps['setForm'],
  updater: (prev: BeneficiaryFormInput) => BeneficiaryFormInput
) {
  // React's setState type accepts both; we forward an updater function
  // when we have access to the previous value.
  (setForm as React.Dispatch<React.SetStateAction<BeneficiaryFormInput>>)(
    updater
  );
}

export function BeneficiaryFormFields({
  form,
  setForm,
  readOnly = false,
  excludeUid = null,
  onAliasValidityChange,
  onTypeChange,
}: BeneficiaryFormFieldsProps) {
  const disabled = readOnly;
  const isMerchant = form.beneficiary_type === 'merchant';
  const [relationships, setRelationships] = useState<string[]>([]);
  const [tags, setTags] = useState<FlatTag[]>([]);
  const [ruleTags, setRuleTags] = useState<number[]>([]);

  useEffect(() => {
    fetchRelationships()
      .then((res) => setRelationships(Array.isArray(res) ? res : []))
      .catch((err) => console.error('Failed to load relationships', err));

    fetchTags()
      .then((res) => setTags(flattenTags(res.tags)))
      .catch((err) => console.error('Failed to load tags', err));
  }, []);

  useEffect(() => {
    if (!form.uid) {
      setRuleTags([]);
      return;
    }
    fetchCategorizationRules()
      .then((res) => {
        const rule = (res.rules || []).find(
          (r: CategorizationRule) => r.beneficiary_id === form.uid
        );
        const tagIds = rule?.tag_ids ?? [];
        setRuleTags(tagIds);
        // Seed the picker from the rule's primary when the form has no
        // category yet — persons carry their tag only on the rule (there's no
        // person.category column), so without this the picker would read empty
        // while the chip shows the tag.
        if (tagIds.length > 0) {
          applyUpdate(setForm, (f) =>
            f.category ? f : { ...f, category: String(tagIds[0]) }
          );
        }
      })
      .catch((err) => console.error('Failed to load rules', err));
  }, [form.uid, setForm]);

  useEffect(() => {
    if (form.category && ruleTags.length === 0) {
      setRuleTags([parseInt(form.category, 10)]);
    }
  }, [form.category, ruleTags.length]);

  async function handleRemoveRuleTag(tid: number) {
    const nextTags = ruleTags.filter((id) => id !== tid);
    setRuleTags(nextTags);
    if (parseInt(form.category, 10) === tid) {
      const newPrimary = nextTags.length > 0 ? String(nextTags[0]) : '';
      applyUpdate(setForm, (f) => ({ ...f, category: newPrimary }));
    }
    if (form.uid) {
      try {
        const res = await fetchCategorizationRules();
        const rule = (res.rules || []).find(
          (r) => r.beneficiary_id === form.uid
        );
        if (rule) {
          if (nextTags.length === 0) {
            await deleteCategorizationRule(rule.uid);
          } else {
            await updateCategorizationRuleTags(rule.uid, nextTags);
          }
        }
      } catch (err) {
        console.error('Failed to update rule tags', err);
      }
    }
  }

  async function handleSetPrimary(tid: number) {
    const nextTags = [tid, ...ruleTags.filter((id) => id !== tid)];
    setRuleTags(nextTags);
    applyUpdate(setForm, (f) => ({ ...f, category: String(tid) }));
    if (form.uid) {
      try {
        const res = await fetchCategorizationRules();
        const rule = (res.rules || []).find(
          (r) => r.beneficiary_id === form.uid
        );
        if (rule) await updateCategorizationRuleTags(rule.uid, nextTags);
      } catch (err) {
        console.error('Failed to update rule tags', err);
      }
    }
  }

  // Shallow field patch — sub-components call this instead of reaching for
  // setForm/applyUpdate directly.
  const updateField = (patch: Partial<BeneficiaryFormInput>) =>
    applyUpdate(setForm, (f) => ({ ...f, ...patch }));

  function handleCategoryChange(newCat: string) {
    updateField({ category: newCat });
    if (newCat) {
      const tagId = parseInt(newCat, 10);
      setRuleTags((prev) =>
        prev.includes(tagId)
          ? [tagId, ...prev.filter((id) => id !== tagId)]
          : [tagId, ...prev]
      );
    } else {
      setRuleTags([]);
    }
  }

  return (
    <>
      <div className="mb-4">
        <label htmlFor="beneficiary-name" className="form-label">
          Name
        </label>
        <input
          id="beneficiary-name"
          value={form.name}
          onChange={(e) =>
            applyUpdate(setForm, (f) => ({ ...f, name: e.target.value }))
          }
          required
          readOnly={readOnly}
          disabled={disabled}
          className="form-input"
        />
      </div>

      <div className="mb-4">
        <label htmlFor="beneficiary-type" className="form-label">
          Type
        </label>
        <select
          id="beneficiary-type"
          value={form.beneficiary_type}
          onChange={(e) => {
            const nextType = e.target.value as 'merchant' | 'person';
            const nextForm = switchBeneficiaryType(form, nextType);
            applyUpdate(setForm, () => nextForm);
            onTypeChange?.(nextType, nextForm);
          }}
          disabled={disabled}
          className="form-input capitalize"
        >
          <option value="merchant">Merchant</option>
          <option value="person">Person</option>
        </select>
      </div>

      <AliasChipsInput
        aliases={form.aliases}
        onChange={(aliases) => applyUpdate(setForm, (f) => ({ ...f, aliases }))}
        readOnly={readOnly}
        excludeUid={excludeUid}
        onValidityChange={(invalid) => onAliasValidityChange?.(invalid)}
      />

      {isMerchant ? (
        <MerchantFields
          category={form.category}
          contact={form.contact}
          upi={form.merchant_upi_id}
          tags={tags}
          ruleTags={ruleTags}
          disabled={disabled}
          readOnly={readOnly}
          onCategoryChange={handleCategoryChange}
          onChangeField={updateField}
          onSetPrimary={handleSetPrimary}
          onRemoveTag={handleRemoveRuleTag}
        />
      ) : (
        <PersonFields
          relationshipType={form.relationship_type}
          phone={form.phone}
          upi={form.person_upi_id}
          relationships={relationships}
          category={form.category}
          tags={tags}
          ruleTags={ruleTags}
          disabled={disabled}
          readOnly={readOnly}
          onChangeField={updateField}
          onCategoryChange={handleCategoryChange}
          onSetPrimary={handleSetPrimary}
          onRemoveTag={handleRemoveRuleTag}
        />
      )}
    </>
  );
}

interface MerchantFieldsProps {
  category: string;
  contact: string;
  upi: string;
  tags: FlatTag[];
  ruleTags: number[];
  disabled: boolean;
  readOnly: boolean;
  onCategoryChange: (newCat: string) => void;
  onChangeField: (patch: Partial<BeneficiaryFormInput>) => void;
  onSetPrimary: (tid: number) => void;
  onRemoveTag: (tid: number) => void;
}

interface CategoryPickerProps {
  category: string;
  tags: FlatTag[];
  ruleTags: number[];
  disabled: boolean;
  label?: string;
  hint?: string;
  onCategoryChange: (newCat: string) => void;
  onSetPrimary: (tid: number) => void;
  onRemoveTag: (tid: number) => void;
}

// The category SearchableSelect + assigned-tag chips. Shared by merchants and
// persons — both map a beneficiary → a categorization rule; the only difference
// is the default a person carries (Other Transfer) and the helper hint.
function CategoryPicker({
  category,
  tags,
  ruleTags,
  disabled,
  label = 'Category',
  hint,
  onCategoryChange,
  onSetPrimary,
  onRemoveTag,
}: CategoryPickerProps) {
  return (
    <>
      <div className="mb-4">
        <label htmlFor="beneficiary-category" className="form-label">
          {label}
        </label>
        {disabled ? (
          <input
            id="beneficiary-category"
            value={
              category
                ? formatTagAssignment(Number(category), tags)
                : '— None —'
            }
            readOnly
            className="form-input cursor-not-allowed bg-slate-50 dark:bg-slate-900"
          />
        ) : (
          <SearchableSelect
            id="beneficiary-category"
            ariaLabel={label}
            placeholder="— None —"
            value={category}
            onChange={onCategoryChange}
            options={tags
              .filter((t) => !SYSTEM_ONLY_TAG_IDS.includes(t.tag_id))
              .map((t) => ({
                value: String(t.tag_id),
                label: formatTagAssignment(t.tag_id, tags),
              }))}
          />
        )}
        {hint && !disabled && (
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {hint}
          </p>
        )}
      </div>

      {ruleTags.length > 0 && (
        <AssignedTagChips
          ruleTags={ruleTags}
          tags={tags}
          disabled={disabled}
          onSetPrimary={onSetPrimary}
          onRemoveTag={onRemoveTag}
        />
      )}
    </>
  );
}

// Merchant-specific fields: the shared category picker, contact, and UPI id.
function MerchantFields({
  category,
  contact,
  upi,
  tags,
  ruleTags,
  disabled,
  readOnly,
  onCategoryChange,
  onChangeField,
  onSetPrimary,
  onRemoveTag,
}: MerchantFieldsProps) {
  return (
    <>
      <CategoryPicker
        category={category}
        tags={tags}
        ruleTags={ruleTags}
        disabled={disabled}
        onCategoryChange={onCategoryChange}
        onSetPrimary={onSetPrimary}
        onRemoveTag={onRemoveTag}
      />

      <div className="mb-4">
        <label htmlFor="beneficiary-contact" className="form-label">
          Contact (phone or website)
        </label>
        <input
          id="beneficiary-contact"
          value={contact}
          onChange={(e) => onChangeField({ contact: e.target.value })}
          readOnly={readOnly}
          disabled={disabled}
          className="form-input"
        />
      </div>
      <div className="mb-4">
        <label htmlFor="beneficiary-upi" className="form-label">
          UPI ID
        </label>
        <input
          id="beneficiary-upi"
          value={upi}
          onChange={(e) => onChangeField({ merchant_upi_id: e.target.value })}
          readOnly={readOnly}
          disabled={disabled}
          className="form-input"
        />
      </div>
    </>
  );
}

interface AssignedTagChipsProps {
  ruleTags: number[];
  tags: FlatTag[];
  disabled: boolean;
  onSetPrimary: (tid: number) => void;
  onRemoveTag: (tid: number) => void;
}

// The assigned-tag chip row. First chip (idx 0) is the primary category;
// the rest can be promoted or removed.
function AssignedTagChips({
  ruleTags,
  tags,
  disabled,
  onSetPrimary,
  onRemoveTag,
}: AssignedTagChipsProps) {
  return (
    <div className="mb-4">
      <span className="form-label">Assigned Tags</span>
      <div className="mt-1 flex flex-wrap gap-2">
        {ruleTags.map((tid, idx) => {
          const tagLabel = formatTagAssignment(tid, tags);
          const isPrimary = idx === 0;
          const baseClass = isPrimary
            ? 'border-success-200 bg-success-50 text-success-700 dark:border-success-900/50 dark:bg-success-950/40 dark:text-success-300'
            : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300';
          // "Set Primary" is always visible (when editable and the chip
          // isn't already primary). The previous hover-only reveal left
          // the action unreachable on touch viewports — see
          // CONTRIBUTING.md §6 "every interactive control is reachable".
          return (
            <span
              key={tid}
              className={`inline-flex flex-wrap items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${baseClass}`}
            >
              {tagLabel}
              {isPrimary && (
                <span className="bg-success-600 ml-1 rounded px-1 py-px text-[0.6rem] font-bold tracking-wider text-white uppercase">
                  Primary
                </span>
              )}
              {!isPrimary && !disabled && (
                <button
                  type="button"
                  onClick={() => onSetPrimary(tid)}
                  className="bg-accent-600 hover:bg-accent-700 focus-visible:ring-accent-500 ml-1 rounded px-1.5 py-0.5 text-[0.65rem] font-bold text-white focus-visible:ring-2 focus-visible:outline-none"
                >
                  Set Primary
                </button>
              )}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => onRemoveTag(tid)}
                  aria-label={`Remove tag ${tagLabel}`}
                  className={`ml-1 text-base leading-none font-bold ${
                    isPrimary
                      ? 'text-success-700 dark:text-success-300'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  ×
                </button>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}

interface PersonFieldsProps {
  relationshipType: string;
  phone: string;
  upi: string;
  relationships: string[];
  category: string;
  tags: FlatTag[];
  ruleTags: number[];
  disabled: boolean;
  readOnly: boolean;
  onChangeField: (patch: Partial<BeneficiaryFormInput>) => void;
  onCategoryChange: (newCat: string) => void;
  onSetPrimary: (tid: number) => void;
  onRemoveTag: (tid: number) => void;
}

// Person-specific fields: relationship, the shared category picker (P2P flows
// default to Other Transfer, overridable e.g. a landlord → Rent), phone, UPI.
function PersonFields({
  relationshipType,
  phone,
  upi,
  relationships,
  category,
  tags,
  ruleTags,
  disabled,
  readOnly,
  onChangeField,
  onCategoryChange,
  onSetPrimary,
  onRemoveTag,
}: PersonFieldsProps) {
  return (
    <>
      <div className="mb-4">
        <label htmlFor="beneficiary-relationship" className="form-label">
          Relationship
        </label>
        <select
          id="beneficiary-relationship"
          value={relationshipType}
          onChange={(e) => onChangeField({ relationship_type: e.target.value })}
          disabled={disabled}
          className="form-input capitalize"
        >
          <option value="">-- Select Relationship --</option>
          {relationships.map((r) => (
            <option key={r} value={r} className="capitalize">
              {r}
            </option>
          ))}
        </select>
      </div>
      <CategoryPicker
        category={category}
        tags={tags}
        ruleTags={ruleTags}
        disabled={disabled}
        hint="Payments to a person default to Other Transfer (not taxed). Change it if this is really an expense — e.g. a landlord → Rent."
        onCategoryChange={onCategoryChange}
        onSetPrimary={onSetPrimary}
        onRemoveTag={onRemoveTag}
      />
      <div className="mb-4">
        <label htmlFor="beneficiary-phone" className="form-label">
          Phone
        </label>
        <input
          id="beneficiary-phone"
          value={phone}
          onChange={(e) => onChangeField({ phone: e.target.value })}
          readOnly={readOnly}
          disabled={disabled}
          className="form-input"
        />
      </div>
      <div className="mb-4">
        <label htmlFor="beneficiary-upi" className="form-label">
          UPI ID
        </label>
        <input
          id="beneficiary-upi"
          value={upi}
          onChange={(e) => onChangeField({ person_upi_id: e.target.value })}
          readOnly={readOnly}
          disabled={disabled}
          className="form-input"
        />
      </div>
    </>
  );
}
