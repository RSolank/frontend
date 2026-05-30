import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { Modal } from './Modal';
import { SearchableSelect } from './SearchableSelect';

interface DateFieldProps {
  id?: string;
  name?: string;
  value: string; // YYYY-MM-DD or ''
  onChange: (value: string) => void;
  required?: boolean;
  // Optional bounds for the year nav inside the popup. Defaults to
  // 1900 → currentYear + 5 so DOB pickers have the whole modern range
  // and forward-dated transaction picks have a comfortable buffer.
  minYear?: number;
  maxYear?: number;
  placeholder?: string;
  ariaLabel?: string;
  disabled?: boolean;
  className?: string;
  // Optional test hook on the text input itself.
  inputTestId?: string;
}

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

// ISO Mon → Sun column order. Single canonical convention across the
// app — see CONTRIBUTING.md §6 + the comment block in
// `features/transactions/api/calendar.ts`. Native `<input type="date">`
// pickers follow the browser/OS locale (often Sun → Sat); this
// component is the project-wide replacement so every date surface
// reads identically regardless of who's running the app.
const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Day-cell styling by state: selected (filled) > today (tinted) > in-month
// (default) > out-of-month (muted). if/else (not a nested ternary) so it
// reads cleanly and stays off sonarjs/no-nested-conditional.
function dayCellClass(
  isSelected: boolean,
  isToday: boolean,
  inMonth: boolean
): string {
  if (isSelected)
    return 'bg-indigo-600 font-semibold text-white hover:bg-indigo-700';
  if (isToday)
    return 'bg-indigo-50 font-semibold text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-200 dark:hover:bg-indigo-950/60';
  if (inMonth)
    return 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800';
  return 'text-slate-400 hover:bg-slate-50 dark:text-slate-600 dark:hover:bg-slate-800/50';
}

interface DateCalendarPopupProps {
  value: string;
  today: string;
  minYear: number;
  maxYear: number;
  onClose: () => void;
  onPick: (iso: string) => void;
  onClear: () => void;
}

// The calendar overlay — extracted so DateField itself stays a thin
// input + trigger (under the max-lines gate). Owns the view-month nav
// state; because DateField mounts it only while open, it initialises
// fresh from the current value each time (no reset-on-open effect needed).
function DateCalendarPopup({
  value,
  today,
  minYear,
  maxYear,
  onClose,
  onPick,
  onClear,
}: DateCalendarPopupProps) {
  // viewMonth is `YYYY-MM` — anchored to the value when valid, else today.
  const [viewMonth, setViewMonth] = useState(() =>
    isValidIso(value) ? value.slice(0, 7) : today.slice(0, 7)
  );

  const yearOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [];
    for (let y = maxYear; y >= minYear; y--) {
      opts.push({ value: String(y), label: String(y) });
    }
    return opts;
  }, [minYear, maxYear]);

  const monthOptions = useMemo(
    () =>
      MONTH_LABELS.map((label, idx) => ({
        value: String(idx + 1).padStart(2, '0'),
        label,
      })),
    []
  );

  const [viewYear, viewMonthNum] = viewMonth.split('-');
  const grid = useMemo(() => buildMonthGrid(viewMonth), [viewMonth]);

  return (
    <Modal
      open
      onClose={onClose}
      title="Pick a date"
      size="sm"
      footer={
        <>
          <button
            type="button"
            onClick={onClear}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => onPick(today)}
            className="btn-primary !w-auto"
          >
            Today
          </button>
        </>
      }
    >
      {/* Year + month dropdowns + chevron month-step buttons. */}
      <div className="mb-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setViewMonth((m) => shiftMonthKey(m, -1))}
          aria-label="Previous month"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          <ChevronLeft aria-hidden size={16} />
        </button>
        {/*
          Equal split — both dropdowns need ~3.5rem on the right
          for the SearchableSelect's clear + chevron buttons, so
          "2026" needs ~8rem total to render without truncating.
          `flex-1` on both gives ~11rem each in the size="sm" Modal
          which fits the longest month ("September") and any year
          without crowding either side.
        */}
        <div className="flex flex-1 gap-2">
          <div className="flex-1">
            <SearchableSelect
              ariaLabel="Month"
              value={viewMonthNum ?? ''}
              options={monthOptions}
              onChange={(m) => setViewMonth(`${viewYear}-${m}`)}
            />
          </div>
          <div className="flex-1">
            <SearchableSelect
              ariaLabel="Year"
              value={viewYear ?? ''}
              options={yearOptions}
              onChange={(y) => setViewMonth(`${y}-${viewMonthNum}`)}
            />
          </div>
        </div>
        <button
          type="button"
          onClick={() => setViewMonth((m) => shiftMonthKey(m, 1))}
          aria-label="Next month"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          <ChevronRight aria-hidden size={16} />
        </button>
      </div>

      {/* Day-of-week header — ISO Mon → Sun. */}
      <div className="grid grid-cols-7 gap-1 text-[10px] font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
        {WEEKDAY_LABELS.map((d) => (
          <span key={d} className="text-center">
            {d}
          </span>
        ))}
      </div>

      {/* Day grid — 6 rows × 7 cols. */}
      <div className="mt-1 grid grid-cols-7 gap-1">
        {grid.map((cell) => {
          const isSelected = cell.iso === value;
          const isToday = cell.iso === today;
          return (
            <button
              key={cell.iso}
              type="button"
              onClick={() => onPick(cell.iso)}
              aria-label={cell.iso}
              aria-pressed={isSelected}
              className={`flex h-9 items-center justify-center rounded-md text-sm tabular-nums transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none ${dayCellClass(
                isSelected,
                isToday,
                cell.inMonth
              )}`}
            >
              {cell.day}
            </button>
          );
        })}
      </div>
    </Modal>
  );
}

// Project-wide date picker. Text input for fast typing
// (`YYYY-MM-DD`) + a calendar icon that opens a Mon-Sun popup with
// year + month dropdowns for fast nav (especially handy for DOB).
// Use this anywhere a native `<input type="date">` would otherwise
// appear so the visual calendar stays consistent.
export function DateField({
  id,
  name,
  value,
  onChange,
  required = false,
  minYear,
  maxYear,
  placeholder = 'YYYY-MM-DD',
  ariaLabel,
  disabled = false,
  className,
  inputTestId,
}: DateFieldProps) {
  const today = useMemo(() => todayIsoLocal(), []);
  const currentYear = new Date().getFullYear();
  const effectiveMinYear = minYear ?? 1900;
  const effectiveMaxYear = maxYear ?? currentYear + 5;

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);

  // Keep the draft synced with the externally-controlled value (e.g.
  // a parent reset). When the user is mid-typing, their keystrokes
  // overwrite the draft via the input's onChange.
  useEffect(() => {
    setDraft(value);
  }, [value]);

  function commitDraft(next: string) {
    const trimmed = next.trim();
    if (trimmed === '') {
      onChange('');
      return;
    }
    if (isValidIso(trimmed)) {
      onChange(trimmed);
    } else {
      // Invalid — snap the field back to the last committed value so
      // the parent state stays clean. The user sees their last good
      // pick rather than a half-typed string.
      setDraft(value);
    }
  }

  function handlePick(iso: string) {
    onChange(iso);
    setDraft(iso);
    setOpen(false);
  }

  return (
    <div className={`w-full ${className ?? ''}`}>
      <div className="relative">
        <input
          id={id}
          name={name}
          type="text"
          inputMode="numeric"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => commitDraft(draft)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commitDraft(draft);
            }
          }}
          placeholder={placeholder}
          aria-label={ariaLabel}
          required={required}
          disabled={disabled}
          autoComplete="off"
          data-testid={inputTestId}
          className="form-input !pr-10"
        />
        <button
          type="button"
          onClick={() => !disabled && setOpen(true)}
          aria-label="Open calendar"
          aria-expanded={open}
          tabIndex={-1}
          disabled={disabled}
          className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          <CalendarIcon aria-hidden size={16} />
        </button>
      </div>

      {/* Calendar rendered as a Modal — portals to body root so it
          escapes any parent overflow / clipping. Nesting inside other
          Modals (e.g. Add transaction → DateField) works because
          Radix Dialog supports stacking. Conditionally mounted so a
          closed DateField doesn't pay for the Radix Dialog setup. */}
      {open && (
        <DateCalendarPopup
          value={value}
          today={today}
          minYear={effectiveMinYear}
          maxYear={effectiveMaxYear}
          onClose={() => setOpen(false)}
          onPick={handlePick}
          onClear={() => {
            onChange('');
            setDraft('');
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

// — Local helpers (intentionally inlined to keep DateField a leaf
// shared component with no cross-feature imports). The same Mon-Sun
// math lives in `features/transactions/api/calendar.ts`; refactor to
// a shared util if a third copy ever lands.

interface GridCell {
  iso: string;
  day: number;
  inMonth: boolean;
}

function buildMonthGrid(monthKey: string): GridCell[] {
  const [y, m] = monthKey.split('-').map(Number);
  const year = y as number;
  const month = m as number;
  const start = mondayWeekStart(year, month, 1);
  const cells: GridCell[] = [];
  for (let i = 0; i < 42; i++) {
    const c = shiftDays(start.year, start.month, start.day, i);
    cells.push({
      iso: isoFromYmd(c.year, c.month, c.day),
      day: c.day,
      inMonth: c.year === year && c.month === month,
    });
  }
  return cells;
}

function mondayWeekStart(year: number, month: number, day: number) {
  const utc = Date.UTC(year, month - 1, day);
  const dow = new Date(utc).getUTCDay(); // 0 = Sun … 6 = Sat
  const back = (dow + 6) % 7; // Sun → 6 days back, Mon → 0, Tue → 1, …
  return shiftYmdByDays(year, month, day, -back);
}

function shiftYmdByDays(
  year: number,
  month: number,
  day: number,
  delta: number
) {
  const utc = Date.UTC(year, month - 1, day) + delta * 86_400_000;
  const next = new Date(utc);
  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
  };
}

function shiftDays(year: number, month: number, day: number, delta: number) {
  return shiftYmdByDays(year, month, day, delta);
}

function isoFromYmd(year: number, month: number, day: number): string {
  return `${year.toString().padStart(4, '0')}-${month
    .toString()
    .padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
}

function shiftMonthKey(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split('-').map(Number);
  const total = (y as number) * 12 + ((m as number) - 1) + delta;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny.toString().padStart(4, '0')}-${nm.toString().padStart(2, '0')}`;
}

function todayIsoLocal(): string {
  const d = new Date();
  return isoFromYmd(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

function isValidIso(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  if (
    (y as number) < 1 ||
    (m as number) < 1 ||
    (m as number) > 12 ||
    (d as number) < 1
  ) {
    return false;
  }
  const date = new Date(Date.UTC(y as number, (m as number) - 1, d as number));
  // Round-trip rejects values like 2026-02-31.
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() + 1 === m &&
    date.getUTCDate() === d
  );
}
