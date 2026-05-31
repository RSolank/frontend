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
// The `V` knob is the API version prefix. The backend currently serves at
// `/api`; when `T-api-v1-prefix` (backend Group D, Phase 3.1) ships, the
// flip to `/api/v1` is the single edit below — a follow-up commit on `main`,
// explicitly out of scope for this batch (see task-frontend.md Batch 10).
const V = '/api';

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
  },

  metadata: {
    constants: () => `${V}/metadata/constants`,
    countries: () => `${V}/metadata/countries`,
    currencies: () => `${V}/metadata/currencies`,
    timezones: () => `${V}/metadata/timezones`,
  },

  exports: {
    resource: (resource: string, format: 'csv' | 'json') =>
      `${V}/exports/${resource}?format=${format}`,
  },

  admin: {
    ping: () => `${V}/admin/ping`,
  },

  activity: {
    feed: () => `${V}/activity`,
    seen: () => `${V}/activity/seen`,
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
    uploadStatement: () => `${V}/transactions/upload-statement`,
    uploadStatementMapBeneficiaries: (id: number | string) =>
      `${V}/transactions/upload-statement/${id}/map-beneficiaries`,
    uploadStatementCategorize: (id: number | string) =>
      `${V}/transactions/upload-statement/${id}/categorize`,
    uploadStatementFinalize: (id: number | string) =>
      `${V}/transactions/upload-statement/${id}/finalize`,
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

  taxation: {
    // Trailing slash — FastAPI-significant (see budgets note above).
    rules: () => `${V}/taxation-rules/`,
    ruleByType: (txnType: string) =>
      `${V}/taxation-rules/${encodeURIComponent(txnType)}`,
    bills: () => `${V}/consumption-tax/bills`,
    billById: (billId: number | string) =>
      `${V}/consumption-tax/bills/${billId}`,
    billGenerate: () => `${V}/consumption-tax/bills/generate`,
    billPay: (billId: number | string) =>
      `${V}/consumption-tax/bills/${billId}/pay`,
    trackerCurrentWeek: () => `${V}/consumption-tax/tracker/current-week`,
  },
} as const;
