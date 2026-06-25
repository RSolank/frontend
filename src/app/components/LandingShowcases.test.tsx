import { screen } from '@testing-library/react';

import { renderWithProviders } from '../../test/renderWithProviders';

import { LandingShowcases } from './LandingShowcases';

// The showcases reuse REAL app components fed fabricated fixtures, so this
// guards two things at runtime: the lineup the marketing page promises, and
// that each fixture still satisfies the live component's props (a shape drift
// would crash the render here, not just fail typecheck).
describe('LandingShowcases', () => {
  it('renders the cycle + trend marquee rows and the 2-up grid', async () => {
    renderWithProviders(<LandingShowcases />);

    // Section heading + the "cycle" marquee row label.
    expect(
      screen.getByText(/Budgeting with built-in accountability/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Spend, self-tax, set aside/i)
    ).toBeInTheDocument();

    // 2-up grid (synchronous): Transactions card (left) with a fabricated txn,
    // and the live Upcoming-bills card (right) that replaced the old screenshot.
    expect(screen.getByText(/Your activity at a glance/i)).toBeInTheDocument();
    expect(screen.getByText('Blue Tokai Coffee')).toBeInTheDocument();
    expect(screen.getByText(/Know what's coming/i)).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-upcoming')).toBeInTheDocument();
    expect(screen.getByText('Rent')).toBeInTheDocument();

    // Lazy chart views resolve from Suspense: the cycle row pairs the
    // ExpenseOverview card with the CurrentWeekTracker; row 2 is the SpendTrend.
    expect(await screen.findByTestId('expense-overview')).toBeInTheDocument();
    expect(
      await screen.findByText(/This week — running tax/i)
    ).toBeInTheDocument();
    expect(await screen.findByText(/Spending trend/i)).toBeInTheDocument();
  });
});
