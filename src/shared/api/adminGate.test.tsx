import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';

import { server } from '../../test/server';

import { checkAdminGate } from './adminGate';

describe('checkAdminGate', () => {
  afterEach(() => {
    server.resetHandlers();
  });

  it('returns true when /admin/ping returns 200', async () => {
    server.use(
      http.get('http://localhost:4000/api/admin/ping', () =>
        HttpResponse.json({ status: 'ok', user_id: 1 })
      )
    );
    expect(await checkAdminGate()).toBe(true);
  });

  it('returns false when /admin/ping returns 403', async () => {
    server.use(
      http.get('http://localhost:4000/api/admin/ping', () =>
        HttpResponse.json({ detail: 'Insufficient privileges' }, { status: 403 })
      )
    );
    expect(await checkAdminGate()).toBe(false);
  });

  it('returns false when /admin/ping returns 401 (unauthenticated probe)', async () => {
    server.use(
      http.get('http://localhost:4000/api/admin/ping', () =>
        HttpResponse.json({ detail: 'Not authenticated' }, { status: 401 })
      )
    );
    expect(await checkAdminGate()).toBe(false);
  });

  it('returns false on network error (fails closed)', async () => {
    server.use(
      http.get(
        'http://localhost:4000/api/admin/ping',
        () => new HttpResponse(null, { status: 500 })
      )
    );
    expect(await checkAdminGate()).toBe(false);
  });
});
