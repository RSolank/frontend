import type { CategorizationRule } from './queries';
import type { FlatTag } from './ruleUtils';

// Stable key for a tag-set: sorted, dedup'd, joined. Two rules with the
// same set of tag_ids in any order share the same key.
export function tagSetKey(tagIds: readonly number[]): string {
  return Array.from(new Set(tagIds))
    .sort((a, b) => a - b)
    .join(',');
}

export interface RuleGroup {
  // Sorted tag-set key — identifies the group; useful as a React key
  // and for the expansion-state map.
  key: string;
  // Tag id chosen to render as primary in the collapsed header. Picked
  // by `chooseRepresentativePrimary` — see its doc for the algorithm.
  representativePrimary: number;
  // The other tag ids in the set, sorted by tag_id for determinism.
  // Rendered as non-primary chips after the representative.
  otherTagIds: number[];
  // Rules in this group, ordered by beneficiary_name for stable
  // alphabetical rendering.
  rules: CategorizationRule[];
}

// Choose the tag to mark "Primary" in the group's collapsed header.
//
//   1. For each tag in the set, count how many of the group's rules
//      list it as their primary (i.e. position 0 in tag_ids).
//   2. The tag with the highest count wins.
//   3. Ties: if every tied tag shares the same parent, fall back to
//      the parent tag id (caller renders the parent's label as the
//      representative). If they don't share a parent, just pick the
//      tied tag with the smallest id for determinism ("pick any" per
//      the spec — smallest id keeps the choice stable across
//      re-renders without us having to track a random seed).
//
// Returns `{ tagId, isParentFallback }`. `isParentFallback === true`
// signals that the chosen id is the *parent* of the tied primaries
// rather than one of the primaries themselves — the renderer can use
// this to label the chip distinctively ("Food" with no child suffix
// rather than "Food (Groceries)") so the user understands why the
// header doesn't match any single rule exactly.
export interface RepresentativeChoice {
  tagId: number;
  isParentFallback: boolean;
}

export function chooseRepresentativePrimary(
  rules: readonly CategorizationRule[],
  flatTags: readonly FlatTag[]
): RepresentativeChoice {
  const counts = new Map<number, number>();
  for (const r of rules) {
    const primary = r.tag_ids?.[0];
    if (primary == null) continue;
    counts.set(primary, (counts.get(primary) ?? 0) + 1);
  }
  if (counts.size === 0) {
    // Defensive: shouldn't happen for a non-empty group of well-formed
    // rules. Fall back to the smallest tag id in the union set.
    const fallback = rules
      .flatMap((r) => r.tag_ids ?? [])
      .sort((a, b) => a - b)[0];
    return { tagId: fallback ?? 0, isParentFallback: false };
  }

  const max = Math.max(...counts.values());
  const winners = [...counts.entries()]
    .filter(([, n]) => n === max)
    .map(([id]) => id)
    .sort((a, b) => a - b);

  if (winners.length === 1) {
    return { tagId: winners[0]!, isParentFallback: false };
  }

  // Tie-break: shared parent?
  const parents = winners.map((id) => {
    const t = flatTags.find((x) => x.tag_id === id);
    return t?.parent ?? null;
  });
  const allShareParent =
    parents.every((p) => p != null) &&
    parents.every((p) => p === parents[0]);
  if (allShareParent && parents[0] != null) {
    return { tagId: parents[0], isParentFallback: true };
  }
  // No shared parent → pick any (smallest tag_id, stable).
  return { tagId: winners[0]!, isParentFallback: false };
}

// Bucket rules into groups keyed by the sorted tag-set.
export function groupRules(
  rules: readonly CategorizationRule[],
  flatTags: readonly FlatTag[]
): RuleGroup[] {
  const buckets = new Map<string, CategorizationRule[]>();
  for (const r of rules) {
    const key = tagSetKey(r.tag_ids ?? []);
    const list = buckets.get(key);
    if (list) list.push(r);
    else buckets.set(key, [r]);
  }

  const groups: RuleGroup[] = [];
  for (const [key, bucketRules] of buckets) {
    const choice = chooseRepresentativePrimary(bucketRules, flatTags);
    const setIds = Array.from(
      new Set(bucketRules.flatMap((r) => r.tag_ids ?? []))
    ).sort((a, b) => a - b);
    const others = choice.isParentFallback
      ? setIds
      : setIds.filter((id) => id !== choice.tagId);
    groups.push({
      key,
      representativePrimary: choice.tagId,
      otherTagIds: others,
      rules: [...bucketRules].sort((a, b) =>
        (a.beneficiary_name || '').localeCompare(b.beneficiary_name || '')
      ),
    });
  }

  // Sort: single-rule groups first, multi-rule groups after. Within
  // each band, alphabetical by representative tag name. The
  // singletons-first ordering trades the strict alphabetical view for
  // a cleaner visual rhythm — singletons look identical to legacy
  // cards; condensed groups sit together as a separate cluster. If
  // the singleton count grows past comfortable scroll-depth, the
  // follow-up move is to add "Standalone (N)" / "Grouped (N)"
  // sub-headings or a scroll-jump anchor — both deferred until usage
  // proves the need.
  return groups.sort((a, b) => {
    const aSingleton = a.rules.length === 1 ? 0 : 1;
    const bSingleton = b.rules.length === 1 ? 0 : 1;
    if (aSingleton !== bSingleton) return aSingleton - bSingleton;
    const aTag = flatTags.find((t) => t.tag_id === a.representativePrimary);
    const bTag = flatTags.find((t) => t.tag_id === b.representativePrimary);
    return (aTag?.tag_name ?? '').localeCompare(bTag?.tag_name ?? '');
  });
}
