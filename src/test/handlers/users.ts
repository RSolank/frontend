import { http, HttpResponse } from 'msw';

// Users feature handlers. Covers /api/users/me (GET + PATCH) and
// /api/users/preferences (GET) — the surface the Batch 2 login flow and
// the Batch 3 Profile page both depend on. Tests override per-case via
// `server.use(...)` for assertions on request bodies.

export const usersHandlers = [
  http.get('http://localhost:4000/api/users/me', () =>
    HttpResponse.json({
      user: {
        user_id: 1,
        email_id: 'fixture@example.test',
        first_name: 'Fixture',
        last_name: 'User',
      },
    })
  ),
  http.patch('http://localhost:4000/api/users/me', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({ user: { user_id: 1, ...body } });
  }),
  http.get('http://localhost:4000/api/users/preferences', () =>
    HttpResponse.json({
      currency: 'INR',
      country: 'India',
      timezone: 'Asia/Kolkata',
    })
  ),
];
