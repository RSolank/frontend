import type { ActivityFeedItem } from '../api/activityFeed';

// The `domain` axis carried on every activity signal (see the backend
// `activity_registry` SignalSpec.domain — a FE-grouping label, NOT a
// ranking axis). The bell uses it as the in-section group header.
//
// Known domains get a curated label; anything else (e.g. a new BE domain
// shipped ahead of the FE) falls back to a title-cased form so the header
// is always sensible rather than a raw snake_case token.
const DOMAIN_LABELS: Record<string, string> = {
  taxation: 'Taxation',
  budgets: 'Budgets',
  recurring: 'Recurring',
  account: 'Account',
  beneficiaries: 'Beneficiaries',
  bank_accounts: 'Bank Accounts',
  transactions: 'Transactions',
};

export function domainLabel(domain: string): string {
  const known = DOMAIN_LABELS[domain];
  if (known) return known;
  if (!domain) return 'Other';
  return domain
    .split('_')
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(' ');
}

export interface DomainGroup {
  domain: string;
  label: string;
  items: ActivityFeedItem[];
}

// Group a single event-class slice (already in BE rank order) by `domain`,
// Strategy A: domain groups appear in the order of each domain's
// highest-ranked item (its first appearance in the rank-ordered input),
// and items within a group keep their original BE order.
//
// An insertion-ordered Map gives us both for free: the input is already
// globally rank-sorted, so first-seen == top-ranked, and we never move an
// item relative to another within its domain. The bell never re-sorts —
// this only *clusters* the existing order under headers, so the BE
// ranking (value → g_rank → refreshed_at → uid) is preserved as far as a
// contiguous-grouping can. Empty domains never appear (a header is only
// emitted for a domain that has at least one item).
export function groupByDomain(items: ActivityFeedItem[]): DomainGroup[] {
  const groups = new Map<string, DomainGroup>();
  for (const item of items) {
    const domain = item.domain || '';
    let group = groups.get(domain);
    if (!group) {
      group = { domain, label: domainLabel(domain), items: [] };
      groups.set(domain, group);
    }
    group.items.push(item);
  }
  return [...groups.values()];
}
