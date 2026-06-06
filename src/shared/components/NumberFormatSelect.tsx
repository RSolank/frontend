import {
  useNumberFormatStore,
  type NumberFormatMode,
} from '../state/numberFormat.store';

// Sample magnitude used for the preview snippet beside each option.
const PREVIEW_VALUE = 1234567.89;

function previewFor(mode: NumberFormatMode): string {
  switch (mode) {
    case 'comma-dot':
      return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(PREVIEW_VALUE);
    case 'dot-comma':
      return new Intl.NumberFormat('de-DE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(PREVIEW_VALUE);
    case 'space-comma':
      return new Intl.NumberFormat('fr-FR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(PREVIEW_VALUE);
    case 'indian':
      return new Intl.NumberFormat('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(PREVIEW_VALUE);
    case 'plain':
      return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        useGrouping: false,
      }).format(PREVIEW_VALUE);
    case 'system':
    default:
      return new Intl.NumberFormat(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(PREVIEW_VALUE);
  }
}

const OPTIONS: { value: NumberFormatMode; label: string }[] = [
  { value: 'system', label: 'System default' },
  { value: 'comma-dot', label: '1,234,567.89' },
  { value: 'dot-comma', label: '1.234.567,89' },
  { value: 'space-comma', label: '1 234 567,89' },
  { value: 'indian', label: '12,34,567.89 (Indian)' },
  { value: 'plain', label: '1234567.89 (no grouping)' },
];

export function NumberFormatSelect() {
  const format = useNumberFormatStore((s) => s.format);
  const setFormat = useNumberFormatStore((s) => s.setFormat);

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2">
      <label
        htmlFor="number-format-select"
        className="text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400"
      >
        Numbers
      </label>
      <select
        id="number-format-select"
        value={format}
        onChange={(e) => setFormat(e.target.value as NumberFormatMode)}
        className="form-input !w-auto"
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.value === 'system'
              ? `${o.label} (${previewFor(o.value)})`
              : o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
