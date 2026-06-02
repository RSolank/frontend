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
import { useNavigate } from 'react-router-dom';

import { usePreferencesStore } from '../../../shared/state/preferences.store';
import { formatRelativeTime } from '../../../shared/utils/dateUtils';
import { markActivitySeenRequest } from '../api/mutations';
import { useActivityFeedQuery } from '../api/queries';
import type { ActivityEvent } from '../api/schemas';

// BE Phase 2.4 (`77cffb3`) — cross-feature activity feed widget.
//
// Renders the most recent backend / worker-originated events (bill
// generated, budget breached, statement import failed, …). The list
// is server-ordered by `value` (a decay/escalation score) — never
// re-sort client-side. The widget fires `POST /seen` with
// `signal=soft` once per event_id per session on first render (BE
// dedupes per cycle so it's safe), and with `signal=hard` on click
// (escalate-or-dead, persists until source resolves).
//
// FE composes its own deep-link from `subject_type` + `subject_id`
// — BE owns no FE routes (handoff spec §activity.feed).
const FEED_LIMIT = 10;

export function RecentActivityWidget() {
  const timezone = usePreferencesStore((s) => s.timezone);
  const navigate = useNavigate();
  const query = useActivityFeedQuery(FEED_LIMIT);

  const events = query.data?.events ?? [];

  // `now` ticks once a minute so the relative-time column reads
  // freshly without spamming re-renders.
  const now = useTickingNow(60_000);

  useSoftAck(events);

  if (query.isLoading) return <WidgetShell><LoadingState /></WidgetShell>;
  if (query.isError) return <WidgetShell><ErrorState /></WidgetShell>;
  if (events.length === 0) return <WidgetShell><EmptyState /></WidgetShell>;

  return (
    <WidgetShell>
      <ul className="flex flex-col gap-2" data-testid="dashboard-activity-list">
        {events.map((e) => (
          <ActivityRow
            key={e.event_id}
            event={e}
            now={now}
            timezone={timezone}
            onActivate={() => handleClick(e, navigate)}
          />
        ))}
      </ul>
    </WidgetShell>
  );
}

function WidgetShell({ children }: { children: React.ReactNode }) {
  return (
    <section
      data-testid="dashboard-activity"
      aria-labelledby="activity-heading"
      className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <header className="mb-2 flex items-center justify-between">
        <h3
          id="activity-heading"
          className="text-sm font-semibold text-slate-900 dark:text-slate-100"
        >
          Recent activity
        </h3>
      </header>
      {children}
    </section>
  );
}

function LoadingState() {
  return (
    <p className="text-xs text-slate-500 dark:text-slate-400">
      Loading activity…
    </p>
  );
}

function ErrorState() {
  return (
    <p className="text-xs text-slate-500 dark:text-slate-400">
      Couldn&apos;t load activity. We&apos;ll retry shortly.
    </p>
  );
}

function EmptyState() {
  return (
    <p className="text-xs text-slate-500 dark:text-slate-400">
      Nothing to see yet — bills, breaches, and import notifications
      will land here.
    </p>
  );
}

function ActivityRow({
  event,
  now,
  timezone,
  onActivate,
}: {
  event: ActivityEvent;
  now: number;
  timezone: string;
  onActivate: () => void;
}) {
  const Icon = iconForKind(event.kind);
  const tone = toneForPriority(event.priority);
  return (
    <li>
      <button
        type="button"
        onClick={onActivate}
        className="group flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none dark:hover:bg-slate-800 dark:focus-visible:bg-slate-800"
        data-event-id={event.event_id}
      >
        <Icon
          aria-hidden="true"
          className={`mt-0.5 h-4 w-4 flex-shrink-0 ${tone}`}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-slate-800 dark:text-slate-100">
            {event.summary}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {formatRelativeTime(event.at, now, timezone)}
          </p>
        </div>
      </button>
    </li>
  );
}

// Lucide icon per event kind. Unknown kinds get a generic bell so
// new BE-side kinds don't break the widget.
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

function toneForPriority(p: 1 | 2 | 3): string {
  if (p === 1) return 'text-danger-500 dark:text-danger-400';
  if (p === 2) return 'text-warning-500 dark:text-warning-400';
  return 'text-slate-400 dark:text-slate-500';
}

// FE composes its own deep-link from `subject_type` + `subject_id`.
// Unknown subjects fall through to a no-op (still fires the hard ACK
// so the BE knows the user engaged).
function handleClick(
  event: ActivityEvent,
  navigate: ReturnType<typeof useNavigate>
) {
  // Fire-and-forget hard ACK; ignore failures (the widget's render-time
  // soft ACK already counted exposure).
  void markActivitySeenRequest({
    events: [event.event_id],
    signal: 'hard',
  }).catch(() => undefined);
  const target = deepLinkFor(event);
  if (target) navigate(target);
}

function deepLinkFor(event: ActivityEvent): string | null {
  if (event.subject_type === 'bill') {
    return `/consumption-tax?bill=${event.subject_id}`;
  }
  if (event.subject_type === 'budget') {
    return `/budgets`;
  }
  if (event.subject_type === 'statement_upload') {
    return `/transactions?upload=${event.subject_id}`;
  }
  if (event.subject_type === 'recurring') {
    return `/transactions`;
  }
  return null;
}

// Once-per-session tracker of soft-acked events. Lives outside React
// state — the widget remounts on every navigation, but the BE dedupes
// soft signals per cycle, so a per-session set is the right granularity.
const SOFT_ACKED = new Set<string>();

function useSoftAck(events: ActivityEvent[]) {
  useEffect(() => {
    const fresh = events
      .map((e) => e.event_id)
      .filter((id) => !SOFT_ACKED.has(id));
    if (fresh.length === 0) return;
    fresh.forEach((id) => SOFT_ACKED.add(id));
    void markActivitySeenRequest({ events: fresh, signal: 'soft' }).catch(() =>
      undefined
    );
  }, [events]);
}

function useTickingNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  const ref = useRef(now);
  ref.current = now;
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return useMemo(() => now, [now]);
}

// Internal testing hook — let tests clear the soft-ack memo between
// runs so handler counts reset. Not exported as public API.
export function __resetActivitySoftAckForTests() {
  SOFT_ACKED.clear();
}
