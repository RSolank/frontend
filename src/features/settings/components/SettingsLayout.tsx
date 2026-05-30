import {
  SectionedPageLayout,
  type SectionSpec,
} from '../../../shared/components/SectionedPageLayout';

// The three live settings surfaces. Beneficiaries stays at top-level
// /beneficiaries (heavy cross-feature deep-linking from transactions +
// categorization rules — keeping it out of the sidebar shortens the
// reach for the most common settings-adjacent flow).
export const SETTINGS_SECTIONS: SectionSpec[] = [
  { path: '/settings/categories', label: 'Categories' },
  { path: '/settings/categorization-rules', label: 'Categorization Rules' },
  { path: '/settings/taxation-rules', label: 'Taxation Rules' },
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
