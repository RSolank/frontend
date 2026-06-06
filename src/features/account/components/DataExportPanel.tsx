import { useState } from 'react';

import { routes } from '../../../shared/api/routes';

// BE Phase 1.10 (`3521447`) — 8 exportable resources at
// `GET /api/exports/{resource}?format=csv|json` (auth).
// `profile` strips `dob`/`contact` PII; spend exports carry
// `net_expense` per the post-Phase-1.7 contract.
const EXPORT_RESOURCES = [
  { id: 'transactions', label: 'Transactions' },
  { id: 'beneficiaries', label: 'Beneficiaries' },
  { id: 'tax-bills', label: 'Consumption-tax bills' },
  { id: 'tax-details', label: 'Tax details (per-txn)' },
  { id: 'spend-by-tag', label: 'Spend by tag' },
  { id: 'spend-by-merchant', label: 'Spend by merchant' },
  { id: 'bank-accounts', label: 'Bank accounts' },
  { id: 'profile', label: 'Profile (excl. DOB / contact)' },
] as const;

type Format = 'csv' | 'json';

const BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  'http://localhost:4000';

// Builds the absolute URL for the BE export endpoint. Same prefix
// `apiClient` uses; the BE serves these with
// `Content-Disposition: attachment`, so a plain anchor click drives
// the browser-native download — no fetch + blob plumbing needed for
// the streaming case.
function buildExportUrl(resource: string, format: Format): string {
  return `${BASE_URL}${routes.exports.resource(resource, format)}`;
}

// Fallback for runtimes where anchor-driven downloads are blocked
// (some headless browsers); fetches the response, builds a blob,
// and clicks an off-DOM link. Authorization piggybacks via fetch
// since `<a download>` can't carry headers.
async function downloadViaFetch(
  resource: string,
  format: Format,
  setStatus: (s: string | null) => void
): Promise<void> {
  setStatus(null);
  try {
    const token = localStorage.getItem('access_token');
    const res = await fetch(buildExportUrl(resource, format), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      setStatus(`Failed to export ${resource} (${res.status}).`);
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${resource}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch {
    setStatus(`Failed to export ${resource}.`);
  }
}

export function DataExportPanel() {
  const [format, setFormat] = useState<Format>('csv');
  const [status, setStatus] = useState<string | null>(null);

  return (
    <div className="grid gap-3">
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Download a copy of your material data. Configuration (tags, rules,
        budgets) is intentionally excluded — those reconstruct from your
        transactions.
      </p>

      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
          Format
        </span>
        <div className="inline-flex rounded-md border border-slate-200 dark:border-slate-700">
          {(['csv', 'json'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFormat(f)}
              aria-pressed={format === f}
              className={`px-3 py-1 text-sm font-medium first:rounded-l-md last:rounded-r-md ${
                format === f
                  ? 'bg-accent-600 text-white'
                  : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
              }`}
              data-testid={`export-format-${f}`}
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <ul
        className="grid grid-cols-1 gap-2 sm:grid-cols-2"
        data-testid="export-resource-list"
      >
        {EXPORT_RESOURCES.map((r) => (
          <li
            key={r.id}
            className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 dark:border-slate-800"
          >
            <span className="text-sm text-slate-800 dark:text-slate-100">
              {r.label}
            </span>
            <button
              type="button"
              onClick={() => void downloadViaFetch(r.id, format, setStatus)}
              className="text-accent-600 hover:text-accent-700 dark:text-accent-400 dark:hover:text-accent-300 text-sm font-medium"
              data-testid={`export-${r.id}`}
            >
              Download
            </button>
          </li>
        ))}
      </ul>

      {status && (
        <div role="alert" className="form-error">
          {status}
        </div>
      )}
    </div>
  );
}
