import { Link, useNavigate, useRouteError } from 'react-router-dom';

// Branded 404 surface for any unmatched URL. Rendered as the router's
// catch-all `*` element (see app/routes.tsx) so it inherits the App shell's
// TopNav chrome and the user is never dropped onto the browser's default
// error page or silently bounced to the dashboard with no explanation.
//
// Doubles as the router `errorElement`: when a lazy route chunk fails to load
// or a loader throws, React Router renders this instead of a blank screen.
export function NotFoundPage() {
  const navigate = useNavigate();
  // Present when mounted as an errorElement; null on a plain unmatched route.
  const error = useRouteError() as unknown;
  const isError = error != null;

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <p className="text-accent-600 dark:text-accent-400 text-sm font-semibold tracking-wide uppercase">
        {isError ? 'Something went wrong' : 'Error 404'}
      </p>
      <h1 className="mt-3 text-3xl font-bold text-slate-900 sm:text-4xl dark:text-slate-100">
        {isError ? "This page didn't load" : 'Page not found'}
      </h1>
      <p className="mt-3 max-w-md text-sm text-slate-600 dark:text-slate-400">
        {isError
          ? 'We hit a snag rendering this page. Try again, or head back to your dashboard.'
          : "The page you're looking for doesn't exist or may have moved."}
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          to="/"
          className="bg-accent-600 hover:bg-accent-700 focus-visible:ring-accent-500 dark:bg-accent-500 dark:hover:bg-accent-400 inline-flex items-center gap-1 rounded-md px-4 py-2 text-sm font-medium text-white transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          Go to dashboard
        </Link>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="focus-visible:ring-accent-500 inline-flex items-center gap-1 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 focus-visible:ring-2 focus-visible:outline-none dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Go back
        </button>
      </div>
    </div>
  );
}
