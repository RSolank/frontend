import { Bell } from 'lucide-react';
import { lazy, Suspense, useMemo, useState } from 'react';

import { useActivityFeedQuery } from '../api/activityFeed';
import { useActivityLastSeenStore } from '../state/activityLastSeen.store';

// TopNav bell trigger. The badge follows the **unseen-count** model
// (see the 2026-06-05 notifications-flow conversation): it counts
// feed items whose `refreshed_at` is newer than the user's
// `lastSeenAt` timestamp. Opening the bell writes the current
// timestamp, so a single click drops the badge to 0; new events that
// arrive after the open push it back up. Badge is capped at "5+".
//
// Items themselves persist in the feed across opens — the
// ActivityFeedModal hard-acks an item only when the user opens its
// detail surface, at which point the BE removes it from the next
// feed response.
//
// The feed query lives at the bell (not just the modal) so the badge
// paints without opening the modal. staleTime on the query (30s)
// matches the modal — re-opening within a short window re-uses the
// same cached page.

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
  const lastSeenAt = useActivityLastSeenStore((s) => s.lastSeenAt);
  const markSeen = useActivityLastSeenStore((s) => s.markSeen);

  const unseenCount = useMemo(() => {
    const items = feed.data?.items ?? [];
    if (items.length === 0) return 0;
    return items.reduce((acc, it) => {
      const t = Date.parse(it.refreshed_at);
      return Number.isFinite(t) && t > lastSeenAt ? acc + 1 : acc;
    }, 0);
  }, [feed.data, lastSeenAt]);

  const badge = formatBadge(unseenCount);

  function handleOpen() {
    markSeen();
    setOpen(true);
  }

  return (
    <>
      <button
        type="button"
        aria-label={
          unseenCount > 0
            ? `Recent activity (${unseenCount} unread)`
            : 'Recent activity'
        }
        title="Recent activity"
        onClick={handleOpen}
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
