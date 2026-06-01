import { useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';

import { ConfirmDialog } from '../../../shared/components/ConfirmDialog';
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

type TabKey = 'templates' | 'upcoming';

// /recurring — the inference-engine surface. The worker detects
// patterns and forecasts bills; this page exposes the templates with
// "Detected" / "Needs attention" / "Confirmed" status chips, plus
// Confirm / Edit / Dismiss action clusters and an "Upcoming" tab that
// shows the 30-day forecast. New manual templates are authored via
// the "+ Add manually" CTA in the header (secondary by UX choice).
export function RecurringPage() {
  const [tab, setTab] = useState<TabKey>('templates');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<RecurringTemplate | null>(null);
  const [confirmDelete, setConfirmDelete] =
    useState<RecurringTemplate | null>(null);
  const highlight = useRowHighlight<string>();

  const queryClient = useQueryClient();
  const templates = useRecurringTemplatesQuery();
  const benQuery = useBeneficiariesQuery();

  const benData = benQuery.data;
  const benById = useMemo(() => {
    const m = new Map<number, NonNullable<typeof benData>[number]>();
    for (const b of benData ?? []) m.set(b.uid, b);
    return m;
  }, [benData]);

  const buckets = useMemo(() => bucketTemplates(templates.data ?? []), [
    templates.data,
  ]);

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
            Patterns we&apos;ve detected in your transactions. Confirm
            the ones that should keep forecasting, edit anything that
            shifted, or dismiss what no longer applies.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          data-testid="recurring-add"
        >
          <Plus size={16} aria-hidden />
          Add manually
        </button>
      </header>

      <Tabs tab={tab} onTabChange={setTab} />

      {tab === 'templates' ? (
        <TemplatesView
          loading={templates.isLoading}
          buckets={buckets}
          benById={benById}
          highlightId={highlight.id}
          onConfirm={handleConfirm}
          onEdit={setEditing}
          onDismiss={setConfirmDelete}
        />
      ) : (
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
}: {
  tab: TabKey;
  onTabChange: (next: TabKey) => void;
}) {
  return (
    <nav
      aria-label="Recurring view"
      className="mb-4 flex border-b border-slate-200 dark:border-slate-800"
    >
      <TabButton
        active={tab === 'templates'}
        onClick={() => onTabChange('templates')}
        label="Templates"
        testid="recurring-tab-templates"
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
  testid,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  testid: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testid}
      aria-current={active ? 'page' : undefined}
      className={[
        'border-b-2 -mb-px px-4 py-2 text-sm font-medium transition-colors',
        active
          ? 'border-indigo-600 text-indigo-700 dark:border-indigo-400 dark:text-indigo-300'
          : 'border-transparent text-slate-600 hover:text-indigo-700 dark:text-slate-300 dark:hover:text-indigo-300',
        'focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none rounded-sm',
      ].join(' ')}
    >
      {label}
    </button>
  );
}

interface TemplatesViewProps {
  loading: boolean;
  buckets: TemplatesBuckets;
  benById: Map<number, NonNullable<ReturnType<typeof useBeneficiariesQuery>['data']>[number]>;
  highlightId: string | null;
  onConfirm: (t: RecurringTemplate) => void;
  onEdit: (t: RecurringTemplate) => void;
  onDismiss: (t: RecurringTemplate) => void;
}

function TemplatesView({
  loading,
  buckets,
  benById,
  highlightId,
  onConfirm,
  onEdit,
  onDismiss,
}: TemplatesViewProps) {
  if (loading)
    return (
      <p
        className="text-sm text-slate-500"
        data-testid="recurring-templates-loading"
      >
        Loading templates…
      </p>
    );

  const total =
    buckets.review.length +
    buckets.candidate.length +
    buckets.locked.length +
    buckets.inactive.length;

  if (total === 0)
    return (
      <p
        data-testid="recurring-empty"
        className="rounded-md border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400"
      >
        Nothing detected yet. Once the engine spots a recurring pattern
        across a few of your transactions, it will surface here for
        confirmation.
      </p>
    );

  return (
    <div className="flex flex-col gap-6">
      <Bucket
        title="Needs attention"
        rows={buckets.review}
        benById={benById}
        highlightId={highlightId}
        onConfirm={onConfirm}
        onEdit={onEdit}
        onDismiss={onDismiss}
      />
      <Bucket
        title="Detected"
        rows={buckets.candidate}
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
        title="Inactive"
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
  rows: RecurringTemplate[];
  benById: TemplatesViewProps['benById'];
  highlightId: string | null;
  onConfirm?: (t: RecurringTemplate) => void;
  onEdit: (t: RecurringTemplate) => void;
  onDismiss: (t: RecurringTemplate) => void;
}

function Bucket({
  title,
  rows,
  benById,
  highlightId,
  onConfirm,
  onEdit,
  onDismiss,
}: BucketProps) {
  if (rows.length === 0) return null;
  return (
    <section aria-label={title}>
      <h2 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
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
              onConfirm && t.status !== 'locked'
                ? () => onConfirm(t)
                : undefined
            }
            onEdit={() => onEdit(t)}
            onDismiss={() => onDismiss(t)}
          />
        ))}
      </ul>
    </section>
  );
}
