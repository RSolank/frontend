import { Link } from 'react-router-dom';

const GITHUB_REPO_URL = 'https://github.com/RSolank/personal-budget-app';

// GitHub Octicon mark (inlined SVG). lucide-react dropped brand icons,
// so we own the markup. `currentColor` lets the parent's text-* class
// drive the fill, which matches the icon to whatever container hover
// state is active.
function GitHubMark({ size = 20 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56v-2c-3.2.7-3.87-1.36-3.87-1.36-.52-1.34-1.27-1.69-1.27-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.45.11-3.03 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.62 1.58.23 2.74.11 3.03.74.81 1.18 1.84 1.18 3.1 0 4.42-2.7 5.39-5.27 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.68.8.56A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  );
}

// Placeholder Help page. Lives at /help; reachable from the top-bar
// help icon. When a real docs surface lands (external site or in-app
// guide), just repoint the icon's `to` and either retire this page or
// repurpose it as an in-app FAQ shell.
export function HelpPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:py-16">
      <div className="rounded-xl bg-white p-6 shadow-sm dark:bg-slate-900 dark:shadow-none dark:ring-1 dark:ring-slate-800">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            Help &amp; documentation
          </h1>
          <a
            href={GITHUB_REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View source on GitHub"
            title="View source on GitHub"
            className="focus-visible:ring-accent-500 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-700 transition-colors hover:bg-slate-900 hover:text-white focus-visible:ring-2 focus-visible:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-white dark:hover:text-slate-900"
          >
            <GitHubMark size={20} />
          </a>
        </div>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          A full help center is on the way. In the meantime, here are a few
          starting points:
        </p>
        <ul className="mt-4 space-y-2 text-sm">
          <li>
            <Link
              to="/account/accessibility"
              className="text-accent-600 hover:text-accent-700 dark:text-accent-400 dark:hover:text-accent-300"
            >
              Accessibility settings
            </Link>{' '}
            — theme, text size, motion, date / number formats.
          </li>
          <li>
            <Link
              to="/account/preferences"
              className="text-accent-600 hover:text-accent-700 dark:text-accent-400 dark:hover:text-accent-300"
            >
              Account preferences
            </Link>{' '}
            — country, currency, timezone, default transaction kind.
          </li>
          <li>
            <Link
              to="/settings/categories"
              className="text-accent-600 hover:text-accent-700 dark:text-accent-400 dark:hover:text-accent-300"
            >
              Categories &amp; rules
            </Link>{' '}
            — how transactions get tagged + the taxation rules engine.
          </li>
        </ul>
        <p className="mt-6 text-xs text-slate-500 dark:text-slate-400">
          Have a question this page doesn&rsquo;t answer? Drop it in the
          project&rsquo;s issue tracker — feedback shapes what ends up here
          first.
        </p>

        <div className="mt-6 border-t border-slate-100 pt-4 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
          <p>
            For developers — source, setup instructions, and architecture notes:{' '}
            <a
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-600 hover:text-accent-700 dark:text-accent-400 dark:hover:text-accent-300"
            >
              github.com/RSolank/personal-budget-app
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
