import { http, HttpResponse } from 'msw';

import { API_BASE } from '../baseUrl';

// Default handler for the tags feature. Returns an empty tree so tests
// that don't care about tag content stay green; tests that exercise
// tag-aware UI (e.g. Dashboard week-by-category, categorization rules)
// override via `server.use(...)`.
export const tagsHandlers = [
  http.get(`${API_BASE}/tags`, () => HttpResponse.json({ tags: [] })),
];
