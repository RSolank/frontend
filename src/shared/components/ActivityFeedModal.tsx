import {
  AlertCircle,
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock,
  FileWarning,
  Receipt,
  RefreshCw,
  UserX,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

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
import { usePreferencesStore } from '../state/preferences.store';
import { priorityToneClass } from '../utils/activityPriority';
import { formatRelativeTime } from '../utils/dateUtils';

import { Modal } from './Modal';

// Activity feed modal — TopNav bell trigger.
//
// Rendering rule: ONE fetch (limit=10), preserve BE rank order, split
// items into Alerts (event_class='alert') then Notifications
// (event_class='notification') via the catalog. Each section header
// is hidden when its bucket is empty; both empty = "All clear" copy.
// BE owns ranking + retention + decay; FE never re-sorts or filters
// (server-side disable is the SoT for visibility).
//
// Soft-ack fires once when the modal opens, batched across all
// currently-visible items in BOTH sections. Hard-ack on row click +
// deep-link navigation per subject_type. Module-level dedupe set
// (`SEEN_THIS_SESSION`) ensures we don't re-fire soft for the same
// event ref in the same SPA session.

const FEED_LIMIT = 10;

const SEEN_THIS_SESSION = new Set<string>();

function refKey(item: ActivityFeedItem): string {
  return `${item.kind}::${item.subject_type}::${item.subject_id}`;
}

interface ActivityFeedModalProps {
  open: boolean;
  onClose: () => void;
}

export function ActivityFeedModal({ open, onClose }: ActivityFeedModalProps) {
  const feed = useActivityFeedQuery(FEED_LIMIT, open);
  const catalog = useActivityCatalogQuery(open);
  const timezone = usePreferencesStore((s) => s.timezone);
  const navigate = useNavigate();

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

  function handleItemClick(item: ActivityFeedItem) {
    void markActivitySeen({
      refs: [
        {
          kind: item.kind,
          subject_type: item.subject_type,
          subject_id: item.subject_id,
        },
      ],
      hard: true,
    }).catch(() => undefined);
    const target = deepLinkFor(item);
    onClose();
    if (target) navigate(target);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Recent activity"
      size="md"
      footer={
        <Link
          to="/account/notifications"
          onClick={onClose}
          className="text-sm font-medium text-accent-600 hover:text-accent-700 dark:text-accent-400 dark:hover:text-accent-300"
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
        onItemClick={handleItemClick}
      />
    </Modal>
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
    <div className="space-y-4">
      {alerts.length > 0 ? (
        <FeedSection
          heading="Alerts"
          items={alerts}
          timezone={timezone}
          onItemClick={onItemClick}
        />
      ) : null}
      {notifications.length > 0 ? (
        <FeedSection
          heading="Notifications"
          items={notifications}
          timezone={timezone}
          onItemClick={onItemClick}
        />
      ) : null}
    </div>
  );
}

interface FeedSectionProps {
  heading: string;
  items: ActivityFeedItem[];
  timezone: string;
  onItemClick: (item: ActivityFeedItem) => void;
}

function FeedSection({ heading, items, timezone, onItemClick }: FeedSectionProps) {
  const now = useTickingNow(60_000);
  return (
    <section aria-label={heading}>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {heading}
      </h3>
      <ul className="space-y-1">
        {items.map((item) => (
          <ActivityRow
            key={`${item.uid}-${item.kind}`}
            item={item}
            now={now}
            timezone={timezone}
            onActivate={() => onItemClick(item)}
          />
        ))}
      </ul>
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
        <Icon aria-hidden="true" className={`mt-0.5 h-4 w-4 flex-shrink-0 ${tone}`} />
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

function iconForKind(kind: string) {
  if (kind === 'bill_generated') return Receipt;
  if (kind === 'bill_paid') return CheckCircle2;
  if (kind === 'bill_overdue') return Clock;
  if (kind === 'budget_breached') return AlertTriangle;
  if (kind === 'tax_mode_auto_disabled') return AlertCircle;
  if (kind === 'statement_import_completed') return CheckCircle2;
  if (kind === 'statement_import_failed') return FileWarning;
  if (kind.startsWith('recurring_')) return RefreshCw;
  if (kind === 'account_deletion_grace_reminder') return UserX;
  return Bell;
}

function deepLinkFor(item: ActivityFeedItem): string | null {
  if (item.subject_type === 'bill')
    return `/consumption-tax?bill=${item.subject_id}`;
  if (item.subject_type === 'budget') return '/budgets';
  if (item.subject_type === 'statement_upload')
    return `/transactions?upload=${item.subject_id}`;
  if (item.subject_type === 'recurring') return '/transactions';
  return null;
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
