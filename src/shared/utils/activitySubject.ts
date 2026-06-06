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
      return { href: '/transactions', ctaLabel: 'Open transactions' };
    case 'account':
      return { href: '/account/profile', ctaLabel: 'Open account' };
    case 'account_security':
      return { href: '/account/security', ctaLabel: 'Open security' };
    case 'backup_codes':
      return { href: '/account/security', ctaLabel: 'Manage backup codes' };
    case 'device':
      return { href: '/account/security', ctaLabel: 'Review devices' };
    case 'new_payees':
      return { href: '/beneficiaries', ctaLabel: 'Review payees' };
    case 'beneficiary':
      return {
        href: `/beneficiaries/${encodeURIComponent(subjectId)}`,
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
