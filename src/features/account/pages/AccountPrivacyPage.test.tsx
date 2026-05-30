import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AccountPrivacyPage } from './AccountPrivacyPage';

describe('AccountPrivacyPage', () => {
  it('renders the coming-soon placeholder pointing at the accessibility mask', () => {
    // Card-anchored: page renders no in-content title; breadcrumb
    // (mounted by the AccountLayout shell) carries "Account › Privacy".
    // The card's "Coming soon" heading is the first heading on the
    // page.
    render(<AccountPrivacyPage />);
    expect(screen.getByRole('heading', { name: 'Coming soon' })).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Accessibility' })
    ).toHaveAttribute('href', '/account/accessibility');
  });
});
