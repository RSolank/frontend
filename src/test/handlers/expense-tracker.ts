import { http, HttpResponse } from 'msw';

import { API_BASE } from '../baseUrl';

// BE Phase 1.7 — `GET /api/expense-tracker?period_type=…&n=…&tag_id=…`.
// Default to an empty trend (most ExpenseTrackerPage tests don't care
// about the chart; the budgets-trend specific test overrides via
// `server.use(...)`).
export const expenseTrackerHandlers = [
  http.get(`${API_BASE}/expense-tracker/`, ({ request }) => {
    const url = new URL(request.url);
    const period_type =
      url.searchParams.get('period_type') ?? 'monthly';
    return HttpResponse.json({
      period_type,
      returned_count: 0,
      rows: [],
    });
  }),
];
