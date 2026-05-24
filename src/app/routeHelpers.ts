import { createElement, type ReactElement } from 'react';
import type { RouteObject } from 'react-router-dom';

import { ProtectedRoute } from '../shared/components/ProtectedRoute';

// Wrap a list of routes so each one's `element` is gated by
// <ProtectedRoute>. Feature batches (3–8) consume this when they
// compose their per-feature route arrays.
//
// Pass-through for routes that already have no `element` (pure layout
// routes) — wrapping a `lazy` route's element is a no-op since
// `element` is undefined; in that case wrap the lazily-loaded component
// at its file boundary instead.
export function protectedRoutes(routes: RouteObject[]): RouteObject[] {
  return routes.map((route) => {
    if (!route.element) return route;
    return {
      ...route,
      element: createElement(
        ProtectedRoute,
        null,
        route.element as ReactElement
      ),
    };
  });
}
