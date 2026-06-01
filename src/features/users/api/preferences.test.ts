import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';

import { useDateFormatStore } from '../../../shared/state/dateFormat.store';
import { useDefaultTxnKindStore } from '../../../shared/state/defaultTxnKind.store';
import { useFocusRingStore } from '../../../shared/state/focusRing.store';
import { useLandingRouteStore } from '../../../shared/state/landingRoute.store';
import { useLinkUnderlineStore } from '../../../shared/state/linkUnderline.store';
import { useNumberFormatStore } from '../../../shared/state/numberFormat.store';
import { usePreferencesStore } from '../../../shared/state/preferences.store';
import { API_BASE } from '../../../test/baseUrl';
import { server } from '../../../test/server';

import { hydratePreferences } from './preferences';

// Reset every preference store to its default + clear localStorage so
// each test starts on a clean slate. A catch-all PATCH handler is
// registered alongside so the subscribers' fire-and-forget writes
// triggered by the reset itself don't surface as unhandled-request
// errors when the store transitions from a prior test's non-default.
function resetAllStores() {
  server.use(
    http.patch(`${API_BASE}/users/preferences`, () =>
      HttpResponse.json({})
    )
  );
  usePreferencesStore.getState().reset();
  useDateFormatStore.getState().setFormat('system');
  useNumberFormatStore.getState().setFormat('system');
  useLandingRouteStore.getState().setRoute('/dashboard');
  useDefaultTxnKindStore.getState().setKind('debit');
  useLinkUnderlineStore.getState().setUnderline(false);
  useFocusRingStore.getState().setAlwaysVisible(false);
  localStorage.clear();
}

describe('hydratePreferences — expanded for all 8 server fields', () => {
  beforeEach(() => {
    resetAllStores();
    localStorage.setItem('access_token', 'test-token');
  });

  it('writes every recognized field from /api/users/preferences into its store', async () => {
    server.use(
      http.get(`${API_BASE}/users/preferences`, () =>
        HttpResponse.json({
          currency: 'EUR',
          timezone: 'Europe/Berlin',
          date_format: 'dmonth',
          number_format: 'dot-comma',
          landing_route: '/transactions',
          default_txn_kind: 'credit',
          underline_links: true,
          focus_ring_always: true,
        })
      )
    );

    await hydratePreferences();

    expect(usePreferencesStore.getState().currency).toBe('EUR');
    expect(usePreferencesStore.getState().timezone).toBe('Europe/Berlin');
    expect(useDateFormatStore.getState().format).toBe('dmonth');
    expect(useNumberFormatStore.getState().format).toBe('dot-comma');
    expect(useLandingRouteStore.getState().route).toBe('/transactions');
    expect(useDefaultTxnKindStore.getState().kind).toBe('credit');
    expect(useLinkUnderlineStore.getState().underline).toBe(true);
    expect(useFocusRingStore.getState().alwaysVisible).toBe(true);
  });

  it('ignores invalid enum values rather than poisoning the typed stores', async () => {
    server.use(
      http.get(`${API_BASE}/users/preferences`, () =>
        HttpResponse.json({
          // An older client could persist an unknown enum value; the
          // hydrate guard MUST drop it and keep the store's default.
          date_format: 'gibberish-mode',
          number_format: 42, // wrong type entirely
          landing_route: '/unknown',
          default_txn_kind: 'maybe',
        })
      )
    );

    await hydratePreferences();

    expect(useDateFormatStore.getState().format).toBe('system');
    expect(useNumberFormatStore.getState().format).toBe('system');
    expect(useLandingRouteStore.getState().route).toBe('/dashboard');
    expect(useDefaultTxnKindStore.getState().kind).toBe('debit');
  });

  it('leaves stores untouched on a hydrate failure', async () => {
    server.use(
      http.get(
        `${API_BASE}/users/preferences`,
        () => new HttpResponse(null, { status: 500 })
      )
    );

    // Pre-set the stores so we can verify they are NOT clobbered by the
    // failure path.
    useDateFormatStore.getState().setFormat('dmy');
    useLandingRouteStore.getState().setRoute('/budgets');

    await hydratePreferences();

    expect(useDateFormatStore.getState().format).toBe('dmy');
    expect(useLandingRouteStore.getState().route).toBe('/budgets');
  });

  it('does NOT fire a PATCH back at the server during hydrate', async () => {
    let patchCount = 0;
    server.use(
      http.get(`${API_BASE}/users/preferences`, () =>
        HttpResponse.json({
          date_format: 'mdy',
          landing_route: '/consumption-tax',
          underline_links: true,
        })
      ),
      http.patch(`${API_BASE}/users/preferences`, () => {
        patchCount += 1;
        return HttpResponse.json({});
      })
    );

    await hydratePreferences();
    // Give any stray scheduled microtask a chance to flush.
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(patchCount).toBe(0);
  });
});

describe('subscribeToPreferenceStores — auto-PATCH on user-driven setX', () => {
  beforeEach(() => {
    resetAllStores();
    localStorage.setItem('access_token', 'test-token');
  });

  it('fires PATCH /api/users/preferences with the correct slice when each store changes', async () => {
    const captured: Array<Record<string, unknown>> = [];
    server.use(
      http.patch(
        `${API_BASE}/users/preferences`,
        async ({ request }) => {
          captured.push((await request.json()) as Record<string, unknown>);
          return HttpResponse.json({});
        }
      )
    );

    useDateFormatStore.getState().setFormat('ymd');
    useNumberFormatStore.getState().setFormat('indian');
    useLandingRouteStore.getState().setRoute('/budgets');
    useDefaultTxnKindStore.getState().setKind('credit');
    useLinkUnderlineStore.getState().setUnderline(true);
    useFocusRingStore.getState().setAlwaysVisible(true);

    // Allow fire-and-forget PATCHes (kicked off as microtasks) to flush.
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(captured).toContainEqual({ date_format: 'ymd' });
    expect(captured).toContainEqual({ number_format: 'indian' });
    expect(captured).toContainEqual({ landing_route: '/budgets' });
    expect(captured).toContainEqual({ default_txn_kind: 'credit' });
    expect(captured).toContainEqual({ underline_links: true });
    expect(captured).toContainEqual({ focus_ring_always: true });
  });

  it('does NOT fire a PATCH when a setX call lands the same value', async () => {
    let patchCount = 0;
    server.use(
      http.patch(`${API_BASE}/users/preferences`, () => {
        patchCount += 1;
        return HttpResponse.json({});
      })
    );

    // Already at default 'system' — setting it again should noop.
    useDateFormatStore.getState().setFormat('system');
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(patchCount).toBe(0);
  });
});
