import { ChevronLeft, ChevronRight, TrendingUp } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';

import { formatMoney } from '../../../shared/utils/currency';
import {
  bucketByDay,
  buildMonthGrid,
  buildWeekRow,
  heatBucket,
  monthKeyFromIso,
  shiftIso,
  shiftMonthKey,
  todayIsoInTz,
  type CalendarCell,
  type DayBucket,
} from '../api/calendar';
import type { TransactionDTO } from '../api/schemas';

// Calendar view of /transactions. Two responsive shapes:
//   * Desktop (≥ lg): full month grid, 7×6 (42 cells). Includes the
//     previous-month tail and the next-month head so the grid stays
//     rectangular. Prev / next month arrows; "Today" jump button.
//   * Mobile (< lg): single ISO week (7 cells in one row), swipeable
//     prev / next week.
//
// Heat-map shading: per-cell background tint scales with the day's
// debit total relative to the displayed-range max (quartile buckets).
// Today carries an extra indigo accent on top of the heat color.
//
// Keyboard nav: arrow keys move the focused day; Enter / Space opens
// the day flyout. Per a11y contract in CONTRIBUTING.md §6.

const HEAT_BG: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: 'bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800',
  1: 'bg-indigo-50/60 hover:bg-indigo-100 dark:bg-indigo-950/30 dark:hover:bg-indigo-950/50',
  2: 'bg-indigo-100/80 hover:bg-indigo-200 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/60',
  3: 'bg-indigo-200/80 hover:bg-indigo-300 dark:bg-indigo-900/60 dark:hover:bg-indigo-900/80',
  4: 'bg-indigo-300/80 hover:bg-indigo-400 dark:bg-indigo-800/80 dark:hover:bg-indigo-800',
};

// ISO 8601 Mon → Sun matches the project-wide week convention
// (CONTRIBUTING.md §6 + `features/taxation/api/billPeriod.ts`). Users
// see the same week orientation in the transactions browser and the
// bill-generation week picker — no re-translation between surfaces.
const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface CalendarViewProps {
  transactions: TransactionDTO[];
  timezone: string;
  currencyCode: string;
  currencySymbol: string | null;
  // Month being displayed (`YYYY-MM`). Caller-owned so the parent can
  // co-ordinate the API `month=` filter.
  monthKey: string;
  onMonthChange: (next: string) => void;
  // Anchor for the mobile weekly view (`YYYY-MM-DD`). Caller-owned;
  // typically initialised to "today" then mutated by swipe arrows.
  weekAnchorIso: string;
  onWeekAnchorChange: (next: string) => void;
  // Focused cell for keyboard nav. Caller-owned so the focus jumps
  // remain stable when the flyout opens (focus moves into the
  // flyout, focused cell stays).
  focusedIso: string | null;
  onFocusedIsoChange: (next: string | null) => void;
  // Click → open day flyout.
  onDaySelect: (iso: string) => void;
  // Loading flag so the grid can show a skeleton without unmounting.
  isLoading?: boolean;
}

function monthTitle(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(Date.UTC(y as number, (m as number) - 1, 1, 12));
  return new Intl.DateTimeFormat(undefined, {
    timeZone: 'UTC',
    month: 'long',
    year: 'numeric',
  }).format(d);
}

function weekTitle(cells: CalendarCell[]): string {
  if (cells.length === 0) return '';
  const first = cells[0]!;
  const last = cells[6]!;
  const sameMonth = first.month === last.month && first.year === last.year;
  const sFmt = new Intl.DateTimeFormat(undefined, {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
  });
  const eFmt = new Intl.DateTimeFormat(undefined, {
    timeZone: 'UTC',
    month: sameMonth ? undefined : 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const sIso = new Date(Date.UTC(first.year, first.month - 1, first.day, 12));
  const eIso = new Date(Date.UTC(last.year, last.month - 1, last.day, 12));
  return `${sFmt.format(sIso)} – ${eFmt.format(eIso)}`;
}

interface CalendarCellButtonProps {
  cell: CalendarCell;
  bucket: DayBucket | undefined;
  heat: 0 | 1 | 2 | 3 | 4;
  focused: boolean;
  currencyCode: string;
  currencySymbol: string | null;
  onClick: () => void;
  onFocus: () => void;
  // Tabindex contract: only the focused cell is tabbable so arrow-
  // navigation is the primary path inside the grid; Tab exits to the
  // surrounding chrome.
  tabIndex: number;
  // Optional class extension for the mobile single-row layout.
  className?: string;
}

function CalendarCellButton({
  cell,
  bucket,
  heat,
  focused,
  currencyCode,
  currencySymbol,
  onClick,
  onFocus,
  tabIndex,
  className,
}: CalendarCellButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (focused && ref.current) {
      // Defer focus by a tick so navigating before the day flyout
      // mounts doesn't fight Radix's focus-trap.
      const id = window.setTimeout(() => ref.current?.focus(), 0);
      return () => window.clearTimeout(id);
    }
    return undefined;
  }, [focused]);

  const dim = !cell.inMonth;
  const debit = bucket?.debit_total ?? 0;
  const credit = bucket?.credit_total ?? 0;
  const hasActivity = debit > 0 || credit > 0;

  return (
    <button
      ref={ref}
      type="button"
      role="gridcell"
      onClick={onClick}
      onFocus={onFocus}
      tabIndex={tabIndex}
      aria-label={`${cell.iso}${
        hasActivity
          ? `, ${formatMoney(debit, currencyCode, currencySymbol)} debit${
              credit > 0
                ? ` and ${formatMoney(credit, currencyCode, currencySymbol)} credit`
                : ''
            }`
          : ', no transactions'
      }${cell.isToday ? ', today' : ''}`}
      aria-current={cell.isToday ? 'date' : undefined}
      className={`group flex min-h-[5.5rem] flex-col items-stretch gap-1 rounded-md border border-transparent px-2 py-1.5 text-left transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none ${
        HEAT_BG[heat]
      } ${
        cell.isToday
          ? 'ring-2 ring-indigo-500 dark:ring-indigo-400'
          : 'ring-1 ring-slate-200 dark:ring-slate-800'
      } ${
        dim ? 'opacity-50' : ''
      } ${className ?? ''}`}
    >
      <span className="flex items-center justify-between text-xs font-semibold">
        <span
          className={
            cell.isToday
              ? 'text-indigo-700 dark:text-indigo-300'
              : 'text-slate-600 dark:text-slate-300'
          }
        >
          {cell.day}
        </span>
        {credit > 0 && (
          <span
            title="Credit on this day"
            className="inline-flex items-center text-emerald-600 dark:text-emerald-400"
            aria-hidden="true"
          >
            <TrendingUp size={12} />
          </span>
        )}
      </span>
      {debit > 0 ? (
        <span className="money mt-auto text-sm font-bold text-rose-600 dark:text-rose-400">
          -{formatMoney(debit, currencyCode, currencySymbol)}
        </span>
      ) : credit > 0 ? (
        <span className="money mt-auto text-sm font-bold text-emerald-600 dark:text-emerald-400">
          +{formatMoney(credit, currencyCode, currencySymbol)}
        </span>
      ) : (
        <span className="mt-auto text-xs text-slate-400 dark:text-slate-600">
          —
        </span>
      )}
    </button>
  );
}

export function CalendarView({
  transactions,
  timezone,
  currencyCode,
  currencySymbol,
  monthKey,
  onMonthChange,
  weekAnchorIso,
  onWeekAnchorChange,
  focusedIso,
  onFocusedIsoChange,
  onDaySelect,
  isLoading,
}: CalendarViewProps) {
  const todayIso = useMemo(() => todayIsoInTz(timezone), [timezone]);

  const monthCells = useMemo(
    () => buildMonthGrid(monthKey, todayIso),
    [monthKey, todayIso]
  );
  const weekCells = useMemo(
    () => buildWeekRow(weekAnchorIso, todayIso),
    [weekAnchorIso, todayIso]
  );

  const buckets = useMemo(
    () => bucketByDay(transactions, timezone),
    [transactions, timezone]
  );

  // Heat-map normalisation — max debit total across cells currently
  // visible on the desktop month grid. Recomputed when the month
  // changes; mobile single-week uses the same scale so swipe to a
  // quiet week doesn't suddenly recolor a different palette.
  const heatMax = useMemo(() => {
    let max = 0;
    for (const c of monthCells) {
      const b = buckets.get(c.iso);
      if (b && b.debit_total > max) max = b.debit_total;
    }
    return max;
  }, [monthCells, buckets]);

  // Keyboard navigation. Arrow keys move the focused cell; Enter /
  // Space opens the day flyout. Bound at the grid level so the cells
  // themselves stay clickable without competing handlers.
  function onGridKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (!focusedIso) return;
    let delta: number | null = null;
    switch (e.key) {
      case 'ArrowLeft':
        delta = -1;
        break;
      case 'ArrowRight':
        delta = 1;
        break;
      case 'ArrowUp':
        delta = -7;
        break;
      case 'ArrowDown':
        delta = 7;
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        onDaySelect(focusedIso);
        return;
      default:
        return;
    }
    e.preventDefault();
    const next = shiftIso(focusedIso, delta);
    onFocusedIsoChange(next);
    // Auto-page when the cursor steps outside the month / week.
    const nextMonth = monthKeyFromIso(next);
    if (nextMonth !== monthKey) onMonthChange(nextMonth);
    // For the mobile week view, re-anchor when the focus leaves the
    // currently-displayed week. weekRangeInTz contains the row.
    if (!weekCells.some((c) => c.iso === next)) {
      onWeekAnchorChange(next);
    }
  }

  return (
    <div
      className="overflow-hidden rounded-xl bg-white shadow-sm dark:bg-slate-900 dark:shadow-none dark:ring-1 dark:ring-slate-800"
      aria-busy={isLoading || undefined}
    >
      {/* Desktop header (month nav) */}
      <div className="hidden items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3 lg:flex dark:border-slate-800 dark:bg-slate-900/60">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => onMonthChange(shiftMonthKey(monthKey, -1))}
            className="rounded-md border border-slate-300 bg-white p-1.5 text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <ChevronLeft size={16} aria-hidden />
          </button>
          <h2 className="px-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
            {monthTitle(monthKey)}
          </h2>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => onMonthChange(shiftMonthKey(monthKey, 1))}
            className="rounded-md border border-slate-300 bg-white p-1.5 text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <ChevronRight size={16} aria-hidden />
          </button>
        </div>
        <button
          type="button"
          onClick={() => {
            onMonthChange(monthKeyFromIso(todayIso));
            onFocusedIsoChange(todayIso);
          }}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Today
        </button>
      </div>

      {/* Mobile header (week nav) */}
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3 lg:hidden dark:border-slate-800 dark:bg-slate-900/60">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Previous week"
            onClick={() => onWeekAnchorChange(shiftIso(weekAnchorIso, -7))}
            className="rounded-md border border-slate-300 bg-white p-1.5 text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <ChevronLeft size={16} aria-hidden />
          </button>
          <h2 className="px-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
            {weekTitle(weekCells)}
          </h2>
          <button
            type="button"
            aria-label="Next week"
            onClick={() => onWeekAnchorChange(shiftIso(weekAnchorIso, 7))}
            className="rounded-md border border-slate-300 bg-white p-1.5 text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <ChevronRight size={16} aria-hidden />
          </button>
        </div>
        <button
          type="button"
          onClick={() => {
            onWeekAnchorChange(todayIso);
            onFocusedIsoChange(todayIso);
          }}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Today
        </button>
      </div>

      {/* Desktop month grid */}
      <div
        role="grid"
        aria-label="Transaction calendar — month view"
        onKeyDown={onGridKeyDown}
        className="hidden p-3 lg:block"
      >
        <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
          {WEEKDAY_LABELS.map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {monthCells.map((c) => {
            const bucket = buckets.get(c.iso);
            const heat = heatBucket(bucket?.debit_total ?? 0, heatMax);
            const focused = focusedIso === c.iso;
            return (
              <CalendarCellButton
                key={c.iso}
                cell={c}
                bucket={bucket}
                heat={heat}
                focused={focused}
                currencyCode={currencyCode}
                currencySymbol={currencySymbol}
                onClick={() => onDaySelect(c.iso)}
                onFocus={() => onFocusedIsoChange(c.iso)}
                tabIndex={focused || (!focusedIso && c.isToday) ? 0 : -1}
              />
            );
          })}
        </div>
      </div>

      {/* Mobile week strip */}
      <div
        role="grid"
        aria-label="Transaction calendar — week view"
        onKeyDown={onGridKeyDown}
        className="block p-3 lg:hidden"
      >
        <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
          {WEEKDAY_LABELS.map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {weekCells.map((c) => {
            const bucket = buckets.get(c.iso);
            const heat = heatBucket(bucket?.debit_total ?? 0, heatMax);
            const focused = focusedIso === c.iso;
            return (
              <CalendarCellButton
                key={c.iso}
                cell={c}
                bucket={bucket}
                heat={heat}
                focused={focused}
                currencyCode={currencyCode}
                currencySymbol={currencySymbol}
                onClick={() => onDaySelect(c.iso)}
                onFocus={() => onFocusedIsoChange(c.iso)}
                tabIndex={focused || (!focusedIso && c.isToday) ? 0 : -1}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
