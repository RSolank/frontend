import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { TagDiffPreview } from '../../../shared/components/TagDiffPreview';
import { formatBillDate } from '../api/billPeriod';
import type {
  AdjustmentDiff,
  AdjustmentTagRef,
  BillItem,
} from '../api/queries';

// T-tax-adjustment-transparency — historical edits to past BILLED bills post a
// per-txn correction onto the current ACCRUING bill (Decision 23). Each renders
// as a CHANGE-DRIVEN before→after diff: only the fields that actually drove the
// adjustment appear; the txn's unchanged context lives on the card header.
//
// Progressive disclosure by VOLUME: a node collapses to a single drill-down row
// when it has more than DISCLOSURE_THRESHOLD children — applied at the section
// level (children = source bills) and the bill level (children = corrections).
// So a low-volume bill shows its diffs inline; a bulk rule change that touches
// many frozen weeks collapses into a handful of expandable summaries.
const DISCLOSURE_THRESHOLD = 3;

const cap = (s?: string | null) =>
  s ? s.charAt(0).toUpperCase() + s.slice(1) : '—';

const pct = (r?: number | null) =>
  r == null ? '—' : `${Math.round(r * 1000) / 10}%`;

type BillGrouping = { billId: number | null; items: BillItem[]; net: number };

function groupByBill(items: BillItem[]): BillGrouping[] {
  const map = new Map<number | null, BillItem[]>();
  for (const it of items) {
    const k = it.adjustment_for_bill_id ?? null;
    const arr = map.get(k) ?? [];
    arr.push(it);
    map.set(k, arr);
  }
  return [...map.entries()].map(([billId, its]) => ({
    billId,
    items: its,
    net: its.reduce((s, i) => s + (i.tax_amount ?? 0), 0),
  }));
}

function reasonFor(diff: AdjustmentDiff): string {
  if (!diff.after) return diff.txn_alive ? 'No longer taxed' : 'Deleted';
  if (!diff.before) return 'Added';
  if (diff.added_tags.length > 0 || diff.removed_tags.length > 0)
    return 'Recategorized';
  return 'Amount adjusted';
}

function resolver(...groups: AdjustmentTagRef[][]): (id: number) => string {
  const map = new Map<number, string>();
  for (const g of groups)
    for (const r of g) map.set(r.tag_id, r.name ?? `#${r.tag_id}`);
  return (id) => map.get(id) ?? `#${id}`;
}

function NetDelta({
  value,
  money,
}: {
  value: number;
  money: (n: number | null | undefined) => string;
}) {
  const positive = value >= 0;
  return (
    <span
      className={`money text-sm font-semibold tabular-nums ${
        positive
          ? 'text-warning-700 dark:text-warning-300'
          : 'text-success-700 dark:text-success-300'
      }`}
    >
      {positive ? '+' : ''}
      {money(value)}
    </span>
  );
}

function FieldDelta({
  label,
  before,
  after,
}: {
  label: string;
  before: ReactNode;
  after: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-28 shrink-0 text-slate-500 dark:text-slate-400">
        {label}
      </span>
      <span className="text-slate-400 line-through dark:text-slate-500">
        {before}
      </span>
      <span aria-hidden="true" className="text-slate-400">
        →
      </span>
      <span className="font-medium text-slate-800 dark:text-slate-100">
        {after}
      </span>
    </div>
  );
}

function CardHeader({
  item,
  money,
  timezone,
}: {
  item: BillItem;
  money: (n: number | null | undefined) => string;
  timezone: string;
}) {
  return (
    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <span className="font-medium text-slate-800 dark:text-slate-100">
          {item.beneficiary ?? 'Transaction'}
        </span>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {formatBillDate(item.date, timezone)}
        </span>
        <span className="bg-warning-100 text-warning-800 dark:bg-warning-950/50 dark:text-warning-300 rounded-full px-2 py-0.5 text-xs font-medium">
          {item.diff ? reasonFor(item.diff) : 'Adjustment'}
        </span>
      </div>
      <NetDelta value={item.tax_amount ?? 0} money={money} />
    </div>
  );
}

function DiffBody({
  diff,
  money,
}: {
  diff: AdjustmentDiff;
  money: (n: number | null | undefined) => string;
}) {
  const before = diff.before ?? null;
  const after = diff.after ?? null;
  // Change-driven: a block renders only when that field actually changed.
  const changed = (pick: (s: NonNullable<typeof before>) => unknown) =>
    !!before && !!after && pick(before) !== pick(after);

  return (
    <div className="space-y-1.5">
      {changed((s) => s.amount) && (
        <FieldDelta
          label="Amount"
          before={money(before?.amount)}
          after={money(after?.amount)}
        />
      )}
      {changed((s) => s.txn_type) && (
        <FieldDelta
          label="Type"
          before={cap(before?.txn_type)}
          after={cap(after?.txn_type)}
        />
      )}
      {changed((s) => s.applied_rate) && (
        <FieldDelta
          label="Tax rate"
          before={pct(before?.applied_rate)}
          after={pct(after?.applied_rate)}
        />
      )}
      <FieldDelta
        label="Tax"
        before={money(before?.tax_amount ?? 0)}
        after={
          after ? (
            money(after.tax_amount)
          ) : (
            <span className="text-success-700 dark:text-success-300">
              Removed
            </span>
          )
        }
      />
      <TagDiffPreview
        added={diff.added_tags.map((t) => t.tag_id)}
        removed={diff.removed_tags.map((t) => t.tag_id)}
        resolveLabel={resolver(diff.added_tags, diff.removed_tags)}
        title="Tag changes"
      />
    </div>
  );
}

function AdjustmentCard({
  item,
  money,
  timezone,
}: {
  item: BillItem;
  money: (n: number | null | undefined) => string;
  timezone: string;
}) {
  return (
    <li
      data-testid="bill-adjustment-card"
      className="border-warning-200 dark:border-warning-900/40 rounded-md border px-3 py-2.5"
    >
      <CardHeader item={item} money={money} timezone={timezone} />
      {item.diff && <DiffBody diff={item.diff} money={money} />}
    </li>
  );
}

function CardList({
  items,
  money,
  timezone,
}: {
  items: BillItem[];
  money: (n: number | null | undefined) => string;
  timezone: string;
}) {
  return (
    <ul className="space-y-2">
      {items.map((it, idx) => (
        <AdjustmentCard
          key={`adj-${it.adjustment_for_bill_id ?? 0}-${idx}`}
          item={it}
          money={money}
          timezone={timezone}
        />
      ))}
    </ul>
  );
}

function billLabel(group: BillGrouping): string {
  const n = group.items.length;
  const where = group.billId != null ? `Bill #${group.billId}` : 'a past bill';
  return `From ${where} · ${n} correction${n === 1 ? '' : 's'}`;
}

function BillGroup({
  group,
  collapsed,
  money,
  timezone,
}: {
  group: BillGrouping;
  // Section-wide, all-or-none: when ANY bill in the section is busy (> threshold
  // corrections), EVERY bill collapses together, so siblings render uniformly
  // (no sandwiched odd-one-out). Decided by the parent, not per-bill.
  collapsed: boolean;
  money: (n: number | null | undefined) => string;
  timezone: string;
}) {
  const [open, setOpen] = useState(!collapsed);

  if (!collapsed) {
    return (
      <div data-testid="bill-adjustment-group">
        <div className="flex items-center justify-between gap-2 px-1 py-1.5">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
            {billLabel(group)}
          </span>
          <NetDelta value={group.net} money={money} />
        </div>
        <CardList items={group.items} money={money} timezone={timezone} />
      </div>
    );
  }

  return (
    <div data-testid="bill-adjustment-group">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-md px-1 py-1.5 text-left hover:bg-slate-50 dark:hover:bg-slate-900/40"
      >
        <span className="flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">
          {open ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          {billLabel(group)}
        </span>
        <NetDelta value={group.net} money={money} />
      </button>
      {open && (
        <div className="mt-1.5">
          <CardList items={group.items} money={money} timezone={timezone} />
        </div>
      )}
    </div>
  );
}

export function AdjustmentDiffList({
  items,
  money,
  timezone,
}: {
  items: BillItem[];
  money: (n: number | null | undefined) => string;
  timezone: string;
}) {
  const groups = groupByBill(items);
  const net = groups.reduce((s, g) => s + g.net, 0);
  const collapseSection = groups.length > DISCLOSURE_THRESHOLD;
  // All-or-none at the bill level: one busy bill collapses every bill with it.
  const collapseBills = groups.some(
    (g) => g.items.length > DISCLOSURE_THRESHOLD
  );
  const [open, setOpen] = useState(!collapseSection);

  return (
    <section data-testid="bill-adjustments">
      {collapseSection ? (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex w-full items-center justify-between gap-2 py-1 text-left"
        >
          <span className="text-warning-700 dark:text-warning-300 flex items-center gap-1.5 text-sm font-semibold">
            {open ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            Adjustments (from past bills) · {groups.length} bills
          </span>
          <NetDelta value={net} money={money} />
        </button>
      ) : (
        <h4 className="text-warning-700 dark:text-warning-300 mb-2 text-sm font-semibold">
          Adjustments (from past bills)
        </h4>
      )}

      {open && (
        <>
          <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
            Edits to transactions from past finalized bills land here as
            corrections — the original bill isn&apos;t mutated, and the penalty on
            a closed week stays frozen, so these are base-tax changes only.
          </p>
          <div className="space-y-2">
            {groups.map((g) => (
              <BillGroup
                key={`adjgroup-${g.billId ?? 'none'}`}
                group={g}
                collapsed={collapseBills}
                money={money}
                timezone={timezone}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
