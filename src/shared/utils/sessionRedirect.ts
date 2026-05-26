// Single source of truth for "where should we send this visitor?"
//
// Contract (Batch 6.5 user requirement, 2026-05-26):
//   - Has any access_token OR refresh_token → /login
//     ("session expired" path: token present but server rejected it).
//   - Otherwise → /  (true first visit / post-logout / no creds).
//
// Active-session redirects (→ /dashboard) live on the auth flow itself
// (LoginPage.tsx, HomePage.tsx), where `user` is in scope.
export function unauthenticatedRedirect(): '/login' | '/' {
  if (typeof localStorage === 'undefined') return '/';
  const hasToken =
    !!localStorage.getItem('access_token') ||
    !!localStorage.getItem('refresh_token');
  return hasToken ? '/login' : '/';
}
