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
  // Stats endpoint is a Batch 9.1 backend ask — not yet implemented.
  // Default handler returns 404 so the <UserStatsCard /> Profile-page
  // placeholder renders its "Coming soon" empty state. Tests asserting
  // the populated card override this handler via `server.use(...)`.
  http.get('http://localhost:4000/api/users/me/stats', () =>
    HttpResponse.json({ detail: 'Not implemented' }, { status: 404 })
  ),
  // BE Phase 1.13 profile-image endpoints. 12 hand-picked Pillow
  // tiles are served from `/media/presets/<id>.webp`; we serve four
  // here — enough to exercise the picker grid without bloating MSW.
  http.get('http://localhost:4000/api/users/profile-image-presets', () =>
    HttpResponse.json({
      presets: [
        { id: 'geo-01', url: '/media/presets/geo-01.webp' },
        { id: 'geo-02', url: '/media/presets/geo-02.webp' },
        { id: 'geo-03', url: '/media/presets/geo-03.webp' },
        { id: 'geo-04', url: '/media/presets/geo-04.webp' },
      ],
    })
  ),
  http.put('http://localhost:4000/api/users/me/profile-image/preset', async ({ request }) => {
    const body = (await request.json()) as { preset_id: string };
    return HttpResponse.json({
      user: {
        user_id: 1,
        email_id: 'fixture@example.test',
        first_name: 'Fixture',
        last_name: 'User',
        profile_image_url: `/media/presets/${body.preset_id}.webp`,
      },
    });
  }),
  http.post('http://localhost:4000/api/users/me/profile-image', () =>
    HttpResponse.json({
      user: {
        user_id: 1,
        email_id: 'fixture@example.test',
        first_name: 'Fixture',
        last_name: 'User',
        profile_image_url: '/media/profile-images/1/abc123.webp',
      },
    })
  ),
  http.delete('http://localhost:4000/api/users/me/profile-image', () =>
    new HttpResponse(null, { status: 204 })
  ),
  // BE Phase 2.1 — two-phase soft delete. Default accepts any
  // password and returns the scheduled-deletion envelope. Tests
  // override to exercise 403 wrong-password and the cancel paths.
  http.post('http://localhost:4000/api/users/me/delete', () =>
    HttpResponse.json({ detail: 'Account scheduled for deletion.', grace_days: 14 })
  ),
  http.post('http://localhost:4000/api/users/me/delete/cancel', () =>
    HttpResponse.json({ detail: 'Account reactivated.' })
  ),
];
