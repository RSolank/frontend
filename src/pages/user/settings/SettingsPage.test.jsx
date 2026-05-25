import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

import { SettingsPage } from './SettingsPage';

// Mock sub-components so the SettingsPage test stays scoped to tab
// orchestration and doesn't depend on the rule-tab internals (those get
// their own tests when categorization/taxation extract in B6/B7).
vi.mock('./CategorizationRulesTab.jsx', () => ({
  CategorizationRulesTab: () => <div data-testid="rules-tab">Rules</div>,
}));
vi.mock('./TaxationRulesTab.jsx', () => ({
  TaxationRulesTab: () => <div data-testid="taxation-tab">Taxation</div>,
}));

describe('SettingsPage', () => {
  it('defaults to the categorization rules tab now that categories has its own page', () => {
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    );

    expect(screen.getByTestId('rules-tab')).toBeInTheDocument();
  });

  it('initializes with tab from URL query', () => {
    render(
      <MemoryRouter initialEntries={['/settings?tab=taxation_rules']}>
        <SettingsPage />
      </MemoryRouter>
    );

    expect(screen.getByTestId('taxation-tab')).toBeInTheDocument();
  });

  it('falls back to default when query points at the removed categories tab', () => {
    render(
      <MemoryRouter initialEntries={['/settings?tab=categories']}>
        <SettingsPage />
      </MemoryRouter>
    );

    expect(screen.getByTestId('rules-tab')).toBeInTheDocument();
  });

  it('switches tabs on click', () => {
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByText('Taxation Rules'));
    expect(screen.getByTestId('taxation-tab')).toBeInTheDocument();
  });
});
