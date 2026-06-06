import { useIsFetching, useIsMutating } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

// Render free-tier services sleep after 15 min idle and take ~30 s
// to cold-boot on the first request. Without a UI cue, users assume
// the app is broken and bounce. This notice appears when ANY
// React-Query request (query or mutation) has been pending for >5 s
// and auto-clears the moment something completes.
//
// Bottom-left placement so it doesn't collide with the bottom-right
// `<StatementUploadDock>`. Same Tailwind palette as the dock.
const WAKE_THRESHOLD_MS = 5_000;

export function ServiceWakingNotice() {
  const fetchingCount = useIsFetching();
  const mutatingCount = useIsMutating();
  const anyPending = fetchingCount + mutatingCount > 0;
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!anyPending) {
      setShow(false);
      return;
    }
    const timer = setTimeout(() => setShow(true), WAKE_THRESHOLD_MS);
    return () => clearTimeout(timer);
  }, [anyPending]);

  if (!show) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="service-waking-notice"
      className="fixed bottom-4 left-4 z-40 flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-md dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
    >
      <span
        aria-hidden="true"
        className="inline-block h-2 w-2 animate-pulse rounded-full bg-amber-500"
      />
      Waking up the service…
    </div>
  );
}
