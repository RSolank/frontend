/** Flatten tag tree for lookups (includes parent tag_id). */
export function flattenTags(nodes, out = []) {
  for (const n of nodes || []) {
    out.push({
      tag_id: n.tag_id,
      tag_name: n.tag_name,
      parent: n.parent ?? null,
    });
    flattenTags(n.children, out);
  }
  return out;
}

/** One tag assignment: ParentTagName (TagName) */
export function formatTagAssignment(tagId, flatTags) {
  const tag = flatTags.find((t) => t.tag_id === tagId);
  if (!tag) return String(tagId);
  const parent = tag.parent
    ? flatTags.find((t) => t.tag_id === tag.parent)
    : null;
  if (parent) return `${parent.tag_name} (${tag.tag_name})`;
  return tag.tag_name;
}

/** Rule name: Beneficiary_Name -> Parent (Tag), Parent2 (Tag2), ... */
export function buildRuleName(beneficiaryName, tagIds, flatTags) {
  if (!beneficiaryName?.trim() || !tagIds?.length) return '';
  const parts = tagIds
    .map((tid) => formatTagAssignment(tid, flatTags))
    .filter(Boolean);
  return `${beneficiaryName.trim()} -> ${parts.join(', ')}`;
}
