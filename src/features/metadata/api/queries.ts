import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '../../../shared/api/apiClient';
import { routes } from '../../../shared/api/routes';

import { metadataKeys } from './keys';

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
    queryKey: metadataKeys.countries(),
    queryFn: async () => (await fetchCountries()).countries ?? [],
    staleTime: REFERENCE_DATA_STALE_MS,
  });
}

export function useCurrenciesQuery() {
  return useQuery({
    queryKey: metadataKeys.currencies(),
    queryFn: async () => (await fetchCurrencies()).currencies ?? [],
    staleTime: REFERENCE_DATA_STALE_MS,
  });
}
