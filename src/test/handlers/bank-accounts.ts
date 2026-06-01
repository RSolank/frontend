import { http, HttpResponse } from 'msw';

import { API_BASE } from '../baseUrl';

// BE Phase 1.1 (`1bc5454`) — bank accounts + identifier sub-resource.
//
// Defaults below return empty lists / minimal happy-path responses
// so tests for unrelated surfaces render through without per-test
// fixture wiring. Tests that exercise the CRUD lifecycle override
// via `server.use(...)` with bespoke handlers.
const STUB_ACCOUNT = {
  uid: 1,
  label: 'Stub account',
  account_type: 'REGULAR',
  is_committee_account: false,
  archived_at: null,
  identifiers: [],
  created_at: '2026-06-01T00:00:00Z',
};

export const bankAccountHandlers = [
  http.get(`${API_BASE}/bank-accounts/`, () =>
    HttpResponse.json([])
  ),
  http.post(`${API_BASE}/bank-accounts/`, async () =>
    HttpResponse.json(STUB_ACCOUNT, { status: 201 })
  ),
  http.get(
    `${API_BASE}/bank-accounts/:uid`,
    ({ params }) =>
      HttpResponse.json({ ...STUB_ACCOUNT, uid: Number(params.uid) })
  ),
  http.patch(
    `${API_BASE}/bank-accounts/:uid`,
    ({ params }) =>
      HttpResponse.json({ ...STUB_ACCOUNT, uid: Number(params.uid) })
  ),
  http.delete(
    `${API_BASE}/bank-accounts/:uid`,
    () => new HttpResponse(null, { status: 204 })
  ),
  http.post(
    `${API_BASE}/bank-accounts/:uid/identifiers`,
    async () =>
      HttpResponse.json(
        { uid: 1, identifier: 'stub@upi', identifier_type: 'UPI' },
        { status: 201 }
      )
  ),
  http.delete(
    `${API_BASE}/bank-accounts/:uid/identifiers/:identifierUid`,
    () => new HttpResponse(null, { status: 204 })
  ),
];
