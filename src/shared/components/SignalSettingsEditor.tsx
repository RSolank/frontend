import { useMemo } from 'react';

import type { CatalogEntry, CatalogResponse } from '../api/activityCatalog';
import { ACTIVITY_DOMAIN_LABELS } from '../constants/activity';

// Shared editor for activity per-user signal-settings.
//
// Stateless — owner-side query + mutation live in the caller
// (admin user-detail section vs. /account/notifications page). The
// editor renders the kind list grouped by domain, with one toggle
// per kind that maps to "enabled" (the inverse of `disabled[]`).
//
// `viewerRole = 'admin'` enables the per-row "advanced" expansion
// for catalog-level tunables (priority/rank/system_enabled);
// `viewerRole = 'user'` hides it entirely (system-tuning is
// admin-only by spec).
//
// `system_enabled === false` means the kind is globally off
// (admin shut it down platform-wide). The user-side renders this
// row as disabled with a 'System off' badge; the admin-side keeps
// the toggle interactive (so an admin can re-enable for that
// target user — or use the tune disclosure to flip system-enabled
// back on globally).

interface SignalSettingsEditorProps {
  catalog: CatalogResponse | undefined;
  disabled: string[];
  viewerRole: 'admin' | 'user';
  busyKinds?: Set<string>;
  onToggle: (kind: string, enabled: boolean) => void;
  onTune?: (
    kind: string,
    patch: {
      priority?: number;
      rank_order?: number;
      system_enabled?: boolean;
    }
  ) => void;
}

function domainLabel(d: string): string {
  return ACTIVITY_DOMAIN_LABELS[d] ?? d;
}

function kindLabel(entry: CatalogEntry): string {
  // The BE catalog doesn't carry a human label per kind today —
  // FE renders the snake_case kind as a friendly title. Replace
  // with the BE-authored label once it exposes one.
  return entry.kind
    .split('_')
    .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(' ');
}

export function SignalSettingsEditor({
  catalog,
  disabled,
  viewerRole,
  busyKinds,
  onToggle,
  onTune,
}: SignalSettingsEditorProps) {
  const disabledSet = useMemo(() => new Set(disabled), [disabled]);

  const grouped = useMemo(() => {
    const out = new Map<string, CatalogEntry[]>();
    const entries = catalog?.entries ?? [];
    // Preserve catalog order within a domain (catalog rank_order is
    // applied BE-side already in the response).
    for (const e of entries) {
      const arr = out.get(e.domain) ?? [];
      arr.push(e);
      out.set(e.domain, arr);
    }
    return out;
  }, [catalog]);

  if (!catalog || catalog.entries.length === 0) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        No signal kinds registered yet.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {Array.from(grouped.entries()).map(([domain, entries]) => (
        <section key={domain} aria-label={domainLabel(domain)}>
          <h3 className="mb-2 text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
            {domainLabel(domain)}
          </h3>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {entries.map((entry) => (
              <SignalRow
                key={entry.kind}
                entry={entry}
                enabled={!disabledSet.has(entry.kind)}
                viewerRole={viewerRole}
                busy={busyKinds?.has(entry.kind) ?? false}
                onToggle={onToggle}
                onTune={onTune}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

interface SignalRowProps {
  entry: CatalogEntry;
  enabled: boolean;
  viewerRole: 'admin' | 'user';
  busy: boolean;
  onToggle: (kind: string, enabled: boolean) => void;
  onTune?: SignalSettingsEditorProps['onTune'];
}

function SignalRow({
  entry,
  enabled,
  viewerRole,
  busy,
  onToggle,
  onTune,
}: SignalRowProps) {
  // User-side cannot toggle a system-disabled kind — the BE filter
  // would still strip those events. Admin-side keeps the toggle
  // active so the admin can override per-target-user.
  const lockedByUserView = viewerRole === 'user' && !entry.system_enabled;
  return (
    <li className="py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
            {kindLabel(entry)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {entry.event_class === 'alert' ? 'Alert' : 'Notification'} ·
            priority {entry.priority}
            {!entry.system_enabled ? (
              <span className="ml-2 inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                System off
              </span>
            ) : null}
          </p>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2">
          <span className="sr-only">Enable {kindLabel(entry)}</span>
          <input
            type="checkbox"
            checked={enabled}
            disabled={busy || lockedByUserView}
            onChange={(e) => onToggle(entry.kind, e.target.checked)}
            className="text-accent-600 focus:ring-accent-500 h-4 w-4 cursor-pointer rounded border-slate-300 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700"
          />
        </label>
      </div>
      {viewerRole === 'admin' && onTune ? (
        <AdminTuneRow entry={entry} onTune={onTune} />
      ) : null}
    </li>
  );
}

interface AdminTuneRowProps {
  entry: CatalogEntry;
  onTune: NonNullable<SignalSettingsEditorProps['onTune']>;
}

function AdminTuneRow({ entry, onTune }: AdminTuneRowProps) {
  return (
    <details className="mt-2">
      <summary className="hover:text-accent-600 dark:hover:text-accent-400 cursor-pointer text-xs text-slate-500 dark:text-slate-400">
        Advanced tuning (system-wide)
      </summary>
      <div className="mt-2 flex flex-wrap items-end gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-950/40">
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-slate-500 dark:text-slate-400">Priority</span>
          <select
            defaultValue={entry.priority}
            onChange={(e) =>
              onTune(entry.kind, { priority: Number(e.target.value) })
            }
            className="form-input !py-1 text-xs"
          >
            <option value={1}>1 (highest)</option>
            <option value={2}>2</option>
            <option value={3}>3 (lowest)</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-slate-500 dark:text-slate-400">Rank order</span>
          <input
            type="number"
            defaultValue={entry.rank_order}
            onBlur={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v) && v !== entry.rank_order) {
                onTune(entry.kind, { rank_order: v });
              }
            }}
            className="form-input w-24 !py-1 text-xs"
          />
        </label>
        <label className="inline-flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            defaultChecked={entry.system_enabled}
            onChange={(e) =>
              onTune(entry.kind, { system_enabled: e.target.checked })
            }
            className="text-accent-600 focus:ring-accent-500 h-4 w-4 cursor-pointer rounded border-slate-300 dark:border-slate-700"
          />
          <span className="text-slate-700 dark:text-slate-300">
            System enabled
          </span>
        </label>
      </div>
    </details>
  );
}
