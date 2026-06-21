import { SearchableMultiSelect } from '../../../shared/components/SearchableMultiSelect';

interface FlatTag {
  tag_id: number;
  tag_name: string;
}

interface TagSelectorProps {
  tags: FlatTag[];
  selectedTagIds: number[];
  miscellaneousTagId?: number;
  totalTagId?: number;
  onAdd: (tagId: number) => void;
  onRemove: (tagId: number) => void;
  // Optional "+ Add new tag" CTA (Type A). When provided the dropdown
  // surfaces it and the parent opens a <TagFormDialog /> inline.
  onRequestAddTag?: () => void;
}

// Transaction tag picker — a thin domain wrapper over the shared
// `SearchableMultiSelect`. The only feature-specific logic is which tags are
// offered: never the Total tag, and the Miscellaneous tag only while nothing
// else is selected (its presence/absence is otherwise managed by the parent's
// onAdd / onRemove). Plain removable chips (the default token) — no
// primary/promote affordance, unlike the categorization-rule tag picker.
export function TagSelector({
  tags,
  selectedTagIds,
  miscellaneousTagId,
  totalTagId,
  onAdd,
  onRemove,
  onRequestAddTag,
}: TagSelectorProps) {
  const options = tags
    .filter((t) => {
      if (selectedTagIds.includes(t.tag_id)) return false;
      if (t.tag_id === totalTagId) return false;
      if (
        miscellaneousTagId &&
        t.tag_id === miscellaneousTagId &&
        selectedTagIds.some((id) => id !== miscellaneousTagId)
      ) {
        return false;
      }
      return true;
    })
    .map((t) => ({ value: String(t.tag_id), label: t.tag_name }));

  const tagName = (id: number) =>
    tags.find((t) => t.tag_id === id)?.tag_name ?? `Tag ${id}`;

  return (
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
  );
}
