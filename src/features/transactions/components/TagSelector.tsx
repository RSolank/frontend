import { SearchableMultiSelect } from '../../../shared/components/SearchableMultiSelect';

interface FlatTag {
  tag_id: number;
  tag_name: string;
}

interface TagSelectorProps {
  tags: FlatTag[];
  selectedTagIds: number[];
  miscellaneousTagId?: number;
  miscCreditTagId?: number;
  totalTagId?: number;
  debitCredit?: 'debit' | 'credit';
  onAdd: (tagId: number) => void;
  onRemove: (tagId: number) => void;
  // Optional "+ Add new tag" CTA (Type A). When provided the dropdown
  // surfaces it and the parent opens a <TagFormDialog /> inline.
  onRequestAddTag?: () => void;
}

// Transaction tag picker — a thin domain wrapper over the shared
// `SearchableMultiSelect`. Feature-specific logic: the Total tag and the two
// Miscellaneous placeholders (Debit / Credit) are never offered as picks. The
// Misc placeholders are a *backend* fallback (categorization-v2): a txn with no
// real tag is filed under the direction-correct Misc by the API — the user
// never selects or removes it. When nothing is selected we show a passive,
// direction-aware hint of where the txn will land instead of a removable chip.
// Plain removable chips otherwise (the default token) — no primary/promote
// affordance, unlike the categorization-rule tag picker.
export function TagSelector({
  tags,
  selectedTagIds,
  miscellaneousTagId,
  miscCreditTagId,
  totalTagId,
  debitCredit,
  onAdd,
  onRemove,
  onRequestAddTag,
}: TagSelectorProps) {
  const reserved = new Set(
    [totalTagId, miscellaneousTagId, miscCreditTagId].filter(
      (id): id is number => id != null
    )
  );

  const options = tags
    .filter((t) => !selectedTagIds.includes(t.tag_id) && !reserved.has(t.tag_id))
    .map((t) => ({ value: String(t.tag_id), label: t.tag_name }));

  const tagName = (id: number) =>
    tags.find((t) => t.tag_id === id)?.tag_name ?? `Tag ${id}`;

  // Direction-correct Misc the backend will apply when no real tag is chosen.
  const fallbackId =
    debitCredit === 'credit' ? miscCreditTagId : miscellaneousTagId;
  const fallbackDefault =
    debitCredit === 'credit'
      ? 'Miscellaneous (Credit)'
      : 'Miscellaneous (Debit)';
  const fallbackLabel = fallbackId != null ? tagName(fallbackId) : fallbackDefault;

  return (
    <div>
      <SearchableMultiSelect
        id="tags"
        label="Tags"
        ariaLabel="Tags"
        placeholder="Search tags..."
        options={options}
        selectedValues={selectedTagIds.map(String)}
        onAdd={(v) => onAdd(Number(v))}
        onRemove={(v) => onRemove(Number(v))}
        tokenLabel={(v) => tagName(Number(v))}
        onCreate={onRequestAddTag ? () => onRequestAddTag() : undefined}
        createLabel="Add new tag"
        emptyTokensLabel="No tags selected"
      />
      {selectedTagIds.length === 0 ? (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          No tags — this will be filed under{' '}
          <span className="font-medium text-slate-600 dark:text-slate-300">
            {fallbackLabel}
          </span>
          .
        </p>
      ) : null}
    </div>
  );
}
