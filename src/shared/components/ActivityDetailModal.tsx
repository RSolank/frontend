import { ArrowRight } from 'lucide-react';
import { useEffect } from 'react';
import { Link } from 'react-router-dom';

import {
  itemsToSeenRefs,
  useMarkActivitySeenMutation,
  type ActivityFeedItem,
} from '../api/activityFeed';
import { usePreferencesStore } from '../state/preferences.store';
import { priorityToneClass } from '../utils/activityPriority';
import { subjectMeta } from '../utils/activitySubject';
import { formatDateTime } from '../utils/dateUtils';

import { Modal } from './Modal';

// Stacked over the feed modal — opens when the user clicks a row.
// Renders the feed-row payload (icon + summary + priority + relative
// time) and routes the user onward via the CTA when the subject maps
// to a known FE route. Lives in shared/ because the bell + feed-modal
// surface is mounted by TopNav (also shared/), so the boundary rule
// blocks cross-feature fetches from this file. Enriched per-subject
// detail (the "hybrid" model in the 2026-06-05 spec) is a follow-up
// that needs either a BE `GET /activity/{uid}` endpoint or a move of
// the whole activity surface into `features/activity/`.
//
// **Hard-ack semantics:** firing the hard-ack on open is the user's
// signal that they've engaged with the item, so the BE marks it
// resolved/muted and the feed query invalidates (the row drops out
// of the feed on the next fetch). The bell badge is independent —
// see `useActivityLastSeenStore`.

interface ActivityDetailModalProps {
  item: ActivityFeedItem;
  open: boolean;
  onClose: () => void;
}

export function ActivityDetailModal({
  item,
  open,
  onClose,
}: ActivityDetailModalProps) {
  const meta = subjectMeta(item);
  const timezone = usePreferencesStore((s) => s.timezone);

  // Hard-ack the item on open. Fire once per modal-open: the mutation
  // is idempotent on the BE side (re-sending the same ref is a no-op).
  const ackMutation = useMarkActivitySeenMutation();
  useEffect(() => {
    if (!open) return;
    ackMutation.mutate({
      refs: itemsToSeenRefs([item]),
      hard: true,
    });
    // Re-fire only when the modal transitions closed→open for a new
    // item — `item.uid` is unique per feed row.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item.uid]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Activity detail"
      size="md"
      footer={
        meta.href ? (
          <Link
            to={meta.href}
            onClick={onClose}
            className="inline-flex items-center gap-1 rounded-md bg-accent-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent-700 focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:outline-none dark:bg-accent-500 dark:hover:bg-accent-400"
          >
            {meta.ctaLabel}
            <ArrowRight aria-hidden="true" size={14} />
          </Link>
        ) : null
      }
    >
      <DetailHeader item={item} timezone={timezone} />
      <DetailBody item={item} />
    </Modal>
  );
}

interface DetailHeaderProps {
  item: ActivityFeedItem;
  timezone: string;
}

function DetailHeader({ item, timezone }: DetailHeaderProps) {
  const tone = priorityToneClass(item.priority);
  return (
    <div className="mb-4 space-y-1 border-b border-slate-200 pb-3 dark:border-slate-800">
      <p className={`text-xs font-semibold uppercase tracking-wider ${tone}`}>
        {item.event_class === 'alert' ? 'Alert' : 'Notification'}
        <span className="ml-1 text-slate-500 dark:text-slate-400">
          · {item.domain}
        </span>
      </p>
      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
        {item.summary}
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        {formatDateTime(item.refreshed_at, timezone)}
      </p>
    </div>
  );
}

function DetailBody({ item }: { item: ActivityFeedItem }) {
  const meta = subjectMeta(item);
  return (
    <p className="text-sm text-slate-500 dark:text-slate-400">
      {meta.href
        ? 'Use the action below to go straight to where you can deal with this.'
        : 'No further action required.'}
    </p>
  );
}

export default ActivityDetailModal;
