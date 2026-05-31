import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ConfirmDialog } from '../../../shared/components/ConfirmDialog';
import { usePreferencesStore } from '../../../shared/state/preferences.store';
import { formatDateTime } from '../../../shared/utils/dateUtils';
import { authKeys } from '../../auth/api/keys';
import { revokeSessionRequest } from '../../auth/api/mutations';
import {
  useSessionsQuery,
  type SessionInfo,
} from '../../auth/api/queries';

// Lightweight UA-string parser — picks a short device label from the
// `device_data` field the backend stores. `device_data` is the raw
// User-Agent header in practice; this returns something compact the
// user can recognise ("Chrome on macOS" / "Mobile Safari") rather
// than the full multi-clause UA string. We only care about the
// common patterns; fall back to "Unknown device".
function deviceLabel(deviceData: string | null | undefined): string {
  if (!deviceData) return 'Unknown device';
  const raw = deviceData.toLowerCase();
  const browser = pickBrowser(raw);
  const os = pickOs(raw);
  if (browser && os) return `${browser} on ${os}`;
  if (browser) return browser;
  if (os) return os;
  return 'Unknown device';
}

function pickBrowser(ua: string): string | null {
  if (ua.includes('edg/')) return 'Edge';
  if (ua.includes('opr/') || ua.includes('opera')) return 'Opera';
  if (ua.includes('firefox/')) return 'Firefox';
  if (ua.includes('chrome/')) return 'Chrome';
  if (ua.includes('safari/')) return 'Safari';
  return null;
}

function pickOs(ua: string): string | null {
  if (ua.includes('iphone') || ua.includes('ipad')) return 'iOS';
  if (ua.includes('android')) return 'Android';
  if (ua.includes('mac os') || ua.includes('macintosh')) return 'macOS';
  if (ua.includes('windows')) return 'Windows';
  if (ua.includes('linux')) return 'Linux';
  return null;
}

interface PendingRevoke {
  session: SessionInfo;
}

export function SessionList() {
  const queryClient = useQueryClient();
  const timezone = usePreferencesStore((s) => s.timezone);
  const { data: sessions = [], isLoading, error } = useSessionsQuery();
  const [pending, setPending] = useState<PendingRevoke | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const revoke = useMutation({
    mutationFn: (sessionId: number) => revokeSessionRequest(sessionId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: authKeys.sessions() });
    },
  });

  function handleConfirm() {
    if (!pending) return;
    setStatus(null);
    const target = pending.session;
    // `.mutate()` with onSuccess/onError so the rejection routes
    // through the mutation's error path rather than dangling as an
    // unhandled promise.
    revoke.mutate(target.session_id, {
      onSuccess: () => {
        setStatus(
          target.is_current
            ? 'Session revoked. You will be logged out on the next request.'
            : 'Session revoked.'
        );
        setPending(null);
      },
      onError: (err) => {
        const e = err as { detail?: string; error?: string };
        setStatus(e.detail || e.error || 'Failed to revoke session');
      },
    });
  }

  if (isLoading) {
    return (
      <div className="text-sm text-slate-500 dark:text-slate-400">
        Loading sessions…
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="form-error">
        Failed to load sessions.
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="text-sm text-slate-500 dark:text-slate-400">
        No active sessions.
      </div>
    );
  }

  return (
    <>
      <ul
        className="divide-y divide-slate-200 dark:divide-slate-800"
        data-testid="session-list"
      >
        {sessions.map((session) => (
          <li
            key={session.session_id}
            className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"
            data-testid={`session-row-${session.session_id}`}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-slate-100">
                <span>{deviceLabel(session.device_data)}</span>
                {session.is_current && (
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                    This device
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {session.ip_address ?? 'IP unknown'} · last active{' '}
                {formatDateTime(session.last_modified, timezone)}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setPending({ session })}
              className="self-start rounded-md border border-rose-300 px-3 py-1 text-sm font-medium text-rose-700 transition-colors hover:bg-rose-50 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-950/40 sm:self-auto"
              data-testid={`revoke-session-${session.session_id}`}
            >
              Revoke
            </button>
          </li>
        ))}
      </ul>

      {status && (
        <div
          className={
            status.startsWith('Failed')
              ? 'form-error mt-3'
              : 'mt-3 text-sm font-medium text-emerald-600 dark:text-emerald-400'
          }
        >
          {status}
        </div>
      )}

      <ConfirmDialog
        open={pending !== null}
        title={
          pending?.session.is_current
            ? 'Revoke this device?'
            : 'Revoke this session?'
        }
        message={
          pending?.session.is_current
            ? "You'll be logged out on this device. You can sign back in afterwards."
            : 'The selected session will be ended immediately.'
        }
        confirmLabel="Revoke"
        intent="danger"
        busy={revoke.isPending}
        onConfirm={handleConfirm}
        onClose={() => setPending(null)}
      />
    </>
  );
}
