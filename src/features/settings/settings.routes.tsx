import { lazy } from 'react';
import { Navigate, type RouteObject } from 'react-router-dom';

import { SettingsLayout } from './components/SettingsLayout';

// Pages live in their owning feature module (tags / categorization /
// taxation). The settings shell just composes them under a single
// /settings/* URL space with shared sidebar + breadcrumb chrome.
const TagsPage = lazy(() =>
  import('../tags/pages/TagsPage').then((m) => ({ default: m.TagsPage }))
);

const CategorizationRulesPage = lazy(() =>
  import('../categorization/pages/CategorizationRulesPage').then((m) => ({
    default: m.CategorizationRulesPage,
  }))
);

const TaxationRulesPage = lazy(() =>
  import('../taxation/pages/TaxationRulesPage').then((m) => ({
    default: m.TaxationRulesPage,
  }))
);

const BankAccountsPage = lazy(() =>
  import('../bankAccounts/pages/BankAccountsPage').then((m) => ({
    default: m.BankAccountsPage,
  }))
);

// Beneficiaries re-homed under /settings (T-nav-ia-reorg): it left the
// MAIN nav row and now lives in the Settings shell as the first sidebar
// entry. Its page still lives in `features/beneficiaries/` — only the
// URL + nav entry points moved (clean replacement, no /beneficiaries
// redirect; in-app deep-links rewritten to /settings/beneficiaries).
const BeneficiariesPage = lazy(() =>
  import('../beneficiaries/pages/BeneficiariesPage').then((m) => ({
    default: m.BeneficiariesPage,
  }))
);

// Recurring re-homed under /settings (T-nav-ia-reorg): it left the MAIN
// nav row and joins the Settings sidebar (second, after Beneficiaries).
// The page is template-management first (Detected / Confirmed tabs); its
// Upcoming-bills forecast also surfaces in the bell via recurring-domain
// activity signals. Page stays in `features/recurring/`; only the URL +
// nav entry points moved (clean replacement, no /recurring redirect).
const RecurringPage = lazy(() =>
  import('../recurring/pages/RecurringPage').then((m) => ({
    default: m.RecurringPage,
  }))
);

// Wrapped in <ProtectedRoute> by app/routes.tsx via protectedRoutes().
// Children inherit protection through the parent's gated <Outlet />.
//
// No legacy /categories or /categorization-rules redirects: those URLs
// were only ever interim (Batches 4 and 6) and no in-app surface links
// to them — the TopNav SETTINGS dropdown + mobile drawer + the husk
// SettingsPage all migrated to /settings/* in this batch, and a
// repo-wide grep finds zero references to the old paths. Any external
// bookmark falls through to the `*` catch-all (→ `/` or `/login` via
// `<ProtectedRoute>`); that's the same UX the app gives for every
// other unknown URL.
export const settingsRoutes: RouteObject[] = [
  {
    path: '/settings',
    element: <SettingsLayout />,
    children: [
      {
        index: true,
        element: <Navigate to="/settings/beneficiaries" replace />,
      },
      { path: 'beneficiaries', element: <BeneficiariesPage /> },
      { path: 'recurring', element: <RecurringPage /> },
      { path: 'categories', element: <TagsPage /> },
      { path: 'categorization-rules', element: <CategorizationRulesPage /> },
      { path: 'taxation-rules', element: <TaxationRulesPage /> },
      { path: 'bank-accounts', element: <BankAccountsPage /> },
    ],
  },
];
