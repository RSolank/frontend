import React from 'react';
import { Link } from 'react-router-dom';

// Husk page kept intentionally thin per the Batch 7 user override
// (2026-05-26): we do NOT redirect /settings anywhere — Batch 9 will
// build the proper SettingsLayout shell with sidebar + tab navigation
// and at that point /settings → /settings/categories becomes the
// canonical redirect. Until then, /settings renders this placeholder
// listing the available settings surfaces.
//
// Tabs moved out:
//  - Categories      → /categories     (Batch 4)
//  - Categorization Rules → /categorization-rules (Batch 6)
//  - Taxation Rules  → /settings/taxation-rules (Batch 7)

const LINKS = [
  { to: '/settings/taxation-rules', label: 'Taxation Rules', desc: 'Per-txn-type base tax + default penalty rates.' },
  { to: '/categorization-rules', label: 'Categorization Rules', desc: 'Auto-tagging rules for incoming transactions.' },
  { to: '/categories', label: 'Categories', desc: 'Manage your tag tree and aliases.' },
];

export function SettingsPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          Settings
        </h1>
        <p className="mt-1 max-w-xl text-sm text-slate-500 dark:text-slate-400">
          Configuration surfaces. Batch 9 will replace this index with a
          proper sidebar shell; until then each settings page is reached
          via the top-nav Settings menu or the list below.
        </p>
      </header>

      <ul className="flex flex-col gap-2" data-testid="settings-index">
        {LINKS.map((l) => (
          <li key={l.to}>
            <Link
              to={l.to}
              className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-4 py-3 no-underline transition-colors hover:border-indigo-300 hover:bg-indigo-50/40 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-700 dark:hover:bg-indigo-950/30"
            >
              <span>
                <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">
                  {l.label}
                </span>
                <span className="mt-0.5 block text-sm text-slate-500 dark:text-slate-400">
                  {l.desc}
                </span>
              </span>
              <span aria-hidden className="text-slate-400 dark:text-slate-500">→</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
