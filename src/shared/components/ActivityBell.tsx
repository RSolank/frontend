import { m } from 'framer-motion';
import { Bell } from 'lucide-react';
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useActivityFeedQuery } from '../api/activityFeed';
import { useReducedMotionPref } from '../motion/useReducedMotionPref';
import { useActivityLastSeenStore } from '../state/activityLastSeen.store';

// The "ring" wobble — a quick bell swing (rotate keyframes, pivoting at the
// top like a real bell). Plays on first paint, on hover/focus, and on a gentle
// periodic beat while there are unseen items. Reduced motion collapses it to
// nothing via the app-wide MotionConfig (and we skip the interval entirely).
const BELL_RING = { rotate: [0, -14, 11, -8, 5, -3, 0] };
const RING_REST = { rotate: 0 };
const RING_PERIOD_MS = 6000;

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

  // Bell-ring wobble. `ringing` drives the rotate keyframe; it resets on
  // animation-complete so any trigger re-fires it. The trigger element (the
  // button) is also the origin the notifications modal flies from/to.
  const reduced = useReducedMotionPref();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [ringing, setRinging] = useState(false);
  const ring = useCallback(() => setRinging(true), []);

  // First paint: ring once regardless of unseen state.
  useEffect(() => {
    ring();
  }, [ring]);

  // Gentle periodic ring while there are unseen items (skipped under reduced
  // motion — no point spinning a timer that animates nothing).
  useEffect(() => {
    if (reduced || unseenCount === 0) return;
    const id = window.setInterval(ring, RING_PERIOD_MS);
    return () => window.clearInterval(id);
  }, [reduced, unseenCount, ring]);

  // Once opened, keep the modal mounted so its AnimatePresence can play the
  // close animation (collapse-to-bell). A bare `{open ? <Modal/> : null}`
  // unmounts it before the exit runs → abrupt close.
  const [everOpened, setEverOpened] = useState(false);
  function handleOpen() {
    markSeen();
    setEverOpened(true);
    setOpen(true);
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={
          unseenCount > 0
            ? `Recent activity (${unseenCount} unread)`
            : 'Recent activity'
        }
        title="Recent activity"
        onClick={handleOpen}
        onMouseEnter={ring}
        onFocus={ring}
        className="hover:bg-accent-50 hover:text-accent-700 focus-visible:ring-accent-500 dark:hover:bg-accent-950/40 dark:hover:text-accent-300 relative hidden h-11 w-11 shrink-0 items-center justify-center rounded-md text-slate-600 transition-colors focus-visible:ring-2 focus-visible:outline-none lg:inline-flex dark:text-slate-300"
      >
        <m.span
          className="inline-block origin-top"
          animate={ringing ? BELL_RING : RING_REST}
          transition={{ duration: 0.6, ease: 'easeInOut' }}
          onAnimationComplete={() => setRinging(false)}
        >
          <Bell aria-hidden="true" size={20} />
        </m.span>
        {badge ? (
          <span
            aria-hidden="true"
            className="bg-danger-600 absolute top-1 right-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 text-[10px] leading-none font-semibold text-white"
          >
            {badge}
          </span>
        ) : null}
      </button>
      {everOpened ? (
        <Suspense fallback={null}>
          <ActivityFeedModal
            open={open}
            onClose={() => setOpen(false)}
            originRef={triggerRef}
          />
        </Suspense>
      ) : null}
    </>
  );
}
