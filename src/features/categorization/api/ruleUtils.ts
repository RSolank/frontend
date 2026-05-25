import type { TagNode } from '../../tags/api/queries';

// Flattened lookup shape; the tree returned by /api/tags is recursive,
// but the rule UI only needs `tag_id → tag_name + parent` for label
// rendering.
export interface FlatTag {
  tag_id: number;
  tag_name: string;
  parent: number | null;
}

export function flattenTags(
  nodes: readonly TagNode[] | undefined,
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

// One tag assignment rendered as `ParentTagName (TagName)` so the
// dropdown / chip / rule-name field all match.
export function formatTagAssignment(
  tagId: number,
  flatTags: readonly FlatTag[]
): string {
  const tag = flatTags.find((t) => t.tag_id === tagId);
  if (!tag) return String(tagId);
  const parent = tag.parent
    ? flatTags.find((t) => t.tag_id === tag.parent)
    : null;
  if (parent) return `${parent.tag_name} (${tag.tag_name})`;
  return tag.tag_name;
}

// Rule name: `Beneficiary_Name -> Parent (Tag), Parent2 (Tag2), ...`.
// Empty string short-circuits when the beneficiary or tags are
// missing so the input renders its placeholder.
export function buildRuleName(
  beneficiaryName: string,
  tagIds: readonly number[],
  flatTags: readonly FlatTag[]
): string {
  if (!beneficiaryName?.trim() || !tagIds?.length) return '';
  const parts = tagIds
    .map((tid) => formatTagAssignment(tid, flatTags))
    .filter(Boolean);
  return `${beneficiaryName.trim()} -> ${parts.join(', ')}`;
}
