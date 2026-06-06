// Central API route registry — the single source of truth for every
// backend URL path the frontend hits. Feature `queries.ts` / `mutations.ts`
// import the relevant builder instead of inlining `/api/...` strings, so a
// route rename is a one-line edit here rather than a cross-feature grep.
//
// Scope (locked Batch 10): URL builders ONLY. TanStack query keys stay in
// each feature's `api/keys.ts` — centralizing them here would couple the
// features to a shared file and break the feature-isolation architecture
// the refactor established.
//
// The `V` knob is the API version prefix. BE Phase 2.11
// (T-api-v1-prefix) shipped the `/api/v1/*` parent prefix in
// 2026-06-02; the old `/api/*` is NOT aliased so this const is the
// only runtime surface that needs to change. The matching test-side
// flip lives in `src/test/baseUrl.ts` (`API_BASE`). A future v2 is
// the same one-line change.
const V = '/api/v1';

// Path-param helpers interpolate ids directly (numeric ids and opaque uids
// need no encoding — matches the pre-Batch-10 call sites). String path
// params that could contain reserved characters (e.g. the taxation rule
// `txn_type`) are run through encodeURIComponent, preserving prior behaviour.
// Query strings are NOT built here: they stay at the call site where the
// feature-specific param serialization (URLSearchParams, budget_period
// encoding, …) already lives.

export const routes = {
  auth: {
    login: () => `${V}/auth/login`,
    register: () => `${V}/auth/register`,
    logout: () => `${V}/auth/logout`,
    refresh: () => `${V}/auth/refresh`,
    recoveryQuestion: () => `${V}/auth/recovery-question`,
    forgotPassword: () => `${V}/auth/forgot-password`,
    verifyOtp: () => `${V}/auth/verify-otp`,
    verifyAnswer: () => `${V}/auth/verify-answer`,
    resetPasswordFinal: () => `${V}/auth/reset-password-final`,
    changePassword: () => `${V}/auth/change-password`,
    // `/api/auth/recovery` — list (GET) + upsert (POST) recovery Q&A.
    recovery: () => `${V}/auth/recovery`,
    sessions: () => `${V}/auth/sessions`,
    sessionById: (sessionId: number | string) =>
      `${V}/auth/sessions/${sessionId}`,
    changeEmailRequest: () => `${V}/auth/change-email-request`,
    changeEmailConfirm: () => `${V}/auth/change-email-confirm`,
    // BE Phase 2.7 — TOTP 2FA.
    twoFactorEnroll: () => `${V}/auth/2fa/enroll`,
    twoFactorVerifyEnroll: () => `${V}/auth/2fa/verify-enroll`,
    twoFactorDisable: () => `${V}/auth/2fa/disable`,
    twoFactorLoginVerify: () => `${V}/auth/2fa/login-verify`,
    // BE Phase 2.3 — new-device OTP challenge + trusted-devices.
    newDeviceVerify: () => `${V}/auth/new-device/verify`,
    newDeviceResend: () => `${V}/auth/new-device/resend`,
    newDeviceRevoke: () => `${V}/auth/new-device/revoke`,
    devices: () => `${V}/auth/devices`,
    deviceById: (uid: number | string) => `${V}/auth/devices/${uid}`,
    security: () => `${V}/auth/security`,
  },

  users: {
    me: () => `${V}/users/me`,
    meStats: () => `${V}/users/me/stats`,
    preferences: () => `${V}/users/preferences`,
    profileImagePresets: () => `${V}/users/profile-image-presets`,
    profileImage: () => `${V}/users/me/profile-image`,
    profileImagePreset: () => `${V}/users/me/profile-image/preset`,
    delete: () => `${V}/users/me/delete`,
    deleteCancel: () => `${V}/users/me/delete/cancel`,
    dataReset: () => `${V}/users/me/data-reset`,
  },

  metadata: {
    constants: () => `${V}/metadata/constants`,
    countries: () => `${V}/metadata/countries`,
    currencies: () => `${V}/metadata/currencies`,
    timezones: () => `${V}/metadata/timezones`,
    // BE Phase 2.11 — product brand identity (name / tagline /
    // description / logo_url). Public route, served unauthenticated.
    branding: () => `${V}/metadata/branding`,
  },

  exports: {
    resource: (resource: string, format: 'csv' | 'json') =>
      `${V}/exports/${resource}?format=${format}`,
  },

  admin: {
    ping: () => `${V}/admin/ping`,
    // BE T-admin A2 (`2f21ff7`) — paginated, searchable user inventory.
    // All query params are optional; the server clamps `limit` silently
    // to [1, 100], so the FE may send any value.
    users: (params?: {
      q?: string;
      limit?: number;
      cursor?: string;
      include_deleted?: boolean;
    }) => {
      const sp = new URLSearchParams();
      if (params?.q) sp.set('q', params.q);
      if (params?.limit !== undefined) sp.set('limit', String(params.limit));
      if (params?.cursor) sp.set('cursor', params.cursor);
      if (params?.include_deleted) sp.set('include_deleted', 'true');
      const qs = sp.toString();
      return qs ? `${V}/admin/users?${qs}` : `${V}/admin/users`;
    },
    // BE T-admin A3 (`4b6004e`) — single-user detail (identity + locale,
    // recent sessions/devices/activity, /me/stats, cemetery_status).
    // 404 for non-existent / SYSTEM / hard-purged; 200 with
    // cemetery_status populated for soft-deleted users in the grace
    // window.
    userDetail: (userId: number) => `${V}/admin/users/${userId}`,
    // BE T-admin B1 (`a13669e`) — admin lock/unlock (recovery-proof
    // disable via UserAuth.disabled_at; distinct from the OTP-
    // recoverable locked_until). 404 for missing/SYSTEM; 409 if the
    // account is already in the target state.
    userLock: (userId: number) => `${V}/admin/users/${userId}/lock`,
    userUnlock: (userId: number) => `${V}/admin/users/${userId}/unlock`,
    // BE T-admin B2 — force-logout: locks every active session,
    // idempotent (0 when no active sessions); does NOT lock the
    // account itself (pair with /lock for a full eject).
    userSessions: (userId: number) => `${V}/admin/users/${userId}/sessions`,
    // BE T-admin E1 (Phase 2.16) — admin operator layer over the
    // activity per-user signal-settings + the system catalog.
    // GET/PUT user-signal-settings = toggle a kind for a target
    // user; PUT signal-catalog/{kind} = system-wide tunables
    // (priority / rank_order / system_enabled).
    userSignalSettings: (userId: number) =>
      `${V}/admin/users/${userId}/signal-settings`,
    signalCatalogKind: (kind: string) =>
      `${V}/admin/signal-catalog/${encodeURIComponent(kind)}`,
    // BE T-admin C1 (`d76f6a5`) — cemetery audit. Paginated list +
    // detail with a truncated replica peek.
    cemetery: (params?: {
      q?: string;
      from?: string;
      to?: string;
      limit?: number;
      cursor?: string;
    }) => {
      const sp = new URLSearchParams();
      if (params?.q) sp.set('q', params.q);
      if (params?.from) sp.set('from', params.from);
      if (params?.to) sp.set('to', params.to);
      if (params?.limit !== undefined) sp.set('limit', String(params.limit));
      if (params?.cursor) sp.set('cursor', params.cursor);
      const qs = sp.toString();
      return qs ? `${V}/admin/cemetery?${qs}` : `${V}/admin/cemetery`;
    },
    cemeteryDetail: (deletedUserId: number) =>
      `${V}/admin/cemetery/${deletedUserId}`,
  },

  activity: {
    feed: () => `${V}/activity`,
    seen: () => `${V}/activity/seen`,
    // BE Phase 2.14 — registry-backed kind catalog. Used by the FE
    // bell/modal (to label items + split alerts vs notifications by
    // event_class) and by the Notifications-settings surface.
    catalog: () => `${V}/activity/catalog`,
    // BE Phase 2.14 (persist fix shipped in 2.16) — the user toggles
    // which kinds they want to receive. GET returns
    // `{disabled: string[]}`; PUT body `{kind, enabled}` returns the
    // updated `{disabled}` list.
    signalSettings: () => `${V}/activity/signal-settings`,
  },

  beneficiaries: {
    list: () => `${V}/beneficiaries`,
    create: () => `${V}/beneficiaries`,
    byId: (id: number | string) => `${V}/beneficiaries/${id}`,
    relationships: () => `${V}/beneficiaries/relationships`,
    merge: () => `${V}/beneficiaries/merge`,
    checkAlias: () => `${V}/beneficiaries/check-alias`,
  },

  // Top-level resource shared by the beneficiaries + categorization
  // features (rule rows hang off beneficiaries but are their own table).
  categorizationRules: {
    list: () => `${V}/categorization-rules`,
    create: () => `${V}/categorization-rules`,
    byId: (id: number | string) => `${V}/categorization-rules/${id}`,
    reRun: () => `${V}/categorization-rules/re-run`,
  },

  tags: {
    list: () => `${V}/tags`,
    create: () => `${V}/tags`,
    byId: (id: number | string) => `${V}/tags/${id}`,
  },

  transactions: {
    list: () => `${V}/transactions`,
    create: () => `${V}/transactions`,
    byId: (id: number | string) => `${V}/transactions/${id}`,
    manualTags: (id: number | string) => `${V}/transactions/${id}/manual-tags`,
  },

  // BE Phase 2.2 — async statement-upload pipeline. The legacy
  // 4-step synchronous flow (`/upload-statement` +
  // `/map-beneficiaries` + `/categorize` + `/finalize`) was retired
  // BE-side; the FE now POSTs to `/statement-uploads` and polls
  // `/statement-uploads/{job_id}` for status. Parser auto-detection,
  // bank-account auto-attribution, and categorization-via-MISC
  // default all run inside the background job.
  statementUploads: {
    root: () => `${V}/statement-uploads`,
    byId: (jobId: number | string) => `${V}/statement-uploads/${jobId}`,
    // BE-side handoff: when BE ships GET `/api/statement-uploads/parsers`
    // it returns the parser catalog as `[{key, label, source_type}, ...]`
    // (same shape as the 422 envelope's `available_parsers`). FE
    // queries it on file selection to populate the parser picker;
    // gracefully falls back to a hardcoded local catalog on 404.
    parsers: () => `${V}/statement-uploads/parsers`,
  },

  // Trailing slash on the collection root is FastAPI-significant — the
  // backend route is declared with it and a slashless request 307-redirects,
  // dropping the request body on some clients. Preserve it exactly.
  budgets: {
    root: () => `${V}/budget-limits/`,
    status: () => `${V}/budget-limits/status`,
    byTag: (tagId: number | string) => `${V}/budget-limits/${tagId}`,
  },

  expenseTracker: {
    trend: () => `${V}/expense-tracker/`,
  },

  // BE Phase 1.1 — bank accounts + identifier sub-resource. Optional
  // per Decision 27; the taxation engine works fine with zero
  // accounts. One account per user can be flagged
  // `is_committee_account=true` (single-committee invariant
  // enforced BE-side — PATCHing one auto-demotes the prior). Account
  // identifiers (UPI handles today) match against incoming
  // statement-upload txns for auto-attribution.
  //
  // FastAPI route registration uses a trailing slash on the
  // collection root, mirroring `budgets.root` / `taxation.rules` —
  // a slashless request 307-redirects and drops the request body on
  // some clients.
  bankAccounts: {
    root: () => `${V}/bank-accounts/`,
    byId: (uid: number | string) => `${V}/bank-accounts/${uid}`,
    identifiers: (uid: number | string) =>
      `${V}/bank-accounts/${uid}/identifiers`,
    identifierById: (uid: number | string, identifierUid: number | string) =>
      `${V}/bank-accounts/${uid}/identifiers/${identifierUid}`,
  },

  // BE Phase 1.5 — recurring-transaction inference engine. The worker
  // (via the APScheduler ladder) detects patterns from history and
  // forecasts upcoming materializations into `recurring_bills`; the FE
  // surfaces detected templates for the user to Confirm / Edit /
  // Dismiss, exposes user-authored CRUD, and renders forecast +
  // settled bill rows from the read endpoints.
  recurring: {
    templates: () => `${V}/recurring/templates`,
    templateById: (uid: number | string) => `${V}/recurring/templates/${uid}`,
    upcoming: () => `${V}/recurring/upcoming`,
    history: () => `${V}/recurring/history`,
  },

  taxation: {
    // Trailing slash — FastAPI-significant (see budgets note above).
    rules: () => `${V}/taxation-rules/`,
    ruleByType: (txnType: string) =>
      `${V}/taxation-rules/${encodeURIComponent(txnType)}`,
    bills: () => `${V}/consumption-tax/bills`,
    billById: (billId: number | string) =>
      `${V}/consumption-tax/bills/${billId}`,
    billGenerate: () => `${V}/consumption-tax/bills/generate`,
    // BE Phase 2.6 (T-taxation `e7c05aa`) — admin/ops backfill on
    // behalf of any user, bypassing the auto-mode guard. T-admin D1
    // wraps this in a UI at `/admin/ops/bill-backfill`.
    adminBillGenerate: () => `${V}/consumption-tax/admin/bills/generate`,
    // BE Phase 2.6 — `mark-paid` + `mark-unpaid` replace the removed
    // `pay` endpoint (Decision 25 — user-attestation, never creates a
    // transaction). The engine reconciles existing txn data.
    billMarkPaid: (billId: number | string) =>
      `${V}/consumption-tax/bills/${billId}/mark-paid`,
    billMarkUnpaid: (billId: number | string) =>
      `${V}/consumption-tax/bills/${billId}/mark-unpaid`,
    // `tracker/current-week` was never shipped on the BE; FE
    // derives the in-progress week from the ACCRUING bill via
    // `useTrackerCurrentWeekQuery` in
    // `features/taxation/api/queries.ts`. Route intentionally
    // removed 2026-06-06.
  },
} as const;
