import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { API_BASE } from '../../test/baseUrl';
import { server } from '../../test/server';
import { _resetDeviceIdCacheForTests } from '../utils/deviceId';

import { apiFetch, type ApiError } from './apiClient';

// Pinned contract tests for apiClient — Platform FE Batch 3.
//
// 1. Every request carries the `X-Device-Id` header (auth.devices).
// 2. A `Retry-After` header on 429 / 403 surfaces as
//    `err.retryAfterSeconds` on the thrown `ApiError` (auth.rate-limit
//    + auth.devices device-block). Any other status leaves it absent.
describe('apiFetch — X-Device-Id header', () => {
  beforeEach(() => {
    localStorage.clear();
    _resetDeviceIdCacheForTests();
  });

  afterEach(() => {
    server.resetHandlers();
  });

  it('sends X-Device-Id on every request, using the persisted pba.device_id', async () => {
    localStorage.setItem('pba.device_id', 'fixed-device-id-for-test');
    _resetDeviceIdCacheForTests();

    let captured: Headers | undefined;
    server.use(
      http.get(`${API_BASE}/health/device-id`, ({ request }) => {
        captured = request.headers;
        return HttpResponse.json({ ok: true });
      })
    );

    await apiFetch('/api/v1/health/device-id');
    expect(captured?.get('x-device-id')).toBe('fixed-device-id-for-test');
  });

  it('uses the same device id across two successive requests', async () => {
    let firstId: string | null = null;
    let secondId: string | null = null;
    server.use(
      http.get(`${API_BASE}/health/dev-1`, ({ request }) => {
        firstId = request.headers.get('x-device-id');
        return HttpResponse.json({ ok: true });
      }),
      http.get(`${API_BASE}/health/dev-2`, ({ request }) => {
        secondId = request.headers.get('x-device-id');
        return HttpResponse.json({ ok: true });
      })
    );

    await apiFetch('/api/v1/health/dev-1');
    await apiFetch('/api/v1/health/dev-2');
    expect(firstId).toBeTruthy();
    expect(firstId).toBe(secondId);
  });
});

describe('apiFetch — Retry-After surfaces as retryAfterSeconds', () => {
  beforeEach(() => {
    localStorage.clear();
    _resetDeviceIdCacheForTests();
  });

  afterEach(() => {
    server.resetHandlers();
  });

  it('attaches retryAfterSeconds to a 429 ApiError when Retry-After is a delta-seconds integer', async () => {
    server.use(
      http.post(`${API_BASE}/auth/login`, () =>
        HttpResponse.json(
          { detail: 'Too many attempts' },
          { status: 429, headers: { 'Retry-After': '90' } }
        )
      )
    );

    let thrown: ApiError | undefined;
    try {
      await apiFetch('/api/v1/auth/login', { method: 'POST' });
    } catch (err) {
      thrown = err as ApiError;
    }
    expect(thrown?.status).toBe(429);
    expect(thrown?.retryAfterSeconds).toBe(90);
  });

  it('attaches retryAfterSeconds to a 403 ApiError when Retry-After is set (device-block path)', async () => {
    server.use(
      http.post(`${API_BASE}/auth/login`, () =>
        HttpResponse.json(
          { detail: 'Device blocked' },
          { status: 403, headers: { 'Retry-After': '600' } }
        )
      )
    );

    let thrown: ApiError | undefined;
    try {
      await apiFetch('/api/v1/auth/login', { method: 'POST' });
    } catch (err) {
      thrown = err as ApiError;
    }
    expect(thrown?.status).toBe(403);
    expect(thrown?.retryAfterSeconds).toBe(600);
  });

  it('does NOT attach retryAfterSeconds on a 403 without a Retry-After header', async () => {
    server.use(
      http.post(`${API_BASE}/auth/login`, () =>
        HttpResponse.json({ detail: 'Forbidden' }, { status: 403 })
      )
    );

    let thrown: ApiError | undefined;
    try {
      await apiFetch('/api/v1/auth/login', { method: 'POST' });
    } catch (err) {
      thrown = err as ApiError;
    }
    expect(thrown?.status).toBe(403);
    expect(thrown?.retryAfterSeconds).toBeUndefined();
  });

  it('does NOT attach retryAfterSeconds on a 400 (only 429 + 403 carry it)', async () => {
    server.use(
      http.post(`${API_BASE}/auth/login`, () =>
        HttpResponse.json(
          { detail: 'Bad request' },
          { status: 400, headers: { 'Retry-After': '120' } }
        )
      )
    );

    let thrown: ApiError | undefined;
    try {
      await apiFetch('/api/v1/auth/login', { method: 'POST' });
    } catch (err) {
      thrown = err as ApiError;
    }
    expect(thrown?.status).toBe(400);
    expect(thrown?.retryAfterSeconds).toBeUndefined();
  });

  it('parses an HTTP-date Retry-After into seconds-from-now', async () => {
    const targetMs = Date.now() + 45_000;
    const httpDate = new Date(targetMs).toUTCString();
    server.use(
      http.post(`${API_BASE}/auth/login`, () =>
        HttpResponse.json(
          { detail: 'Too many attempts' },
          { status: 429, headers: { 'Retry-After': httpDate } }
        )
      )
    );

    let thrown: ApiError | undefined;
    try {
      await apiFetch('/api/v1/auth/login', { method: 'POST' });
    } catch (err) {
      thrown = err as ApiError;
    }
    expect(thrown?.status).toBe(429);
    // Allow a small skew for test execution time — value lands in
    // the 30-60s band that bracket 45s.
    expect(thrown?.retryAfterSeconds).toBeGreaterThanOrEqual(30);
    expect(thrown?.retryAfterSeconds).toBeLessThanOrEqual(60);
  });
});

// Single-flight token refresh (auth fix). After the access token expires a page
// fires many requests → many parallel 401s. Because the backend rotates the
// refresh token on every call, un-deduped refreshes race: the first rotates and
// the rest send a stale token → forced logout. These pin the latch that makes N
// concurrent 401s share ONE rotation, and the fire-once logout on failure.
describe('apiFetch — single-flight token refresh', () => {
  beforeEach(() => {
    localStorage.clear();
    _resetDeviceIdCacheForTests();
  });

  afterEach(() => {
    server.resetHandlers();
    vi.restoreAllMocks();
  });

  it('shares ONE /auth/refresh across concurrent 401s and retries both', async () => {
    localStorage.setItem('access_token', 'stale');
    localStorage.setItem('refresh_token', 'refresh-1');

    let refreshCount = 0;
    server.use(
      http.post(`${API_BASE}/auth/refresh`, async () => {
        refreshCount += 1;
        // A small delay guarantees the second 401 reaches the latch while the
        // first refresh is still in flight.
        await new Promise((r) => setTimeout(r, 20));
        return HttpResponse.json({
          access_token: 'fresh',
          refresh_token: 'refresh-2',
        });
      }),
      http.get(`${API_BASE}/widgets`, ({ request }) =>
        request.headers.get('authorization') === 'Bearer fresh'
          ? HttpResponse.json({ ok: true })
          : HttpResponse.json({ detail: 'expired' }, { status: 401 })
      )
    );

    const [a, b] = await Promise.all([
      apiFetch('/api/v1/widgets'),
      apiFetch('/api/v1/widgets'),
    ]);

    expect(refreshCount).toBe(1); // single-flight: one rotation, not two
    expect(a).toEqual({ ok: true });
    expect(b).toEqual({ ok: true });
    // Rotated exactly once — the stale token never leaks back.
    expect(localStorage.getItem('access_token')).toBe('fresh');
    expect(localStorage.getItem('refresh_token')).toBe('refresh-2');
  });

  it('starts a fresh /auth/refresh after the prior one settled', async () => {
    localStorage.setItem('access_token', 'stale');
    localStorage.setItem('refresh_token', 'refresh-1');

    let refreshCount = 0;
    server.use(
      http.post(`${API_BASE}/auth/refresh`, () => {
        refreshCount += 1;
        return HttpResponse.json({
          access_token: 'fresh',
          refresh_token: 'refresh-2',
        });
      }),
      http.get(`${API_BASE}/widgets`, ({ request }) =>
        request.headers.get('authorization') === 'Bearer fresh'
          ? HttpResponse.json({ ok: true })
          : HttpResponse.json({ detail: 'expired' }, { status: 401 })
      )
    );

    await apiFetch('/api/v1/widgets');
    // The latch cleared in `finally`; a later expiry refreshes anew rather than
    // reusing a stale resolved promise.
    localStorage.setItem('access_token', 'stale');
    await apiFetch('/api/v1/widgets');

    expect(refreshCount).toBe(2);
  });

  it('logs out exactly once when a shared refresh fails', async () => {
    localStorage.setItem('access_token', 'stale');
    localStorage.setItem('refresh_token', 'bad-refresh');

    const hrefSpy = vi.fn();
    const realLocation = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...realLocation,
        set href(v: string) {
          hrefSpy(v);
        },
      },
    });

    let refreshCount = 0;
    server.use(
      http.post(`${API_BASE}/auth/refresh`, async () => {
        refreshCount += 1;
        await new Promise((r) => setTimeout(r, 20));
        return HttpResponse.json({ detail: 'invalid' }, { status: 401 });
      }),
      http.get(`${API_BASE}/widgets`, () =>
        HttpResponse.json({ detail: 'expired' }, { status: 401 })
      )
    );

    try {
      const [a, b] = await Promise.all([
        apiFetch('/api/v1/widgets'),
        apiFetch('/api/v1/widgets'),
      ]);

      expect(refreshCount).toBe(1); // one shared refresh attempt
      expect(a).toBeUndefined();
      expect(b).toBeUndefined();
      expect(localStorage.getItem('access_token')).toBeNull();
      expect(localStorage.getItem('refresh_token')).toBeNull();
      // Fire-once: a single redirect, not one per concurrent caller.
      expect(hrefSpy).toHaveBeenCalledTimes(1);
      expect(hrefSpy).toHaveBeenCalledWith('/login');
    } finally {
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: realLocation,
      });
    }
  });
});
