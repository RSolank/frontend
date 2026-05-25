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

// Rule name progressive display:
//   - no beneficiary             → '' (caller renders a placeholder)
//   - beneficiary, no tags       → '${name}'  (name appears as soon
//                                  as the user picks a beneficiary)
//   - beneficiary + ≥1 tags      → '${name} -> ${primary}'  (only
//                                  the primary tag at index 0 is
//                                  included regardless of how many
//                                  tags are selected; promoting a
//                                  different tag via "Set Primary"
//                                  changes the name)
//
// Backend convention: tag_ids[0] is always the primary (the rule
// engine uses it to derive txn_type). The rule_name we POST mirrors
// that — including secondary tags in the label was historic noise
// from the legacy form.
export function buildRuleName(
  beneficiaryName: string,
  tagIds: readonly number[],
  flatTags: readonly FlatTag[]
): string {
  const name = beneficiaryName?.trim();
  if (!name) return '';
  const primary = tagIds?.[0];
  if (primary == null) return name;
  return `${name} -> ${formatTagAssignment(primary, flatTags)}`;
}
