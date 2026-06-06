import { http, HttpResponse } from 'msw';

import { API_BASE } from '../baseUrl';

// BE Phase 2.14 — `/api/v1/activity` feed (new shape: `items[]` not
// `events[]`), `/api/v1/activity/seen` (new shape:
// `{refs:[{kind,subject_type,subject_id}], hard:bool}` →
// `{affected:N}`), `/api/v1/activity/catalog`, `/api/v1/activity/
// signal-settings`. Defaults are an empty feed + minimal catalog +
// no disabled kinds — the friendly "nothing yet" path. Tests
// asserting populated state override via `server.use(...)`.
export const activityHandlers = [
  http.get(`${API_BASE}/activity`, () =>
    HttpResponse.json({ items: [], has_more: false })
  ),
  http.post(`${API_BASE}/activity/seen`, () =>
    HttpResponse.json({ affected: 0 })
  ),
  http.get(`${API_BASE}/activity/catalog`, () =>
    HttpResponse.json({
      entries: [
        {
          kind: 'bill_generated',
          event_class: 'notification',
          domain: 'tax',
          subject_type: 'bill',
          priority: 3,
          rank_order: 100,
          system_enabled: true,
          collapse_threshold: null,
          collapse_label: null,
        },
        {
          kind: 'budget_breached',
          event_class: 'alert',
          domain: 'budget',
          subject_type: 'budget',
          priority: 1,
          rank_order: 10,
          system_enabled: true,
          collapse_threshold: null,
          collapse_label: null,
        },
      ],
    })
  ),
  http.get(`${API_BASE}/activity/signal-settings`, () =>
    HttpResponse.json({ disabled: [] })
  ),
  http.put(`${API_BASE}/activity/signal-settings`, async ({ request }) => {
    const body = (await request.json()) as { kind: string; enabled: boolean };
    return HttpResponse.json({ disabled: body.enabled ? [] : [body.kind] });
  }),
];
