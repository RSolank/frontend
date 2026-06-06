import { http, HttpResponse } from 'msw';

import { API_BASE } from '../baseUrl';

// BE Phase 1.11 — `GET /api/v1/admin/ping` returns 200 for the ADMIN
// role and 403 otherwise. Default to 403 (the common "regular user"
// path); the AdminLandingPage test + the TopNav admin-link test
// override with 200 via `server.use(...)`.
//
// Note: with T-admin A1 the FE gate no longer probes /admin/ping —
// the endpoint stays as a BE liveness probe and these handlers stay
// for backward-compatibility with any test that still mocks them.
//
// BE T-admin A2 — `GET /api/v1/admin/users` defaults to an empty
// page so tests that don't care about the inventory don't have to
// thread MSW overrides. Tests asserting populated rows / pagination
// override via `server.use(...)`.
export const adminHandlers = [
  http.get(`${API_BASE}/admin/ping`, () =>
    HttpResponse.json({ detail: 'Insufficient privileges' }, { status: 403 })
  ),
  http.get(`${API_BASE}/admin/users`, () =>
    HttpResponse.json({
      users: [],
      next_cursor: null,
      has_more: false,
    })
  ),
  // BE T-admin A3 — single-user detail. Default is 404 (no fixture
  // user matches); tests asserting the detail page override with a
  // populated payload via `server.use(...)`.
  http.get(`${API_BASE}/admin/users/:userId`, () =>
    HttpResponse.json({ detail: 'User not found' }, { status: 404 })
  ),
  // BE T-admin B1/B2 — admin write-side. Defaults assume success
  // (most tests don't exercise these); failure-path tests override.
  http.patch(`${API_BASE}/admin/users/:userId/lock`, ({ params }) =>
    HttpResponse.json({
      user_id: Number(params.userId),
      disabled_at: '2026-06-03T20:00:00Z',
    })
  ),
  http.patch(`${API_BASE}/admin/users/:userId/unlock`, ({ params }) =>
    HttpResponse.json({
      user_id: Number(params.userId),
      disabled_at: null,
    })
  ),
  http.delete(`${API_BASE}/admin/users/:userId/sessions`, () =>
    HttpResponse.json({ terminated: 0 })
  ),
  // BE T-admin C1 — cemetery. List defaults empty; detail defaults 404.
  http.get(`${API_BASE}/admin/cemetery`, () =>
    HttpResponse.json({
      deleted_users: [],
      next_cursor: null,
      has_more: false,
    })
  ),
  http.get(`${API_BASE}/admin/cemetery/:deletedUserId`, () =>
    HttpResponse.json(
      { detail: 'Deleted-user record not found' },
      { status: 404 }
    )
  ),
  // BE T-admin E1 — operator signal-settings + system catalog tune.
  http.get(`${API_BASE}/admin/users/:userId/signal-settings`, () =>
    HttpResponse.json({ disabled: [] })
  ),
  http.put(
    `${API_BASE}/admin/users/:userId/signal-settings`,
    async ({ request }) => {
      const body = (await request.json()) as { kind: string; enabled: boolean };
      return HttpResponse.json({
        disabled: body.enabled ? [] : [body.kind],
      });
    }
  ),
  http.put(
    `${API_BASE}/admin/signal-catalog/:kind`,
    async ({ params, request }) => {
      const patch = (await request.json()) as {
        priority?: number;
        rank_order?: number;
        system_enabled?: boolean;
      };
      return HttpResponse.json({
        kind: params.kind,
        event_class: 'notification',
        domain: 'tax',
        subject_type: 'bill',
        priority: patch.priority ?? 3,
        rank_order: patch.rank_order ?? 100,
        system_enabled: patch.system_enabled ?? true,
        collapse_threshold: null,
        collapse_label: null,
      });
    }
  ),
];
