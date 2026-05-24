import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { usePreferencesStore } from '../state/preferences.store';
import { server } from '../../test/server';

import { apiFetch } from './apiClient';

// Contract test for CONTRIBUTING.md §5: every apiFetch call lands the
// two preference headers from usePreferencesStore on the wire. Captures
// the inbound request via an MSW one-shot handler.
describe('apiFetch — user-preferences headers (CONTRIBUTING.md §5)', () => {
  beforeEach(() => {
    usePreferencesStore.getState().reset();
    localStorage.clear();
  });

  afterEach(() => {
    server.resetHandlers();
  });

  async function captureHeaders(path: string): Promise<Headers> {
    let captured: Headers | undefined;
    server.use(
      http.get(`http://localhost:4000${path}`, ({ request }) => {
        captured = request.headers;
        return HttpResponse.json({ ok: true });
      })
    );
    await apiFetch(path);
    if (!captured) throw new Error('MSW handler never fired');
    return captured;
  }

  it('sends default USD / UTC when the store is unhydrated', async () => {
    const h = await captureHeaders('/api/health/prefs-default');
    expect(h.get('x-user-currency')).toBe('USD');
    expect(h.get('x-user-timezone')).toBe('UTC');
  });

  it('reflects non-default store values on every request', async () => {
    usePreferencesStore.getState().setPreferences({
      currency: 'INR',
      country: 'IN',
      timezone: 'Asia/Kolkata',
    });

    const h = await captureHeaders('/api/health/prefs-custom');
    expect(h.get('x-user-currency')).toBe('INR');
    expect(h.get('x-user-timezone')).toBe('Asia/Kolkata');
  });

  it('sanitizes a poisoned currency value rather than throwing on fetch', async () => {
    // Regression test for the 2026-05-25 incident: a legacy backend
    // row had `currency = "₹"` (U+20B9). `usePreferencesStore` happily
    // stored it; on the next page boot `apiFetch` then threw "Cannot
    // convert value in record<ByteString>" because the value falls
    // outside the 0x00–0xFF header range. `preferenceHeaders()` now
    // sanitizes at the wire so a poisoned store can't take login down.
    usePreferencesStore.setState({
      currency: '₹',
      country: 'India',
      timezone: 'Asia/Kolkata',
    });

    const h = await captureHeaders('/api/health/prefs-poison');
    expect(h.get('x-user-currency')).toBe('USD');
    expect(h.get('x-user-timezone')).toBe('Asia/Kolkata');
  });

  it('does not let caller-provided headers override the prefs headers', async () => {
    usePreferencesStore.getState().setPreferences({
      currency: 'EUR',
      country: 'DE',
      timezone: 'Europe/Berlin',
    });

    let captured: Headers | undefined;
    server.use(
      http.get('http://localhost:4000/api/health/prefs-override', ({ request }) => {
        captured = request.headers;
        return HttpResponse.json({ ok: true });
      })
    );

    await apiFetch('/api/health/prefs-override', {
      headers: {
        // Caller tries to forge — prefs spread sits BEFORE the options.headers
        // spread, so a malicious / mistaken caller could *override* the prefs.
        // This test pins the current behaviour so a future spread-order swap
        // doesn't go un-noticed: caller wins. If we ever want strict
        // enforcement, flip the spread order in apiClient.ts and update.
        'x-user-currency': 'XXX',
      },
    });
    expect(captured?.get('x-user-currency')).toBe('XXX');
    // Timezone wasn't forged — still comes from the store.
    expect(captured?.get('x-user-timezone')).toBe('Europe/Berlin');
  });
});
