import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';

// Lazy-load the page so /api/tags + /api/metadata/constants payloads
// (and the page's own tree) only ship when a user opens the Settings
// gear. Mirrors features/users/users.routes.tsx.
const TagsPage = lazy(() =>
  import('./pages/TagsPage').then((m) => ({ default: m.TagsPage }))
);

// The /categories path is what the header Settings gear navigates to
// (see src/app/App.tsx). Wrapped in <ProtectedRoute> by
// app/routes.tsx via protectedRoutes(...).
export const tagsRoutes: RouteObject[] = [
  { path: '/categories', element: <TagsPage /> },
];
