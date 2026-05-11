import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { SettingsPage } from './Settings';

// Mock sub-components to keep test focused on SettingsPage logic
vi.mock('./settings/ProfileTab.jsx', () => ({
  ProfileTab: () => <div data-testid="profile-tab">Profile Content</div>
}));
vi.mock('./settings/CategoriesTab.jsx', () => ({
  CategoriesTab: () => <div data-testid="categories-tab">Categories Content</div>
}));
vi.mock('./settings/CategorizationRulesTab.jsx', () => ({
  CategorizationRulesTab: () => <div>Categorization Rules Content</div>
}));
vi.mock('./settings/BudgetsTab.jsx', () => ({
  BudgetsTab: () => <div>Budgets Content</div>
}));
vi.mock('./settings/TaxationRulesTab.jsx', () => ({
  TaxationRulesTab: () => <div>Taxation Rules Content</div>
}));
vi.mock('./settings/ConsumptionTaxTab.jsx', () => ({
  ConsumptionTaxTab: () => <div>Consumption Tax Content</div>
}));

describe('SettingsPage', () => {
  it('renders and allows switching tabs', () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <SettingsPage />
      </MemoryRouter>
    );

    // Default tab is categories (per Settings.jsx line 25)
    expect(screen.getByTestId('categories-tab')).toBeInTheDocument();

    // Switch to profile
    fireEvent.click(screen.getByText('Profile'));
    expect(screen.getByTestId('profile-tab')).toBeInTheDocument();
    expect(screen.queryByTestId('categories-tab')).not.toBeInTheDocument();
  });

  it('initializes with tab from URL query', () => {
    render(
      <MemoryRouter initialEntries={['/settings?tab=profile']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <SettingsPage />
      </MemoryRouter>
    );

    expect(screen.getByTestId('profile-tab')).toBeInTheDocument();
  });
});
