// Renders a currency amount per the CONTRIBUTING.md §5 contract:
//   symbol present → `${symbol}${formatted}`     (e.g. "$1,234.56")
//   symbol absent  → `${code} ${formatted}`      (e.g. "XAF 1,234.56")
//
// Why a custom helper instead of Intl.NumberFormat(..., { style: 'currency',
// currency: code })? Intl needs every code it sees to be a registered ISO
// 4217 currency or it throws. The backend's metadata table includes a few
// non-standard / regional codes that wouldn't survive that path, and the
// symbol comes from the backend anyway. Numeric formatting (thousands +
// decimals) is still delegated to Intl.NumberFormat with no currency
// style.
//
// Thousands/decimal-separator preference is read from
// `useNumberFormatStore` (shared/state/numberFormat.store.ts), a
// frontend-only Zustand `persist` store. The store is read via
// `getState()` on every call (cheap; no React subscription) so the
// pre-built FORMATTERS cache keys by the current mode.

import {
  intlConfigForNumberFormat,
  useNumberFormatStore,
  type NumberFormatMode,
} from '../state/numberFormat.store';

const FORMATTERS = new Map<string, Intl.NumberFormat>();

function numberFormatter(
  maximumFractionDigits: number,
  mode: NumberFormatMode
): Intl.NumberFormat {
  const key = `n:${maximumFractionDigits}:${mode}`;
  let fmt = FORMATTERS.get(key);
  if (!fmt) {
    const config = intlConfigForNumberFormat(mode);
    if (config) {
      fmt = new Intl.NumberFormat(config.locale, {
        ...config.opts,
        minimumFractionDigits: 2,
        maximumFractionDigits,
      });
    } else {
      fmt = new Intl.NumberFormat(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits,
      });
    }
    FORMATTERS.set(key, fmt);
  }
  return fmt;
}

export function formatMoney(
  amount: number | string | null | undefined,
  code: string,
  symbol: string | null | undefined
): string {
  const n = typeof amount === 'string' ? Number(amount) : (amount ?? 0);
  const safe = Number.isFinite(n) ? n : 0;
  const { format } = useNumberFormatStore.getState();
  const formatted = numberFormatter(2, format).format(safe);
  return symbol ? `${symbol}${formatted}` : `${code} ${formatted}`;
}

const COUNT_FORMATTERS = new Map<NumberFormatMode, Intl.NumberFormat>();

// Format an integer count (transaction / beneficiary / budget counts, …)
// using the same thousands-separator preference as formatMoney, but with
// no currency affix and no forced decimals. Use this instead of
// `value.toLocaleString()` so counts honour the user's number-format
// choice (e.g. Indian lakh grouping) per CONTRIBUTING.md §5.
export function formatCount(value: number | null | undefined): string {
  const n =
    typeof value === 'number' && Number.isFinite(value) ? value : Number(value);
  const safe = Number.isFinite(n) ? n : 0;
  const { format } = useNumberFormatStore.getState();
  let fmt = COUNT_FORMATTERS.get(format);
  if (!fmt) {
    const config = intlConfigForNumberFormat(format);
    fmt = config
      ? new Intl.NumberFormat(config.locale, {
          ...config.opts,
          maximumFractionDigits: 0,
        })
      : new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
    COUNT_FORMATTERS.set(format, fmt);
  }
  return fmt.format(safe);
}

// Inverse — keeps the door open for any future input form that needs to
// accept a `${symbol}1,234.56` string and recover the numeric value.
// Strips anything that isn't a digit, sign, or decimal separator; returns
// NaN if nothing useful is left. Currently unused by feature batches.
export function parseMoney(input: string | null | undefined): number {
  if (input == null) return NaN;
  const cleaned = String(input).replace(/[^\d.\-+]/g, '');
  if (!cleaned) return NaN;
  return Number(cleaned);
}
