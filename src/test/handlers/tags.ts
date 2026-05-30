import { http, HttpResponse } from 'msw';

// Default handler for the tags feature. Returns an empty tree so tests
// that don't care about tag content stay green; tests that exercise
// tag-aware UI (e.g. Dashboard week-by-category, categorization rules)
// override via `server.use(...)`.
export const tagsHandlers = [
  http.get('http://localhost:4000/api/tags', () =>
    HttpResponse.json({ tags: [] })
  ),
];
