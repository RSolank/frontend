import { useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { ConfirmDialog } from '../../../shared/components/ConfirmDialog';
import { useDeepLinkHighlight } from '../../../shared/hooks/useDeepLinkHighlight';
import { useRowHighlight } from '../../../shared/hooks/useRowHighlight';
import { useBeneficiariesQuery } from '../../beneficiaries/api/queries';
import { recurringKeys } from '../api/keys';
import {
  deleteRecurringTemplateRequest,
  updateRecurringTemplateRequest,
} from '../api/mutations';
import { useRecurringTemplatesQuery } from '../api/queries';
import type { RecurringTemplate } from '../api/schemas';
import { RecurringFormDialog } from '../components/RecurringFormDialog';
import { RecurringTemplateRow } from '../components/RecurringTemplateRow';
import { UpcomingBillsList } from '../components/UpcomingBillsList';

type TabKey = 'confirmed' | 'detected' | 'upcoming';

// How many detected (candidate) rows to show before the "show more" reveal.
const DETECTED_PREVIEW = 5;

// /recurring — the inference-engine surface. The worker detects patterns and
// forecasts bills; the page splits them into two tabs (B3):
//   - **Detected** — `candidate` templates the engine suggested, awaiting a
//     Confirm / Dismiss decision (capped to a preview with a "show more").
//   - **Confirmed** — everything the user already owns: `locked` (active),
//     `review` (active but flagged for attention), and paused (`inactive`).
// plus an **Upcoming** tab showing the 30-day forecast. New manual templates
// are authored via the "+ Add manually" CTA in the header.
export function RecurringPage() {
  const [tab, setTab] = useState<TabKey>('confirmed');
  const [showAllDetected, setShowAllDetected] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<RecurringTemplate | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<RecurringTemplate | null>(
    null
  );
  const highlight = useRowHighlight<string>();
  const [searchParams] = useSearchParams();

  const queryClient = useQueryClient();
  const templates = useRecurringTemplatesQuery();
  const benQuery = useBeneficiariesQuery();

  const templateParam = searchParams.get('template');
  const templatesReady = templates.data != null;

  const benData = benQuery.data;
  const benById = useMemo(() => {
    const m = new Map<number, NonNullable<typeof benData>[number]>();
    for (const b of benData ?? []) m.set(b.uid, b);
    return m;
  }, [benData]);

  const buckets = useMemo(
    () => bucketTemplates(templates.data ?? []),
    [templates.data]
  );
  const detectedCount = buckets.candidate.length;
  const confirmedCount =
    buckets.review.length + buckets.locked.length + buckets.inactive.length;

  // Default landing tab, decided once when templates first load (and only when
  // a deep-link isn't already steering it): start on Detected when there are
  // candidates awaiting a decision, otherwise the Confirmed home.
  const defaultedRef = useRef(false);
  useEffect(() => {
    if (!templatesReady || defaultedRef.current) return;
    defaultedRef.current = true;
    if (!templateParam && detectedCount > 0) setTab('detected');
  }, [templatesReady, templateParam, detectedCount]);

  // Deep-link from a transaction's recurring chip: `/recurring?template=<uid>`
  // selects the tab the target lives in (Detected for a candidate, else
  // Confirmed), expands the Detected reveal if hidden, then flashes + scrolls
  // the row. The shared hook fires once templates are loaded, then consumes
  // the param so a refresh doesn't re-flash (a fresh chip click re-targets).
  useDeepLinkHighlight({
    param: 'template',
    flash: highlight.flash,
    ready: templatesReady,
    onMatch: (uid) => {
      const target = (templates.data ?? []).find((t) => String(t.uid) === uid);
      const targetTab: TabKey =
        target?.status === 'candidate' ? 'detected' : 'confirmed';
      setTab(targetTab);
      if (targetTab === 'detected') setShowAllDetected(true);
    },
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: recurringKeys.all });
  }

  async function handleConfirm(t: RecurringTemplate) {
    await updateRecurringTemplateRequest(t.uid, { status: 'locked' });
    invalidate();
    highlight.flash(String(t.uid));
  }

  async function handleDelete(t: RecurringTemplate) {
    await deleteRecurringTemplateRequest(t.uid);
    setConfirmDelete(null);
    setEditing(null);
    invalidate();
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
            Recurring
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
            Patterns we&apos;ve detected in your transactions. Confirm the ones
            that should keep forecasting, edit anything that shifted, or dismiss
            what no longer applies.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="focus-visible:ring-accent-500 inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          data-testid="recurring-add"
        >
          <Plus size={16} aria-hidden />
          Add manually
        </button>
      </header>

      <Tabs
        tab={tab}
        onTabChange={setTab}
        detectedCount={detectedCount}
        confirmedCount={confirmedCount}
      />

      {tab === 'detected' && (
        <DetectedView
          loading={templates.isLoading}
          rows={buckets.candidate}
          showAll={showAllDetected}
          onShowAll={() => setShowAllDetected(true)}
          benById={benById}
          highlightId={highlight.id}
          onConfirm={handleConfirm}
          onEdit={setEditing}
          onDismiss={setConfirmDelete}
        />
      )}

      {tab === 'confirmed' && (
        <ConfirmedView
          loading={templates.isLoading}
          buckets={buckets}
          hasDetected={detectedCount > 0}
          benById={benById}
          highlightId={highlight.id}
          onConfirm={handleConfirm}
          onEdit={setEditing}
          onDismiss={setConfirmDelete}
        />
      )}

      {tab === 'upcoming' && (
        <section
          aria-label="Upcoming bills (30 days)"
          className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
        >
          <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
            Next 30 days
          </h2>
          <UpcomingBillsList days={30} />
        </section>
      )}

      <RecurringFormDialog
        open={adding}
        onClose={() => setAdding(false)}
        onSaved={(t) => {
          invalidate();
          highlight.flash(String(t.uid));
        }}
      />
      <RecurringFormDialog
        open={editing != null}
        template={editing}
        onClose={() => setEditing(null)}
        onSaved={(t) => {
          invalidate();
          highlight.flash(String(t.uid));
        }}
        onRequestRemove={() => editing && setConfirmDelete(editing)}
      />
      <ConfirmDialog
        open={confirmDelete != null}
        title="Dismiss recurring template?"
        message="The worker will stop forecasting this pattern. You can re-create it later if it returns."
        confirmLabel="Dismiss"
        intent="danger"
        onConfirm={() => {
          if (confirmDelete) void handleDelete(confirmDelete);
        }}
        onClose={() => setConfirmDelete(null)}
      />
    </div>
  );
}

interface TemplatesBuckets {
  review: RecurringTemplate[];
  candidate: RecurringTemplate[];
  locked: RecurringTemplate[];
  inactive: RecurringTemplate[];
}

function bucketTemplates(rows: RecurringTemplate[]): TemplatesBuckets {
  const buckets: TemplatesBuckets = {
    review: [],
    candidate: [],
    locked: [],
    inactive: [],
  };
  for (const t of rows) {
    if (!t.active) buckets.inactive.push(t);
    else if (t.status === 'review') buckets.review.push(t);
    else if (t.status === 'candidate') buckets.candidate.push(t);
    else buckets.locked.push(t);
  }
  return buckets;
}

function Tabs({
  tab,
  onTabChange,
  detectedCount,
  confirmedCount,
}: {
  tab: TabKey;
  onTabChange: (next: TabKey) => void;
  detectedCount: number;
  confirmedCount: number;
}) {
  return (
    <nav
      aria-label="Recurring view"
      className="mb-4 flex border-b border-slate-200 dark:border-slate-800"
    >
      <TabButton
        active={tab === 'detected'}
        onClick={() => onTabChange('detected')}
        label="Detected"
        count={detectedCount}
        testid="recurring-tab-detected"
      />
      <TabButton
        active={tab === 'confirmed'}
        onClick={() => onTabChange('confirmed')}
        label="Confirmed"
        count={confirmedCount}
        testid="recurring-tab-confirmed"
      />
      <TabButton
        active={tab === 'upcoming'}
        onClick={() => onTabChange('upcoming')}
        label="Upcoming"
        testid="recurring-tab-upcoming"
      />
    </nav>
  );
}

function TabButton({
  active,
  onClick,
  label,
  count,
  testid,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
  testid: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testid}
      aria-current={active ? 'page' : undefined}
      className={[
        '-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors',
        active
          ? 'border-accent-600 text-accent-700 dark:border-accent-400 dark:text-accent-300'
          : 'hover:text-accent-700 dark:hover:text-accent-300 border-transparent text-slate-600 dark:text-slate-300',
        'focus-visible:ring-accent-500 rounded-sm focus-visible:ring-2 focus-visible:outline-none',
      ].join(' ')}
    >
      {label}
      {count != null && count > 0 && (
        <span className="ml-1.5 text-xs font-normal text-slate-400 dark:text-slate-500">
          {count}
        </span>
      )}
    </button>
  );
}

type BenById = Map<
  number,
  NonNullable<ReturnType<typeof useBeneficiariesQuery>['data']>[number]
>;

interface RowHandlers {
  benById: BenById;
  highlightId: string | null;
  onConfirm: (t: RecurringTemplate) => void;
  onEdit: (t: RecurringTemplate) => void;
  onDismiss: (t: RecurringTemplate) => void;
}

function LoadingNote() {
  return (
    <p className="text-sm text-slate-500" data-testid="recurring-templates-loading">
      Loading templates…
    </p>
  );
}

// --- Detected tab: candidate suggestions with a "show more" reveal ---------

interface DetectedViewProps extends RowHandlers {
  loading: boolean;
  rows: RecurringTemplate[];
  showAll: boolean;
  onShowAll: () => void;
}

function DetectedView({
  loading,
  rows,
  showAll,
  onShowAll,
  benById,
  highlightId,
  onConfirm,
  onEdit,
  onDismiss,
}: DetectedViewProps) {
  if (loading) return <LoadingNote />;
  if (rows.length === 0)
    return (
      <p
        data-testid="recurring-empty"
        className="rounded-md border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400"
      >
        Nothing detected yet. Once the engine spots a recurring pattern across a
        few of your transactions, it will surface here for confirmation.
      </p>
    );

  const visible = showAll ? rows : rows.slice(0, DETECTED_PREVIEW);
  const hidden = rows.length - visible.length;

  return (
    <section aria-label="Detected" className="flex flex-col gap-2">
      <ul className="flex flex-col gap-2">
        {visible.map((t) => (
          <RecurringTemplateRow
            key={t.uid}
            template={t}
            beneficiaryById={benById}
            highlighted={highlightId === String(t.uid)}
            onConfirm={() => onConfirm(t)}
            onEdit={() => onEdit(t)}
            onDismiss={() => onDismiss(t)}
          />
        ))}
      </ul>
      {hidden > 0 && (
        <button
          type="button"
          onClick={onShowAll}
          data-testid="recurring-detected-show-more"
          className="focus-visible:ring-accent-500 self-start rounded-md px-2 py-1 text-sm font-medium text-slate-600 hover:text-slate-900 focus-visible:ring-2 focus-visible:outline-none dark:text-slate-300 dark:hover:text-slate-100"
        >
          Show {hidden} more
        </button>
      )}
    </section>
  );
}

// --- Confirmed tab: everything the user owns (active / review / paused) -----

interface ConfirmedViewProps extends RowHandlers {
  loading: boolean;
  buckets: TemplatesBuckets;
  hasDetected: boolean;
}

function ConfirmedView({
  loading,
  buckets,
  hasDetected,
  benById,
  highlightId,
  onConfirm,
  onEdit,
  onDismiss,
}: ConfirmedViewProps) {
  if (loading) return <LoadingNote />;

  const total =
    buckets.review.length + buckets.locked.length + buckets.inactive.length;
  if (total === 0)
    return (
      <p
        data-testid="recurring-empty"
        className="rounded-md border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400"
      >
        {hasDetected
          ? 'No confirmed templates yet. Confirm a detected pattern and it will keep forecasting here.'
          : 'Nothing detected yet. Once the engine spots a recurring pattern across a few of your transactions, it will surface here for confirmation.'}
      </p>
    );

  return (
    <div className="flex flex-col gap-6">
      <Bucket
        title="Needs attention"
        tone="warning"
        rows={buckets.review}
        benById={benById}
        highlightId={highlightId}
        onConfirm={onConfirm}
        onEdit={onEdit}
        onDismiss={onDismiss}
      />
      <Bucket
        title="Confirmed"
        rows={buckets.locked}
        benById={benById}
        highlightId={highlightId}
        onEdit={onEdit}
        onDismiss={onDismiss}
      />
      <Bucket
        title="Paused"
        rows={buckets.inactive}
        benById={benById}
        highlightId={highlightId}
        onEdit={onEdit}
        onDismiss={onDismiss}
      />
    </div>
  );
}

interface BucketProps {
  title: string;
  tone?: 'default' | 'warning';
  rows: RecurringTemplate[];
  benById: BenById;
  highlightId: string | null;
  onConfirm?: (t: RecurringTemplate) => void;
  onEdit: (t: RecurringTemplate) => void;
  onDismiss: (t: RecurringTemplate) => void;
}

function Bucket({
  title,
  tone = 'default',
  rows,
  benById,
  highlightId,
  onConfirm,
  onEdit,
  onDismiss,
}: BucketProps) {
  if (rows.length === 0) return null;
  const titleClass =
    tone === 'warning'
      ? 'text-amber-700 dark:text-amber-400'
      : 'text-slate-700 dark:text-slate-200';
  return (
    <section aria-label={title}>
      <h2 className={`mb-2 text-sm font-semibold ${titleClass}`}>
        {title}{' '}
        <span className="text-xs font-normal text-slate-500">
          ({rows.length})
        </span>
      </h2>
      <ul className="flex flex-col gap-2">
        {rows.map((t) => (
          <RecurringTemplateRow
            key={t.uid}
            template={t}
            beneficiaryById={benById}
            highlighted={highlightId === String(t.uid)}
            onConfirm={
              onConfirm && t.status !== 'locked' ? () => onConfirm(t) : undefined
            }
            onEdit={() => onEdit(t)}
            onDismiss={() => onDismiss(t)}
          />
        ))}
      </ul>
    </section>
  );
}
