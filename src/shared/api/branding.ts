import { useQuery } from '@tanstack/react-query';

import { apiFetch } from './apiClient';
import { routes } from './routes';

// Product brand identity served by `GET /metadata/branding` (BE
// Phase 2.11). Public endpoint — no auth required, so the query
// fires for unauth visitors too (Home landing page reads it).
//
// FALLBACK shape exports below — used by the consumer hook + every
// non-React surface (index.html title, the 2FA backup-codes file
// header) that can't read TanStack Query. The hardcoded "Aevum"
// matches the BE constants record so first paint never shows the
// wrong product name; the network response is the authoritative
// rebrand-without-redeploy hook.
export interface BrandingResponse {
  name: string;
  tagline: string;
  description: string;
  logo_url?: string | null;
}

export const BRAND_FALLBACK: BrandingResponse = {
  name: 'Aevum',
  tagline: 'Future begins today',
  description:
    'Aevum turns the limits you set for yourself into a self-imposed consumption tax — overspend a category and the difference is billed back to you each week, so the true cost of every discretionary purchase is impossible to ignore.',
  logo_url: null,
};

const brandingKeys = {
  all: ['branding'] as const,
  current: () => [...brandingKeys.all, 'current'] as const,
} as const;

export function fetchBranding(): Promise<BrandingResponse> {
  return apiFetch<BrandingResponse>(routes.metadata.branding());
}

// Brand identity is effectively static per deploy; one hour stale
// time matches the rest of the reference-data cluster. The fallback
// is returned synchronously while the first fetch is in flight so
// every consumer renders a name without flashing the empty string.
const BRANDING_STALE_MS = 60 * 60 * 1000;

export function useBrandingQuery() {
  return useQuery({
    queryKey: brandingKeys.current(),
    queryFn: fetchBranding,
    staleTime: BRANDING_STALE_MS,
    // Survive transient failures gracefully — the BE always serves
    // this surface, but a cold cache + bad network shouldn't blank
    // the brand. Initial data also covers the "auth check fails →
    // tokenless visitor on Home" path without a network hop.
    placeholderData: BRAND_FALLBACK,
  });
}

// Synchronous accessor for non-React callers (e.g. the 2FA backup-
// codes blob writer). Always falls back to the hardcoded name; no
// access to the live cache from outside React. If we ever need
// network-truth here we'd thread a value through props instead.
export function getBrandName(): string {
  return BRAND_FALLBACK.name;
}
