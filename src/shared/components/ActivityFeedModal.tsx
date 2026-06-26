import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  buildEventClassIndex,
  useActivityCatalogQuery,
} from '../api/activityCatalog';
import {
  itemsToSeenRefs,
  markActivitySeen,
  useActivityFeedQuery,
  type ActivityFeedItem,
} from '../api/activityFeed';
import { ModalReveal, RevealField } from '../motion/ModalReveal';
import { usePreferencesStore } from '../state/preferences.store';
import { groupByDomain } from '../utils/activityDomain';
import { iconForKind } from '../utils/activityIcon';
import { priorityToneClass } from '../utils/activityPriority';
import { formatRelativeTime } from '../utils/dateUtils';

import { Modal } from './Modal';

// Lazy-load the detail modal so its dependency graph (taxation +
// beneficiaries + statement-upload query hooks) doesn't ride the
// feed modal's chunk.
const ActivityDetailModal = lazy(() =>
  import('./ActivityDetailModal').then((m) => ({
    default: m.ActivityDetailModal,
  }))
);

// Activity feed modal — TopNav bell trigger.
//
// Rendering rule: ONE fetch (limit=10), preserve BE rank order, split
// items into Alerts (event_class='alert') then Notifications
// (event_class='notification') via the catalog. Within each section
// items are clustered by `domain` under a sub-header (T-nav-ia-reorg,
// Strategy A): domain groups appear in the order of their highest-ranked
// member and items within a group keep BE order, so the global ranking is
// preserved as far as a contiguous grouping allows — see `groupByDomain`.
// A header (section or domain) is only emitted when it has items; both
// sections empty = "All clear" copy. BE owns ranking + retention + decay;
// FE never re-sorts or filters (server-side disable is the SoT).
//
// This is also why the Recurring page could leave the MAIN nav row
// (T-nav-ia-reorg): its upcoming/pending bills already arrive as
// recurring-domain signals and now surface under a "Recurring" header,
// with the full forecast one click away in Settings.
//
// Click flow (2026-06-05 spec):
//   - Soft-ack fires once on modal open (`useSoftAckOnOpen`) so the
//     BE bumps `last_seen_at` for everything visible. Module-level
//     `SEEN_THIS_SESSION` dedupes against re-fires for the same refs
//     in the same SPA session.
//   - Row click opens a stacked `ActivityDetailModal` IN PLACE — the
//     feed modal stays mounted underneath; closing the detail returns
//     the user to the feed. The detail modal fires the hard-ack on
//     mount (which invalidates the feed query and the row drops out
//     of the next fetch).
//
// The bell badge (TopNav) is independent of the feed contents — it
// counts items whose `refreshed_at > lastSeenAt`, so opening the bell
// once is enough to clear it (see `useActivityLastSeenStore`).

const FEED_LIMIT = 10;

const SEEN_THIS_SESSION = new Set<string>();

// Test hook — reset between tests so the module-level dedupe doesn't
// leak refKeys across runs. Not part of any production code path.
export function __resetSeenThisSession() {
  SEEN_THIS_SESSION.clear();
}

function refKey(item: ActivityFeedItem): string {
  return `${item.kind}::${item.subject_type}::${item.subject_id}`;
}

interface ActivityFeedModalProps {
  open: boolean;
  onClose: () => void;
  // The bell button — the modal flies out of it and collapses back into it
  // (T-nav-ia-reorg, first consumer of the Modal `originRef` infra).
  originRef?: React.RefObject<HTMLElement | null>;
}

export function ActivityFeedModal({
  open,
  onClose,
  originRef,
}: ActivityFeedModalProps) {
  const feed = useActivityFeedQuery(FEED_LIMIT, open);
  const catalog = useActivityCatalogQuery(open);
  const timezone = usePreferencesStore((s) => s.timezone);
  const [selected, setSelected] = useState<ActivityFeedItem | null>(null);

  const { alerts, notifications } = useMemo(() => {
    const items = feed.data?.items ?? [];
    const cls = buildEventClassIndex(catalog.data);
    const a: ActivityFeedItem[] = [];
    const n: ActivityFeedItem[] = [];
    for (const it of items) {
      const kclass = it.event_class || cls.get(it.kind) || 'notification';
      if (kclass === 'alert') a.push(it);
      else n.push(it);
    }
    return { alerts: a, notifications: n };
  }, [feed.data, catalog.data]);

  useSoftAckOnOpen(open, feed.data?.items ?? []);

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        originRef={originRef}
        title="Recent activity"
        size="md"
        footer={
          <Link
            to="/account/notifications"
            onClick={onClose}
            className="text-accent-600 hover:text-accent-700 dark:text-accent-400 dark:hover:text-accent-300 text-sm font-medium"
          >
            Manage notifications →
          </Link>
        }
      >
        <ModalBody
          loading={feed.isLoading || catalog.isLoading}
          error={feed.isError}
          alerts={alerts}
          notifications={notifications}
          timezone={timezone}
          onItemClick={setSelected}
        />
      </Modal>
      {selected ? (
        <Suspense fallback={null}>
          <ActivityDetailModal
            item={selected}
            open={selected !== null}
            onClose={() => setSelected(null)}
          />
        </Suspense>
      ) : null}
    </>
  );
}

interface ModalBodyProps {
  loading: boolean;
  error: boolean;
  alerts: ActivityFeedItem[];
  notifications: ActivityFeedItem[];
  timezone: string;
  onItemClick: (item: ActivityFeedItem) => void;
}

function ModalBody({
  loading,
  error,
  alerts,
  notifications,
  timezone,
  onItemClick,
}: ModalBodyProps) {
  // The Alerts/Notifications sections ride the shared three-beat reveal
  // (T-nav-ia-reorg #6): the panel lands, fields fade with the grow, then rise
  // once settled. The bell's feed is already loaded by the time this renders
  // (the loading branch returns first), so the rise is un-gated (`ready`
  // defaults true). Reduced motion / no orchestration → static.
  if (loading) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
    );
  }
  if (error) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Couldn&apos;t load activity. We&apos;ll retry shortly.
      </p>
    );
  }
  if (alerts.length === 0 && notifications.length === 0) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        All clear — nothing new.
      </p>
    );
  }
  return (
    <ModalReveal className="space-y-4">
      {alerts.length > 0 ? (
        <RevealField>
          <FeedSection
            heading="Alerts"
            items={alerts}
            timezone={timezone}
            onItemClick={onItemClick}
          />
        </RevealField>
      ) : null}
      {notifications.length > 0 ? (
        <RevealField>
          <FeedSection
            heading="Notifications"
            items={notifications}
            timezone={timezone}
            onItemClick={onItemClick}
          />
        </RevealField>
      ) : null}
    </ModalReveal>
  );
}

interface FeedSectionProps {
  heading: string;
  items: ActivityFeedItem[];
  timezone: string;
  onItemClick: (item: ActivityFeedItem) => void;
}

function FeedSection({
  heading,
  items,
  timezone,
  onItemClick,
}: FeedSectionProps) {
  const now = useTickingNow(60_000);
  const groups = useMemo(() => groupByDomain(items), [items]);
  return (
    <section aria-label={heading}>
      <h3 className="mb-2 text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
        {heading}
      </h3>
      <div className="space-y-3">
        {groups.map((group) => (
          <div key={group.domain || '__none'}>
            <h4 className="mb-1 px-2 text-[11px] font-medium tracking-wide text-slate-400 dark:text-slate-500">
              {group.label}
            </h4>
            <ul className="space-y-1">
              {group.items.map((item) => (
                <ActivityRow
                  key={`${item.uid}-${item.kind}`}
                  item={item}
                  now={now}
                  timezone={timezone}
                  onActivate={() => onItemClick(item)}
                />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

interface ActivityRowProps {
  item: ActivityFeedItem;
  now: number;
  timezone: string;
  onActivate: () => void;
}

function ActivityRow({ item, now, timezone, onActivate }: ActivityRowProps) {
  const Icon = iconForKind(item.kind);
  const tone = priorityToneClass(item.priority);
  return (
    <li>
      <button
        type="button"
        onClick={onActivate}
        className="group flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none dark:hover:bg-slate-800 dark:focus-visible:bg-slate-800"
        data-event-uid={item.uid}
      >
        <Icon
          aria-hidden="true"
          className={`mt-0.5 h-4 w-4 flex-shrink-0 ${tone}`}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-slate-800 dark:text-slate-100">
            {item.summary}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {formatRelativeTime(item.refreshed_at, now, timezone)}
          </p>
        </div>
      </button>
    </li>
  );
}

function useSoftAckOnOpen(open: boolean, items: ActivityFeedItem[]) {
  useEffect(() => {
    if (!open || items.length === 0) return;
    const fresh = items.filter((i) => !SEEN_THIS_SESSION.has(refKey(i)));
    if (fresh.length === 0) return;
    fresh.forEach((i) => SEEN_THIS_SESSION.add(refKey(i)));
    void markActivitySeen({
      refs: itemsToSeenRefs(fresh),
      hard: false,
    }).catch(() => undefined);
  }, [open, items]);
}

function useTickingNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  const ref = useRef(now);
  ref.current = now;
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}
