import { http, HttpResponse } from 'msw';

// Placeholder for the full users-feature handler set (Batch 3). For now
// just exposes `/api/users/me` and `/api/users/preferences` so the Batch 2
// login flow (refreshAuthUser + hydratePreferences) has predictable
// responses in tests.

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
  http.get('http://localhost:4000/api/users/preferences', () =>
    HttpResponse.json({
      currency: 'INR',
      country: 'India',
      timezone: 'Asia/Kolkata',
    })
  ),
];
