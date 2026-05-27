import {
  getAllCountries,
  getCountry,
  type Country,
} from 'countries-and-timezones';

// Thin wrapper around the `countries-and-timezones` package so the eventual
// swap to a backend-sourced list (see frontend/docs/refactor/implementation_plan.md
// "Backend follow-ups") is a one-file change.

let nameIndex: Map<string, Country> | null = null;

function buildNameIndex(): Map<string, Country> {
  if (nameIndex) return nameIndex;
  const map = new Map<string, Country>();
  for (const c of Object.values(getAllCountries())) {
    map.set(c.name.toLowerCase(), c);
    // Also index against Intl.DisplayNames' English form so backend
    // metadata that uses (e.g.) "United States" matches the package's
    // "United States of America" entry.
    const intlName = getCountryNameFromRegion(c.id);
    if (intlName && intlName.toLowerCase() !== c.name.toLowerCase()) {
      map.set(intlName.toLowerCase(), c);
    }
  }
  nameIndex = map;
  return map;
}

// Look up a country's ISO timezones by its display name (the form the
// `/api/metadata/countries` endpoint returns). Returns [] when nothing
// matches — callers should fall back to the full IANA list.
export function getTimezonesForCountryName(name: string | null | undefined): string[] {
  if (!name) return [];
  const c = buildNameIndex().get(name.toLowerCase());
  return c ? [...c.timezones] : [];
}

export function getTimezonesForRegion(region: string | null | undefined): string[] {
  if (!region) return [];
  const c = getCountry(region.toUpperCase());
  return c ? [...c.timezones] : [];
}

let allTimezonesCache: string[] | null = null;

// Full IANA list. Prefers `Intl.supportedValuesOf('timeZone')` (~600 zones,
// matches the browser's own resolver) and falls back to the package data.
export function getAllTimezones(): string[] {
  if (allTimezonesCache) return allTimezonesCache;
  const fromIntl =
    typeof Intl !== 'undefined' &&
    typeof (Intl as typeof Intl & { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf === 'function'
      ? (Intl as typeof Intl & { supportedValuesOf: (k: string) => string[] }).supportedValuesOf('timeZone')
      : null;

  // Merge `Intl.supportedValuesOf('timeZone')` (covers the legacy IANA
  // names some runtimes report) with the modern names from the package
  // (so e.g. "Asia/Kolkata" shows up even when the runtime still reports
  // "Asia/Calcutta"). Plus always include UTC explicitly — some runtimes
  // omit it from the supported list.
  const seen = new Set<string>(['UTC']);
  if (fromIntl) for (const tz of fromIntl) seen.add(tz);
  for (const c of Object.values(getAllCountries())) {
    for (const tz of c.timezones) seen.add(tz);
  }
  allTimezonesCache = [...seen].sort();
  return allTimezonesCache;
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
export function getCountryNameFromRegion(region: string | null | undefined): string | null {
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
