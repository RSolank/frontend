import { beforeEach, describe, expect, it } from 'vitest';

import {
  PREFERENCES_DEFAULTS,
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
