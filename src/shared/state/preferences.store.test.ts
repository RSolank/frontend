import { beforeEach, describe, expect, it } from 'vitest';

import {
  isHeaderSafe,
  PREFERENCES_DEFAULTS,
  sanitizePreferences,
  usePreferencesStore,
} from './preferences.store';

describe('usePreferencesStore', () => {
  beforeEach(() => {
    usePreferencesStore.getState().reset();
    localStorage.clear();
  });

  it('starts on the §5 defaults (USD / null / UTC)', () => {
    const s = usePreferencesStore.getState();
    expect(s.currency).toBe('USD');
    expect(s.country).toBeNull();
    expect(s.timezone).toBe('UTC');
    expect(PREFERENCES_DEFAULTS).toEqual({
      currency: 'USD',
      country: null,
      timezone: 'UTC',
    });
  });

  it('setPreferences replaces the slice atomically', () => {
    usePreferencesStore.getState().setPreferences({
      currency: 'INR',
      country: 'IN',
      timezone: 'Asia/Kolkata',
    });
    const s = usePreferencesStore.getState();
    expect(s.currency).toBe('INR');
    expect(s.country).toBe('IN');
    expect(s.timezone).toBe('Asia/Kolkata');
  });

  it('reset() restores defaults', () => {
    usePreferencesStore.getState().setPreferences({
      currency: 'EUR',
      country: 'DE',
      timezone: 'Europe/Berlin',
    });
    usePreferencesStore.getState().reset();
    expect(usePreferencesStore.getState()).toMatchObject(PREFERENCES_DEFAULTS);
  });

  it('persists under the "user-preferences" key', () => {
    usePreferencesStore.getState().setPreferences({
      currency: 'JPY',
      country: 'JP',
      timezone: 'Asia/Tokyo',
    });
    const raw = localStorage.getItem('user-preferences');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!) as {
      state: { currency: string; country: string; timezone: string };
    };
    expect(parsed.state.currency).toBe('JPY');
    expect(parsed.state.country).toBe('JP');
    expect(parsed.state.timezone).toBe('Asia/Tokyo');
  });
});

describe('isHeaderSafe', () => {
  it('accepts printable ASCII', () => {
    expect(isHeaderSafe('USD')).toBe(true);
    expect(isHeaderSafe('Asia/Kolkata')).toBe(true);
    expect(isHeaderSafe('Europe/Berlin')).toBe(true);
  });

  it('rejects empty / non-string values', () => {
    expect(isHeaderSafe('')).toBe(false);
    expect(isHeaderSafe(null)).toBe(false);
    expect(isHeaderSafe(undefined)).toBe(false);
    expect(isHeaderSafe(42)).toBe(false);
  });

  it('rejects non-ASCII characters (the ₹ regression)', () => {
    expect(isHeaderSafe('₹')).toBe(false); // U+20B9, code 8377
    expect(isHeaderSafe('€')).toBe(false); // U+20AC
    expect(isHeaderSafe('USD\n')).toBe(false); // control char
    expect(isHeaderSafe('USD ')).toBe(false); // NBSP > 0x7E
  });
});

describe('sanitizePreferences', () => {
  it('passes a clean payload through unchanged', () => {
    expect(
      sanitizePreferences({
        currency: 'INR',
        country: 'India',
        timezone: 'Asia/Kolkata',
      })
    ).toEqual({
      currency: 'INR',
      country: 'India',
      timezone: 'Asia/Kolkata',
    });
  });

  it('falls back to USD when currency is a unicode symbol', () => {
    // Mirrors the 2026-05-25 incident: a legacy data row had currency
    // stored as "₹" instead of "INR"; without this fallback the value
    // poisoned the store and broke every subsequent fetch().
    expect(
      sanitizePreferences({
        currency: '₹',
        country: 'India',
        timezone: 'Asia/Kolkata',
      })
    ).toEqual({
      currency: 'USD',
      country: 'India',
      timezone: 'Asia/Kolkata',
    });
  });

  it('falls back per-field for null / missing values', () => {
    expect(
      sanitizePreferences({
        currency: null as unknown as string,
        country: null,
        timezone: undefined as unknown as string,
      })
    ).toEqual(PREFERENCES_DEFAULTS);
    expect(sanitizePreferences(null)).toEqual(PREFERENCES_DEFAULTS);
    expect(sanitizePreferences(undefined)).toEqual(PREFERENCES_DEFAULTS);
  });
});
