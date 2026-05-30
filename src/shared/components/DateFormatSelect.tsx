import {
  useDateFormatStore,
  type DateFormatMode,
} from '../state/dateFormat.store';

// Sample timestamp used for the preview snippet beside each option.
// Chosen to disambiguate dd vs mm (27 ≠ 5) and to be year-bracketing
// enough that yyyy reads clearly.
const PREVIEW_ISO = '2026-05-27T00:00:00Z';

const OPTIONS: { value: DateFormatMode; label: string; preview: string }[] = [
  { value: 'system', label: 'System default', preview: previewFor('system') },
  { value: 'dmy', label: 'Day / month / year', preview: previewFor('dmy') },
  { value: 'mdy', label: 'Month / day / year', preview: previewFor('mdy') },
  { value: 'ymd', label: 'ISO (year-month-day)', preview: previewFor('ymd') },
  {
    value: 'dmonth',
    label: 'Day, month name, year',
    preview: previewFor('dmonth'),
  },
];

function previewFor(mode: DateFormatMode): string {
  const d = new Date(PREVIEW_ISO);
  switch (mode) {
    case 'dmy':
      return new Intl.DateTimeFormat('en-GB', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(d);
    case 'mdy':
      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(d);
    case 'ymd':
      return new Intl.DateTimeFormat('en-CA', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(d);
    case 'dmonth':
      return new Intl.DateTimeFormat(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }).format(d);
    case 'system':
    default:
      return new Intl.DateTimeFormat(undefined).format(d);
  }
}

// Labeled row mirroring the ThemeOptions / MotionToggle pattern so
// the control slots into both /account/accessibility and any future
// quick-access popover that adopts it.
export function DateFormatSelect() {
  const format = useDateFormatStore((s) => s.format);
  const setFormat = useDateFormatStore((s) => s.setFormat);

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2">
      <label
        htmlFor="date-format-select"
        className="text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400"
      >
        Date format
      </label>
      <select
        id="date-format-select"
        value={format}
        onChange={(e) => setFormat(e.target.value as DateFormatMode)}
        className="form-input !w-auto"
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label} ({o.preview})
          </option>
        ))}
      </select>
    </div>
  );
}
