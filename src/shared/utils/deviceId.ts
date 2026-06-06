// Stable per-browser-install identifier sent as the `X-Device-Id`
// header on every API request. Per CONTRIBUTING.md §5 / docs/modules/
// auth.md, the backend uses this to sharpen device-aware lockout
// (Phase 1.4) and to pre-wire the new-device OTP challenge so a
// roaming user (mobile IP shifts) isn't re-challenged on every
// reconnect.
//
// Lifecycle: generated once on first access, persisted to
// `localStorage` under `pba.device_id`, never rotated. Clearing
// browser storage (or using a private window) is a fresh install
// from the backend's perspective.
//
// Backend is forward-compatible — absent the header it falls back
// to a UA + client-hints + IP composite, so this is "recommended but
// not required" wiring per the task-platform.md `auth.devices`
// entry.

const STORAGE_KEY = 'pba.device_id';

// RFC-4122 v4 via crypto.randomUUID() when available (every modern
// browser, including happy-dom under vitest). The polyfill fallback
// is exercised only on ancient envs and stays here as a defensive
// path — never used in production.
function generate(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }
  // Minimal RFC-4122 v4 stamp using getRandomValues. Not the
  // common path — included so the function is total.
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(
    ''
  );
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// Lazy cache so we hit `localStorage` once per page load, not once
// per request. The store key never changes after the first write.
let cached: string | null = null;

export function getDeviceId(): string {
  if (cached !== null) return cached;
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing && existing.length > 0) {
      cached = existing;
      return existing;
    }
    const next = generate();
    localStorage.setItem(STORAGE_KEY, next);
    cached = next;
    return next;
  } catch {
    // localStorage may be unavailable (Safari private mode, SSR
    // sanity check). Generate a per-session ID so requests still
    // carry SOMETHING — it just won't persist across reloads.
    const fallback = generate();
    cached = fallback;
    return fallback;
  }
}

// Test-only hook. Clears the in-memory cache so tests that mutate
// localStorage between cases see the new value on the next read.
export function _resetDeviceIdCacheForTests(): void {
  cached = null;
}
