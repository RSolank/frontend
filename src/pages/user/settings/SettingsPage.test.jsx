import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

import { SettingsPage } from './SettingsPage';

// Mock the only remaining tab so the SettingsPage test stays scoped to
// tab orchestration. Categorization rules moved to /categorization-rules
// in Batch 6; taxation extracts in Batch 7.
vi.mock('./TaxationRulesTab.jsx', () => ({
  TaxationRulesTab: () => <div data-testid="taxation-tab">Taxation</div>,
}));

describe('SettingsPage', () => {
  it('defaults to the taxation rules tab', () => {
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    );

    expect(screen.getByTestId('taxation-tab')).toBeInTheDocument();
  });

  it('falls back to default when query points at the extracted categorization tab', () => {
    render(
      <MemoryRouter initialEntries={['/settings?tab=categorization_rules']}>
        <SettingsPage />
      </MemoryRouter>
    );

    expect(screen.getByTestId('taxation-tab')).toBeInTheDocument();
  });
});
