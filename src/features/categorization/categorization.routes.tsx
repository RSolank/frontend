import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';

// Lazy-load the page so the /api/categorization-rules cache and
// rule-form chip rendering only ship when a user opens the Rules
// screen. Mirrors features/tags/tags.routes.tsx.
const CategorizationRulesPage = lazy(() =>
  import('./pages/CategorizationRulesPage').then((m) => ({
    default: m.CategorizationRulesPage,
  }))
);

// Wrapped in <ProtectedRoute> by app/routes.tsx via protectedRoutes(...).
export const categorizationRoutes: RouteObject[] = [
  { path: '/categorization-rules', element: <CategorizationRulesPage /> },
];
