import { http, HttpResponse } from 'msw';

// BE Phase 1.7 — `GET /api/expense-tracker?period_type=…&n=…&tag_id=…`.
// Default to an empty trend (most ExpenseTrackerPage tests don't care
// about the chart; the budgets-trend specific test overrides via
// `server.use(...)`).
export const expenseTrackerHandlers = [
  http.get('http://localhost:4000/api/expense-tracker/', ({ request }) => {
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
