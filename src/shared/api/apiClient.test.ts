import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

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
