import type { ActivityFeedItem } from '../api/activityFeed';

// Maps an activity feed item to its UI affordances:
//
//   - `href`     — the route the CTA in the detail modal navigates to.
//                  `null` for subjects we can't deep-link (no matching
//                  page yet).
//   - `ctaLabel` — text on the CTA button.
//
// The 12 subject_types listed below come from
// `backend/app/modules/activity/activity_registry.py` (SIGNALS table,
// BE Phase 2.14). Anything outside that set falls into the default
// branch with no CTA. Enriching the detail view with per-subject
// fetches (the "hybrid" model in the 2026-06-05 spec) is parked —
// `shared/` can't depend on `features/`, so domain GETs (bill,
// beneficiary, statement-upload) require either a BE `GET
// /activity/{uid}` endpoint or relocating the activity surface to
// `features/activity/`.

export interface ActivitySubjectMeta {
  href: string | null;
  ctaLabel: string;
}

// The `recurring` subject's CTA, split out so `subjectMeta`'s switch stays
// flat. subject_id is the slot key: `tmpl:<uid>` for the pattern-detected
// signal, `bill:<uid>` for the two bill signals. Point each CTA at its own row
// on the recurring settings page — the deep-link highlight (useDeepLinkHighlight)
// flashes + scrolls the target on arrival.
function recurringSubjectMeta(
  item: ActivityFeedItem,
  subjectId: string
): ActivitySubjectMeta {
  const targetId = subjectId.includes(':')
    ? subjectId.slice(subjectId.indexOf(':') + 1)
    : subjectId;
  const enc = encodeURIComponent(targetId);
  if (item.kind === 'recurring_pattern_detected') {
    return {
      href: `/settings/recurring?template=${enc}`,
      ctaLabel: 'View template',
    };
  }
  if (
    item.kind === 'recurring_bill_pending' ||
    item.kind === 'recurring_bill_upcoming'
  ) {
    return {
      href: `/settings/recurring?tab=upcoming&bill=${enc}`,
      ctaLabel:
        item.kind === 'recurring_bill_pending'
          ? 'Review bill due'
          : 'View upcoming bill',
    };
  }
  // Any other recurring-domain signal: land on the page itself.
  return { href: '/settings/recurring', ctaLabel: 'Open recurring' };
}

export function subjectMeta(item: ActivityFeedItem): ActivitySubjectMeta {
  const subjectType = item.subject_type;
  const subjectId = item.subject_id;
  switch (subjectType) {
    case 'bill':
      return {
        href: `/consumption-tax?bill=${encodeURIComponent(subjectId)}`,
        ctaLabel: 'View bill',
      };
    case 'budget':
      return { href: '/budgets', ctaLabel: 'Open budgets' };
    case 'tax_settings':
      return {
        href: '/account/preferences',
        ctaLabel: 'Open tax settings',
      };
    case 'recurring':
      return recurringSubjectMeta(item, subjectId);
    case 'account':
      return { href: '/account/profile', ctaLabel: 'Open account' };
    case 'account_security':
      return { href: '/account/security', ctaLabel: 'Open security' };
    case 'backup_codes':
      return { href: '/account/security', ctaLabel: 'Manage backup codes' };
    case 'device':
      return { href: '/account/security', ctaLabel: 'Review devices' };
    case 'new_payees':
      return { href: '/settings/beneficiaries', ctaLabel: 'Review payees' };
    case 'beneficiary':
      return {
        href: `/settings/beneficiaries?edit=${encodeURIComponent(subjectId)}`,
        ctaLabel: 'Open payee',
      };
    case 'bank_account':
      return {
        href: '/settings/bank-accounts',
        ctaLabel: 'Register account',
      };
    case 'statement':
      return {
        href: `/transactions?upload=${encodeURIComponent(subjectId)}`,
        ctaLabel: 'View upload',
      };
    default:
      return { href: null, ctaLabel: 'Open' };
  }
}
