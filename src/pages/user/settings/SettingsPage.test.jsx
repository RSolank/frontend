import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

import { SettingsPage } from './SettingsPage';

// Batch 7 thinned this husk page down to a link index. The full
// SettingsLayout shell ships in Batch 9; until then this test just
// asserts the index renders the three live settings links.
describe('SettingsPage husk', () => {
  it('renders link entries for every live settings surface', () => {
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Taxation Rules')).toBeInTheDocument();
    expect(screen.getByText('Categorization Rules')).toBeInTheDocument();
    expect(screen.getByText('Categories')).toBeInTheDocument();

    const taxationLink = screen.getByRole('link', { name: /Taxation Rules/ });
    expect(taxationLink).toHaveAttribute('href', '/settings/taxation-rules');
  });
});
