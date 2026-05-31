import { http, HttpResponse } from 'msw';

// BE Phase 2.4 — `/api/activity` feed + `/api/activity/seen` write-back.
// Default to an empty feed (the friendly "nothing yet" empty state).
// Tests that exercise populated lists override with `server.use(...)`.
export const activityHandlers = [
  http.get('http://localhost:4000/api/activity', () =>
    HttpResponse.json({ events: [], returned_count: 0, has_more: false })
  ),
  http.post('http://localhost:4000/api/activity/seen', () =>
    HttpResponse.json({ updated: 0 })
  ),
];
