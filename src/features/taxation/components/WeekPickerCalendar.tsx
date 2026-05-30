import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';

import {
  shiftIso,
  shiftMonthKey,
  todayIsoInTz,
} from '../../transactions/api/calendar';
import { formatBillDate, weekRangeInTz } from '../api/billPeriod';

interface WeekPickerCalendarProps {
  // The currently-selected ISO Mon → Sun week, represented by its
  // period_start (YYYY-MM-DD). `null` = nothing selected yet.
  selectedWeekStart: string | null;
  // Fired when the user clicks a billable week row. Receives the
  // week's Monday (period_start) — the dialog runs it through
  // `weekRangeInTz` to get the full {start, end} pair.
  onSelect: (weekStartIso: string) => void;
  // Active user timezone. Drives "today" + the visual highlight on
  // the row containing today.
  timezone: string;
  // Weeks whose Sunday (period_end) is on/after this ISO date are
  // not billable yet (the current accruing + preceding in-flight
  // weeks). Rows that fail the gate render disabled.
  precedingWeekStart: string;
}

// Row container styling by state — if/else (not a nested ternary) so it
// reads cleanly and stays off sonarjs/no-nested-conditional.
function weekRowClass(isSelected: boolean, billable: boolean): string {
  if (isSelected)
    return 'border-indigo-500 bg-indigo-50 dark:border-indigo-400 dark:bg-indigo-950/40';
  if (billable)
    return 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/40 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-700 dark:hover:bg-indigo-950/30';
  return 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-500';
}

// Day-number colour: today accent, in-month default, out-of-month muted.
function weekDayClass(isToday: boolean, inMonth: boolean): string {
  if (isToday) return 'font-bold text-indigo-600 dark:text-indigo-300';
  if (inMonth) return 'text-slate-700 dark:text-slate-200';
  return 'text-slate-400 dark:text-slate-600';
}

// Week-as-row calendar picker. Each row is one ISO 8601 Mon → Sun
// week (project convention — see CONTRIBUTING.md §6 + the
// `billPeriod.ts` helpers). Clicking a row selects the whole week
// rather than a single date, so the user picks the unit of billing
// directly instead of picking-a-date-and-resolving.
//
// Distinct from the transactions browser calendar which is Sun → Sat
// for visual convention. Here, billing is the domain, so the row
// header reads `Mon Tue Wed Thu Fri Sat Sun`.
export function WeekPickerCalendar({
  selectedWeekStart,
  onSelect,
  timezone,
  precedingWeekStart,
}: WeekPickerCalendarProps) {
  const today = todayIsoInTz(timezone);
  const [viewMonth, setViewMonth] = useState(() => today.slice(0, 7));

  const rows = useMemo(() => buildWeekRows(viewMonth, timezone), [
    viewMonth,
    timezone,
  ]);

  const monthLabel = useMemo(() => {
    const [y, m] = viewMonth.split('-').map(Number);
    return new Date(Date.UTC(y as number, (m as number) - 1, 1, 12))
      .toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      });
  }, [viewMonth]);

  return (
    <div className="rounded-md border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
      {/* Month nav */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setViewMonth((m) => shiftMonthKey(m, -1))}
          aria-label="Previous month"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          <ChevronLeft aria-hidden size={18} />
        </button>
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          {monthLabel}
        </span>
        <button
          type="button"
          onClick={() => setViewMonth((m) => shiftMonthKey(m, 1))}
          aria-label="Next month"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          <ChevronRight aria-hidden size={18} />
        </button>
      </div>

      {/*
        Single grid template applied to header + every row so the day
        columns line up. First column is a fixed width to host the
        row-prefix label (Monday MM/DD); remaining 7 share the rest of
        the width evenly. Without the fixed width, each row's `auto`
        column sizes to its own content and the header columns drift
        off by a few pixels because the placeholder is empty.
      */}
      {/* Day-of-week header — ISO Mon → Sun */}
      <div className="grid grid-cols-[3.25rem_repeat(7,minmax(0,1fr))] gap-1 px-1 text-[10px] font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
        <span />
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <span key={d} className="text-center">
            {d}
          </span>
        ))}
      </div>

      {/* Week rows */}
      <div className="mt-1 flex flex-col gap-1">
        {rows.map((row) => {
          const billable = row.end < precedingWeekStart;
          const isSelected = selectedWeekStart === row.start;
          const containsToday = today >= row.start && today <= row.end;
          return (
            <button
              key={row.start}
              type="button"
              disabled={!billable}
              onClick={() => onSelect(row.start)}
              aria-pressed={isSelected}
              aria-label={`Week of ${formatBillDate(row.start, timezone)} to ${formatBillDate(row.end, timezone)}`}
              data-testid={`week-row-${row.start}`}
              className={`grid grid-cols-[3.25rem_repeat(7,minmax(0,1fr))] items-center gap-1 rounded-md border px-1 py-1 text-xs transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none ${weekRowClass(
                isSelected,
                billable
              )} ${containsToday && !isSelected ? 'ring-1 ring-indigo-300/60 dark:ring-indigo-700/60' : ''}`}
            >
              {/* Row prefix — the Monday ISO date (short form) so the
                  user has a stable label for the row independent of
                  which days lie in/out of the visible month. */}
              <span
                className={`text-left font-semibold tabular-nums ${
                  isSelected
                    ? 'text-indigo-700 dark:text-indigo-200'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {row.start.slice(5).replace('-', '/')}
              </span>
              {row.days.map((d) => (
                <span
                  key={d.iso}
                  className={`text-center tabular-nums ${weekDayClass(
                    d.iso === today,
                    d.inMonth
                  )}`}
                >
                  {d.day}
                </span>
              ))}
            </button>
          );
        })}
      </div>

      <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
        Click a row to select that ISO week (Mon → Sun) for billing.
        Greyed rows haven&rsquo;t finalised yet — only weeks ending before{' '}
        <span className="font-medium">
          {formatBillDate(precedingWeekStart, timezone)}
        </span>{' '}
        are billable.
      </p>
    </div>
  );
}

interface WeekRow {
  start: string; // Mon, YYYY-MM-DD
  end: string; // Sun, YYYY-MM-DD
  days: { iso: string; day: number; inMonth: boolean }[];
}

// Build 6 ISO Mon → Sun week rows covering `viewMonth`. First row's
// Monday is the Monday on/before day 1 of the month; subsequent rows
// follow. Pad days carry `inMonth=false` so the renderer can mute
// them visually.
function buildWeekRows(viewMonth: string, timezone: string): WeekRow[] {
  const [y, m] = viewMonth.split('-').map(Number);
  const month = m as number;
  const day1 = new Date(Date.UTC(y as number, month - 1, 1, 12));
  const firstWeek = weekRangeInTz(day1, timezone);
  const rows: WeekRow[] = [];
  let cursor = firstWeek.period_start;
  for (let w = 0; w < 6; w++) {
    const days: WeekRow['days'] = [];
    for (let d = 0; d < 7; d++) {
      const iso = shiftIso(cursor, d);
      const dayNum = parseInt(iso.slice(8, 10), 10);
      const monthNum = parseInt(iso.slice(5, 7), 10);
      days.push({ iso, day: dayNum, inMonth: monthNum === month });
    }
    rows.push({
      start: cursor,
      end: days[6]!.iso,
      days,
    });
    cursor = shiftIso(cursor, 7);
  }
  return rows;
}
