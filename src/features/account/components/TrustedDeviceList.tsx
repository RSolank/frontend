import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ConfirmDialog } from '../../../shared/components/ConfirmDialog';
import { usePreferencesStore } from '../../../shared/state/preferences.store';
import { formatDateTime } from '../../../shared/utils/dateUtils';
import { authKeys } from '../../auth/api/keys';
import {
  fetchKnownDevices,
  revokeKnownDeviceRequest,
  type KnownDevice,
} from '../../auth/api/newDevice';

// BE Phase 2.3 (T-new-device-otp) — trusted-devices inventory for
// `/account/security`. Lists every device that has cleared the
// emailed-OTP gate; revoking a device cascades its active session
// (the user there gets logged out) and forces re-verification on
// the next sign-in from that device.
//
// The UA-string parser is duplicated from `SessionList.tsx` because
// the boundaries-eslint rule blocks cross-feature non-api imports
// — but the helper is small enough (~25 lines) that the duplication
// is cheaper than promoting it to `shared/utils/`. If a third
// consumer arrives we'll lift it.
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

export function TrustedDeviceList() {
  const queryClient = useQueryClient();
  const timezone = usePreferencesStore((s) => s.timezone);
  const {
    data: devices = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: authKeys.devices(),
    queryFn: fetchKnownDevices,
  });

  const [pending, setPending] = useState<KnownDevice | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const revoke = useMutation({
    mutationFn: (uid: number) => revokeKnownDeviceRequest(uid),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: authKeys.devices() });
      // Devices and sessions live on the same backend invariant — a
      // device delete cascades its session row. Invalidate both so
      // the sessions list updates in tandem if it's open.
      await queryClient.invalidateQueries({ queryKey: authKeys.sessions() });
    },
  });

  function handleConfirm() {
    if (!pending) return;
    setStatus(null);
    const target = pending;
    revoke.mutate(target.uid, {
      onSuccess: () => {
        setStatus(
          target.is_current
            ? 'This device was forgotten. You will be signed out on the next request.'
            : 'Device forgotten. Its next sign-in will require an emailed code.'
        );
        setPending(null);
      },
      onError: (err) => {
        const e = err as { detail?: string; error?: string };
        setStatus(e.detail || e.error || 'Failed to forget this device');
      },
    });
  }

  if (isLoading) {
    return (
      <div className="text-sm text-slate-500 dark:text-slate-400">
        Loading devices…
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="form-error">
        Failed to load devices.
      </div>
    );
  }

  if (devices.length === 0) {
    return (
      <div className="text-sm text-slate-500 dark:text-slate-400">
        No trusted devices yet — your next sign-in will email an OTP.
      </div>
    );
  }

  return (
    <>
      <ul
        className="divide-y divide-slate-200 dark:divide-slate-800"
        data-testid="trusted-device-list"
      >
        {devices.map((d) => (
          <li
            key={d.uid}
            className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"
            data-testid={`trusted-device-row-${d.uid}`}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-slate-100">
                <span>{deviceLabel(d.label)}</span>
                {d.is_current && (
                  <span className="bg-success-50 text-success-700 dark:bg-success-950/40 dark:text-success-300 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium">
                    This device
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                First seen {formatDateTime(d.first_seen, timezone)} · Last seen{' '}
                {formatDateTime(d.last_seen, timezone)}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setPending(d)}
              className="border-danger-300 text-danger-700 hover:bg-danger-50 dark:border-danger-800 dark:text-danger-300 dark:hover:bg-danger-950/40 self-start rounded-md border px-3 py-1 text-sm font-medium transition-colors sm:self-auto"
              data-testid={`forget-device-${d.uid}`}
            >
              Forget
            </button>
          </li>
        ))}
      </ul>

      {status && (
        <div
          className={
            status.startsWith('Failed')
              ? 'form-error mt-3'
              : 'text-success-600 dark:text-success-400 mt-3 text-sm font-medium'
          }
        >
          {status}
        </div>
      )}

      <ConfirmDialog
        open={pending !== null}
        title={
          pending?.is_current
            ? 'Forget this device?'
            : 'Forget this trusted device?'
        }
        message={
          pending?.is_current
            ? "This device will be signed out and its next sign-in will require an emailed code. You can use this if you're handing off the device or worry it's been compromised."
            : "That device's next sign-in will require an emailed code. Any active session it has is signed out immediately."
        }
        confirmLabel="Forget"
        intent="danger"
        busy={revoke.isPending}
        onConfirm={handleConfirm}
        onClose={() => setPending(null)}
      />
    </>
  );
}
