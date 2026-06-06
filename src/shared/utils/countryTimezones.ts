import type { CountryOption } from '../api/referenceData';

// Helpers around the BE Phase 1.3 `/api/metadata/{countries,timezones}`
// endpoints. The data lives in TanStack Query (see
// `shared/api/referenceData.ts:useCountriesQuery` /
// `useTimezonesQuery`); these helpers stay pure and take the list as
// an argument so they're trivial to test and don't require their own
// store. Components subscribe to the queries and pass the data in.
//
// History: the project used to read this from the npm
// `countries-and-timezones` package + `Intl.supportedValuesOf` for
// the IANA list. Both retired in Platform FE Batch 4 — backend is
// now SoT (multi-tz countries return the full set; the IANA list
// comes from one endpoint).

// Look up a country's IANA timezones from the metadata payload, keyed
// by display name (the form the `/api/metadata/countries` endpoint
// returns). Returns [] when nothing matches — callers fall back to
// the full IANA list (via `useTimezonesQuery`).
export function getTimezonesForCountryName(
  name: string | null | undefined,
  countries: CountryOption[]
): string[] {
  if (!name) return [];
  const target = name.toLowerCase();
  const c = countries.find((entry) => entry.name.toLowerCase() === target);
  return c?.timezones ?? [];
}

// Per-tz cache of the current UTC offset string (e.g. "UTC+5:30"). Computed
// once per session via Intl.DateTimeFormat with `timeZoneName: 'shortOffset'`,
// then formatted to a stable shape. Offsets reflect the *current* DST state
// — users are calibrating "now"; if DST flips mid-session the labels go
// slightly stale until the next reload, which is fine.
const offsetCache = new Map<string, string>();

export function getTimezoneOffsetLabel(tz: string): string {
  const cached = offsetCache.get(tz);
  if (cached !== undefined) return cached;
  let label = '';
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName: 'shortOffset',
    }).formatToParts(new Date());
    const namePart = parts.find((p) => p.type === 'timeZoneName')?.value ?? '';
    // Intl returns "GMT+5:30" / "GMT-8" / "GMT" — normalize to "UTC±H:MM".
    // "GMT" alone (no sign) means offset zero.
    if (namePart === 'GMT') {
      label = 'UTC';
    } else {
      label = namePart.replace(/^GMT/, 'UTC');
    }
  } catch {
    label = '';
  }
  offsetCache.set(tz, label);
  return label;
}

// "Asia/Kolkata" + "UTC+5:30" → "Asia/Kolkata (UTC+5:30)".
// Bare tz when the offset can't be resolved.
export function formatTimezoneOption(tz: string): string {
  const offset = getTimezoneOffsetLabel(tz);
  return offset ? `${tz} (${offset})` : tz;
}

export function getBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

// Resolve an ISO 3166-1 alpha-2 region code (e.g. "IN") to its English
// display name (e.g. "India") for matching against the metadata API. Falls
// back to the region code if `Intl.DisplayNames` is unavailable.
export function getCountryNameFromRegion(
  region: string | null | undefined
): string | null {
  if (!region) return null;
  try {
    const dn = new Intl.DisplayNames(['en'], { type: 'region' });
    return dn.of(region.toUpperCase()) ?? null;
  } catch {
    return null;
  }
}

// Browser locale → ISO region (e.g. "en-IN" → "IN"). Returns null for
// language-only locales.
export function getBrowserRegion(): string | null {
  try {
    const loc = (navigator.language || '').toUpperCase();
    const parts = loc.split('-');
    return parts[1] || null;
  } catch {
    return null;
  }
}
