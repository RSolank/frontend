import { useEffect, useState } from 'react';

interface LockedFieldBannerProps {
  // The reason copy. Renders as the banner body. Pass the same string
  // for repeated clicks; the banner re-renders with the latest reason
  // so per-field copy works naturally.
  reason: string | null;
  // Auto-clear the banner after this many ms of inactivity. Defaults
  // to keeping the banner sticky until manually cleared (e.g. when
  // the parent observes a successful edit on an editable field).
  autoDismissMs?: number;
  // Fired when the auto-dismiss timer fires so the parent can sync
  // its own state. Optional.
  onDismiss?: () => void;
}

// Top-of-modal banner explaining why a read-only field can't be
// edited. The DetailModal convention (Batch 9.8) keeps the form
// layout identical between fresh-open and dirty-edit states; the
// banner is the only delta and only surfaces after the user actively
// clicks a read-only field. Parents auto-clear `reason` on first
// successful edit of an editable field so the modal returns to its
// calm baseline.
export function LockedFieldBanner({
  reason,
  autoDismissMs,
  onDismiss,
}: LockedFieldBannerProps) {
  const [visible, setVisible] = useState(Boolean(reason));

  useEffect(() => {
    setVisible(Boolean(reason));
  }, [reason]);

  useEffect(() => {
    if (!visible || !autoDismissMs) return undefined;
    const id = window.setTimeout(() => {
      setVisible(false);
      onDismiss?.();
    }, autoDismissMs);
    return () => window.clearTimeout(id);
  }, [visible, autoDismissMs, onDismiss]);

  if (!visible || !reason) return null;
  return (
    <div
      role="status"
      data-testid="locked-field-banner"
      className="mb-3 rounded-md border border-warning-200 bg-warning-50 px-3 py-2 text-xs text-warning-800 dark:border-warning-900/50 dark:bg-warning-950/40 dark:text-warning-200"
    >
      {reason}
    </div>
  );
}
