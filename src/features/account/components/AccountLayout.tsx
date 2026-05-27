import {
  SectionedPageLayout,
  type SectionSpec,
} from '../../../shared/components/SectionedPageLayout';

// Five sections, in display order. Profile is the canonical landing
// surface (linked from the user-dropdown avatar and the mobile
// drawer's Profile row).
export const ACCOUNT_SECTIONS: SectionSpec[] = [
  { path: '/account/profile', label: 'Profile' },
  { path: '/account/security', label: 'Security' },
  { path: '/account/privacy', label: 'Privacy' },
  { path: '/account/accessibility', label: 'Accessibility' },
  { path: '/account/preferences', label: 'Preferences' },
];

export function AccountLayout() {
  return (
    <SectionedPageLayout
      rootLabel="Account"
      rootHref="/account"
      sections={ACCOUNT_SECTIONS}
    />
  );
}
