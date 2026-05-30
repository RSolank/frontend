import { useQuery } from '@tanstack/react-query';

import { apiFetch } from './apiClient';
import { routes } from './routes';

// Static system reference data (countries / currencies) served by the
// backend's /api/metadata/* endpoints. This lives in shared/ — not a
// feature — because it has no UI of its own and is consumed across
// almost every feature (currency symbol for formatMoney, the country /
// currency / timezone pickers). React-query keys are kept local; the
// endpoints are effectively static per session, so a long staleTime
// makes the dropdowns cheap to mount everywhere.
const referenceDataKeys = {
  all: ['reference-data'] as const,
  countries: () => [...referenceDataKeys.all, 'countries'] as const,
  currencies: () => [...referenceDataKeys.all, 'currencies'] as const,
} as const;

export interface CountryOption {
  name: string;
  country_code?: string | null;
  default_currency?: string | null;
  timezone?: string | null;
}

export interface CurrencyOption {
  code: string;
  label: string;
  symbol?: string | null;
}

interface CountriesResponse {
  countries?: CountryOption[];
}

interface CurrenciesResponse {
  currencies?: CurrencyOption[];
}

export function fetchCountries(): Promise<CountriesResponse> {
  return apiFetch<CountriesResponse>(routes.metadata.countries());
}

export function fetchCurrencies(): Promise<CurrenciesResponse> {
  return apiFetch<CurrenciesResponse>(routes.metadata.currencies());
}

// Reference data: changes between deploys, not between page navigations.
// Cache for an hour so CountrySelect / CurrencySelect mount instantly
// after the first hit.
const REFERENCE_DATA_STALE_MS = 60 * 60 * 1000;

export function useCountriesQuery() {
  return useQuery({
    queryKey: referenceDataKeys.countries(),
    queryFn: async () => (await fetchCountries()).countries ?? [],
    staleTime: REFERENCE_DATA_STALE_MS,
  });
}

export function useCurrenciesQuery() {
  return useQuery({
    queryKey: referenceDataKeys.currencies(),
    queryFn: async () => (await fetchCurrencies()).currencies ?? [],
    staleTime: REFERENCE_DATA_STALE_MS,
  });
}
