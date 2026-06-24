import { useTaxModeStore } from '../../../../shared/state/taxMode.store';

import { ProvisionHeroCard } from './ProvisionHeroCard';
import { SavingsHeroCard } from './SavingsHeroCard';
import { SpendHeroCard } from './SpendHeroCard';

// Zone ❶ — the hero, swapped by taxation mode.
//
//   • auto / manual → the provision story leads: what you've set aside this
//     week (ProvisionHeroCard) beside your growing savings (SavingsHeroCard).
//     This is Aevum's signature home — owed-to-future-self + the portfolio
//     gateway.
//   • off → the user has opted out of the savings engine and is running Aevum
//     as a plain expense tracker, so spend leads (SpendHeroCard) and the
//     provision/savings story demotes to the analytics zone as a re-enable
//     nudge (see DashboardPage's zone ❸ swap).
//
// Only the *content* swaps here; the entrance choreography is owned by the
// page so this stays a thin selector.
export function DashboardHero() {
  const mode = useTaxModeStore((s) => s.mode);

  if (mode === 'off') {
    return (
      <div data-testid="dashboard-hero" data-mode="off">
        <SpendHeroCard />
      </div>
    );
  }

  return (
    <div
      data-testid="dashboard-hero"
      data-mode={mode}
      className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2"
    >
      <ProvisionHeroCard />
      <SavingsHeroCard />
    </div>
  );
}
