import {
  SectionedPageLayout,
  type SectionSpec,
} from '../../../shared/components/SectionedPageLayout';

// The live settings surfaces. Beneficiaries leads the list (re-homed
// here from the MAIN nav row in T-nav-ia-reorg and made the default
// landing tab — the /settings index redirects to it), followed by
// Recurring (also re-homed out of MAIN). Both carry heavy cross-feature
// deep-linking, which is what makes them settings-adjacent.
export const SETTINGS_SECTIONS: SectionSpec[] = [
  { path: '/settings/beneficiaries', label: 'Beneficiaries' },
  { path: '/settings/recurring', label: 'Recurring' },
  { path: '/settings/categories', label: 'Categories' },
  { path: '/settings/categorization-rules', label: 'Categorization Rules' },
  { path: '/settings/taxation-rules', label: 'Taxation Rules' },
  { path: '/settings/bank-accounts', label: 'Bank Accounts' },
];

export function SettingsLayout() {
  return (
    <SectionedPageLayout
      rootLabel="Settings"
      rootHref="/settings"
      sections={SETTINGS_SECTIONS}
    />
  );
}
