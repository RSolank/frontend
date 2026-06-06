import { useQuery } from '@tanstack/react-query';

import { apiFetch } from './apiClient';
import { routes } from './routes';

// Product brand identity served by `GET /metadata/branding` (BE
// Phase 2.11). Public endpoint — no auth required, so the query
// fires for unauth visitors too (Home landing page reads it).
//
// **No hardcoded brand literals.** The brand-identity values
// (name / tagline / description / logo) come from the BE response,
// never from a baked-in constant. To avoid first-paint flashes of
// empty wordmarks on repeat visits, the last-seen response is
// cached in `localStorage` and replayed as `placeholderData` for
// the next session. First-ever visit: neutral empty placeholder
// until the network resolves (typically one tick on dev, ~100ms
// on prod). Browser handles logo-image caching automatically — the
// URL is from `<MEDIA_URL_PREFIX>/...`, served by the BE.
// Deploy-host capability flags. **Always present** on the wire as
// of BE Phase 3.2 (`92fb2ba`) — both inner flags are always-emitted
// booleans. The outer field is kept optional on the FE type only
// to absorb a localStorage cache from a pre-3.2 visit; the hook in
// `shared/api/capabilities.ts` defaults the missing-object case to
// all-enabled.
export interface BrandingCapabilities {
  profile_image_uploads_enabled: boolean;
  statement_upload_enabled: boolean;
}

export interface BrandingResponse {
  name: string;
  tagline: string;
  description: string;
  logo_url?: string | null;
  capabilities?: BrandingCapabilities | null;
}

const BRAND_CACHE_KEY = 'pba.brand';

// Neutral first-ever placeholder. Empty strings render as empty
// `<span>`s; the React tree resolves shortly after mount. Logo
// stays null so the FE falls back to the text wordmark / icon.
const NEUTRAL_PLACEHOLDER: BrandingResponse = {
  name: '',
  tagline: '',
  description: '',
  logo_url: null,
};

function readCachedBrand(): BrandingResponse {
  if (typeof localStorage === 'undefined') return NEUTRAL_PLACEHOLDER;
  try {
    const raw = localStorage.getItem(BRAND_CACHE_KEY);
    if (!raw) return NEUTRAL_PLACEHOLDER;
    const parsed = JSON.parse(raw) as Partial<BrandingResponse>;
    // BE Phase 3.2 emits `capabilities` always; a pre-3.2 cached
    // blob may lack the field. Defaults backfill missing inner
    // booleans to `true` (all features enabled) so the FE never
    // mid-renders an "undefined → disabled" UI.
    const capabilities =
      parsed.capabilities && typeof parsed.capabilities === 'object'
        ? {
            profile_image_uploads_enabled:
              (parsed.capabilities as Partial<BrandingCapabilities>)
                .profile_image_uploads_enabled ?? true,
            statement_upload_enabled:
              (parsed.capabilities as Partial<BrandingCapabilities>)
                .statement_upload_enabled ?? true,
          }
        : undefined;
    return {
      name: typeof parsed.name === 'string' ? parsed.name : '',
      tagline: typeof parsed.tagline === 'string' ? parsed.tagline : '',
      description:
        typeof parsed.description === 'string' ? parsed.description : '',
      logo_url: typeof parsed.logo_url === 'string' ? parsed.logo_url : null,
      capabilities,
    };
  } catch {
    return NEUTRAL_PLACEHOLDER;
  }
}

function writeCachedBrand(brand: BrandingResponse): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(BRAND_CACHE_KEY, JSON.stringify(brand));
  } catch {
    // localStorage quota or disabled — this session still has the
    // fresh response in the query cache; cache miss next session.
  }
}

const brandingKeys = {
  all: ['branding'] as const,
  current: () => [...brandingKeys.all, 'current'] as const,
} as const;

export function fetchBranding(): Promise<BrandingResponse> {
  return apiFetch<BrandingResponse>(routes.metadata.branding());
}

// Brand identity is effectively static per deploy; one hour stale
// time matches the rest of the reference-data cluster.
const BRANDING_STALE_MS = 60 * 60 * 1000;

export function useBrandingQuery() {
  return useQuery({
    queryKey: brandingKeys.current(),
    queryFn: async () => {
      const fresh = await fetchBranding();
      writeCachedBrand(fresh);
      return fresh;
    },
    staleTime: BRANDING_STALE_MS,
    // Function-form placeholder so we read localStorage once per
    // mount, not on every render. First-ever visit returns the
    // neutral empty placeholder; subsequent visits replay the
    // cached brand instantly while the network refreshes.
    placeholderData: readCachedBrand,
  });
}

// Logo URL helper — the BE returns a relative `/media/...` path or
// null. Consumers pass the result straight to `<img src>`; null
// means "no asset shipped, fall back to text wordmark or icon".
const MEDIA_BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  'http://localhost:4000';

export function resolveBrandLogoUrl(
  logo_url: string | null | undefined
): string | null {
  if (!logo_url) return null;
  // Allow absolute URLs to pass through unchanged (future CDN host);
  // otherwise prefix with the BE base.
  if (/^https?:\/\//.test(logo_url)) return logo_url;
  return `${MEDIA_BASE_URL}${logo_url}`;
}
