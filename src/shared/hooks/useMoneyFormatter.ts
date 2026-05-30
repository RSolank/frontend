import { useMemo } from 'react';

import { useCurrenciesQuery } from '../api/referenceData';
import { usePreferencesStore } from '../state/preferences.store';
import { formatMoney } from '../utils/currency';

// Resolves the user's currency + its symbol (from reference data) and
// returns a ready `money(n)` formatter. Replaces the ~5 lines of
// usePreferencesStore + useCurrenciesQuery + a find-symbol useMemo + a
// formatMoney wrapper that every money-displaying surface used to repeat.
//
// `money` is memoised so passing it as a prop / dep doesn't churn.
// `currencyCode` + `currencySymbol` are returned too for the few call
// sites that need the raw values (e.g. a child that formats itself).
export function useMoneyFormatter() {
  const currencyCode = usePreferencesStore((s) => s.currency);
  const { data: currencies } = useCurrenciesQuery();
  const currencySymbol = useMemo(
    () => currencies?.find((c) => c.code === currencyCode)?.symbol ?? null,
    [currencies, currencyCode]
  );
  const money = useMemo(
    () =>
      (n: number | string | null | undefined): string =>
        formatMoney(n ?? 0, currencyCode, currencySymbol),
    [currencyCode, currencySymbol]
  );
  return { money, currencyCode, currencySymbol };
}
