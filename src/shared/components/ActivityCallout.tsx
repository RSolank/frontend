import { X } from 'lucide-react';
import { Link } from 'react-router-dom';

import {
  itemsToSeenRefs,
  useMarkActivitySeenMutation,
  type ActivityFeedItem,
} from '../api/activityFeed';
import { iconForKind } from '../utils/activityIcon';
import { priorityTone, priorityToneClass } from '../utils/activityPriority';
import { subjectMeta } from '../utils/activitySubject';

// Inline, dismissible activity row for the dashboard cards (B1
// enrichment). Unlike the bell modal — the soft-ack-on-render inbox —
// these callouts only ever **hard-ack on explicit dismiss** so the
// bell stays the sole owner of the soft-seen lifecycle. A hard-ack
// MUTEs an alert (resurfaces later) or DELETEs a notification per the
// BE Law; either way the row drops on the next domain-feed refetch
// (the mutation invalidates `feedAll()`).
//
// Reuses the shared activity machinery rather than forking it:
// `iconForKind` (icon), `priorityTone*` (severity colour), and
// `subjectMeta` (the FE-owned deep link). New BE kinds degrade
// gracefully — unknown icon → Bell, unknown subject → no CTA.

const CONTAINER_TONE: Record<ReturnType<typeof priorityTone>, string> = {
  danger:
    'border-danger-300 bg-danger-50 dark:border-danger-800/60 dark:bg-danger-950/30',
  warning:
    'border-warning-300 bg-warning-50 dark:border-warning-700/60 dark:bg-warning-950/30',
  neutral:
    'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900',
};

interface ActivityCalloutProps {
  item: ActivityFeedItem;
  // Override the deep-link label/destination when the default
  // `subjectMeta` mapping isn't what the surface wants. Optional.
  ctaLabel?: string;
  testId?: string;
}

export function ActivityCallout({
  item,
  ctaLabel,
  testId,
}: ActivityCalloutProps) {
  const seen = useMarkActivitySeenMutation();
  const Icon = iconForKind(item.kind);
  const tone = priorityTone(item.priority);
  const { href, ctaLabel: defaultCtaLabel } = subjectMeta(item);
  const label = ctaLabel ?? defaultCtaLabel;

  const dismiss = () => {
    seen.mutate({ refs: itemsToSeenRefs([item]), hard: true });
  };

  return (
    <div
      data-testid={testId}
      className={`flex items-start gap-2 rounded-md border p-2.5 text-xs shadow-sm ${CONTAINER_TONE[tone]}`}
    >
      <Icon
        aria-hidden="true"
        className={`mt-0.5 h-4 w-4 flex-shrink-0 ${priorityToneClass(
          item.priority
        )}`}
      />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-slate-800 dark:text-slate-100">
          {item.summary}
        </p>
        {href ? (
          <Link
            to={href}
            className="text-accent-600 hover:text-accent-700 dark:text-accent-400 dark:hover:text-accent-300 mt-1 inline-block font-semibold"
          >
            {label} →
          </Link>
        ) : null}
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        data-testid={testId ? `${testId}-dismiss` : undefined}
        className="-mt-0.5 -mr-0.5 shrink-0 rounded p-1 text-slate-400 transition-colors hover:bg-black/5 hover:text-slate-600 focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:outline-none dark:text-slate-500 dark:hover:bg-white/10 dark:hover:text-slate-300"
      >
        <X aria-hidden="true" className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
