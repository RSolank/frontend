import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { useActivityCatalogQuery } from '../../../shared/api/activityCatalog';
import {
  useUserSignalSettingsQuery,
  updateUserSignalSetting,
  type SignalSettingsResponse,
} from '../../../shared/api/activityFeed';
import { activityKeys } from '../../../shared/api/activityKeys';
import type { ApiError } from '../../../shared/api/apiClient';
import { SignalSettingsEditor } from '../../../shared/components/SignalSettingsEditor';

// /account/notifications — the user-side surface for toggling which
// feed kinds reach them. Reuses <SignalSettingsEditor> with
// viewerRole='user' (no advanced/system tuning). The BE applies the
// disable filter server-side; FE just controls the write.

function useToggleUserSignalMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateUserSignalSetting,
    onSuccess: (next: SignalSettingsResponse) => {
      qc.setQueryData(activityKeys.signalSettings(), next);
      // Drop any cached feed pages so the BE's new filter is honored
      // on the next bell open.
      void qc.invalidateQueries({ queryKey: activityKeys.all });
    },
  });
}

export function AccountNotificationsPage() {
  const catalog = useActivityCatalogQuery(true);
  const settings = useUserSignalSettingsQuery(true);
  const toggle = useToggleUserSignalMutation();
  const [status, setStatus] = useState<string | null>(null);

  function handleToggle(kind: string, enabled: boolean) {
    setStatus(null);
    toggle.mutate(
      { kind, enabled },
      {
        onError: (err) => {
          const e = err as unknown as ApiError;
          const detail = typeof e?.detail === 'string' ? e.detail : undefined;
          setStatus(detail ?? e?.error ?? 'Update failed.');
        },
      }
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          Notifications
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Pick which kinds of activity reach your bell. Alerts surface
          actionable issues; notifications are informational. System- disabled
          kinds can&apos;t be turned on by you — contact support if you think
          one should be available.
        </p>
      </header>

      {status ? (
        <p
          role="status"
          className="border-danger-300 bg-danger-50/40 text-danger-700 dark:border-danger-900/60 dark:bg-danger-950/20 dark:text-danger-300 rounded-md border p-3 text-sm"
        >
          {status}
        </p>
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {settings.isLoading || catalog.isLoading ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
        ) : (
          <SignalSettingsEditor
            catalog={catalog.data}
            disabled={settings.data?.disabled ?? []}
            viewerRole="user"
            onToggle={handleToggle}
          />
        )}
      </div>
    </div>
  );
}
