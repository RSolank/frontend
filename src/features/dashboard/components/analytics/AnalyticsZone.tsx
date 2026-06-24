import { useTaxModeStore } from '../../../../shared/state/taxMode.store';

import { ProvisionSavingsPlaceholder } from './ProvisionSavingsPlaceholder';
import { SpendAnalyticsCard } from './SpendAnalyticsCard';

// Zone ❸ — the counterpart of the hero swap. In auto/manual the hero leads
// with provision + savings, so the analytics zone carries the spend breakdown.
// In off mode the spend story is promoted to the hero, so this zone holds the
// dataless provision/savings re-enable nudge instead. Only the content swaps;
// the page owns the entrance motion.
export function AnalyticsZone() {
  const mode = useTaxModeStore((s) => s.mode);
  return mode === 'off' ? (
    <ProvisionSavingsPlaceholder />
  ) : (
    <SpendAnalyticsCard />
  );
}
