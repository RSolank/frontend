import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

import { SettingsPage } from './SettingsPage';

// Mock sub-components
vi.mock('../ProfilePage.jsx', () => ({
  ProfilePage: () => <div data-testid="profile-tab">Profile</div>,
}));
vi.mock('./CategoriesTab.jsx', () => ({
  CategoriesTab: () => <div data-testid="categories-tab">Categories</div>,
}));
vi.mock('./CategorizationRulesTab.jsx', () => ({
  CategorizationRulesTab: () => <div data-testid="rules-tab">Rules</div>,
}));
vi.mock('./TaxationRulesTab.jsx', () => ({
  TaxationRulesTab: () => <div data-testid="taxation-tab">Taxation</div>,
}));

describe('SettingsPage', () => {
  it('renders and allows switching tabs via navigation', () => {
    render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <SettingsPage />
      </MemoryRouter>
    );

    // Default tab is now categories
    expect(screen.getByTestId('categories-tab')).toBeInTheDocument();

    // Click Categorization Rules
    fireEvent.click(screen.getByText('Categorization Rules'));
    expect(screen.getByTestId('rules-tab')).toBeInTheDocument();
  });

  it('initializes with tab from URL query', () => {
    render(
      <MemoryRouter
        initialEntries={['/settings?tab=taxation_rules']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <SettingsPage />
      </MemoryRouter>
    );

    expect(screen.getByTestId('taxation-tab')).toBeInTheDocument();
  });

  it('does not render profile or budgets tabs anymore', () => {
    render(
      <MemoryRouter
        initialEntries={['/settings?tab=profile']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <SettingsPage />
      </MemoryRouter>
    );

    // Should fall back to categories
    expect(screen.queryByTestId('profile-tab')).not.toBeInTheDocument();
    expect(screen.getByTestId('categories-tab')).toBeInTheDocument();
  });
});
