import { Bell } from 'lucide-react';
import { lazy, Suspense, useState } from 'react';

import { useActivityFeedQuery } from '../api/activityFeed';

// TopNav bell trigger. Click → lazy-loads ActivityFeedModal so the
// feed surface stays out of the initial paint chunk. Badge counts
// items currently in the feed (both alert + notification classes),
// capped at "5+" per task-admin.md decision; falls to zero as the
// user hard-clicks items (BE removes from next fetch via DELETE for
// notifications / MUTE for alerts).
//
// The feed query lives at the bell (not just the modal) so the
// badge paints without opening the modal. staleTime on the query
// (30s) matches the modal — re-opening the bell within a short
// window re-uses the same cached page.

const ActivityFeedModal = lazy(() =>
  import('./ActivityFeedModal').then((m) => ({ default: m.ActivityFeedModal }))
);

interface ActivityBellProps {
  enabled: boolean;
}

const BADGE_CAP = 5;

function formatBadge(count: number): string | null {
  if (count <= 0) return null;
  if (count > BADGE_CAP) return `${BADGE_CAP}+`;
  return String(count);
}

export function ActivityBell({ enabled }: ActivityBellProps) {
  const [open, setOpen] = useState(false);
  const feed = useActivityFeedQuery(10, enabled);
  const count = feed.data?.items.length ?? 0;
  const badge = formatBadge(count);

  return (
    <>
      <button
        type="button"
        aria-label={
          count > 0 ? `Recent activity (${count} unread)` : 'Recent activity'
        }
        title="Recent activity"
        onClick={() => setOpen(true)}
        className="relative hidden h-11 w-11 shrink-0 items-center justify-center rounded-md text-slate-600 transition-colors hover:bg-accent-50 hover:text-accent-700 focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:outline-none lg:inline-flex dark:text-slate-300 dark:hover:bg-accent-950/40 dark:hover:text-accent-300"
      >
        <Bell aria-hidden="true" size={20} />
        {badge ? (
          <span
            aria-hidden="true"
            className="absolute top-1 right-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-danger-600 px-1 text-[10px] font-semibold leading-none text-white"
          >
            {badge}
          </span>
        ) : null}
      </button>
      {open ? (
        <Suspense fallback={null}>
          <ActivityFeedModal open={open} onClose={() => setOpen(false)} />
        </Suspense>
      ) : null}
    </>
  );
}
