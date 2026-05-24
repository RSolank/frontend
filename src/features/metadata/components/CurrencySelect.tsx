import { useCurrenciesQuery, type CurrencyOption } from '../api/queries';

interface CurrencySelectProps {
  id?: string;
  value: string;
  onChange: (code: string) => void;
  required?: boolean;
  // Optional override; falls back to the shared query.
  currencies?: CurrencyOption[];
}

// Renders `${label} (${symbol})` (label already carries "CODE - Name"
// from the backend, e.g. "INR - Indian Rupee"). Falls back to just
// `${label}` when the metadata row lacks a symbol. The full name keeps
// the dropdown readable for users who don't recognise every ISO code.
export function formatCurrencyOption(c: CurrencyOption): string {
  return c.symbol ? `${c.label} (${c.symbol})` : c.label;
}

export function CurrencySelect({
  id,
  value,
  onChange,
  required,
  currencies: currenciesProp,
}: CurrencySelectProps) {
  const { data: currenciesQueried = [] } = useCurrenciesQuery();
  const currencies = currenciesProp ?? currenciesQueried;

  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      className="form-input"
    >
      <option value="">— Select currency —</option>
      {currencies.map((c) => (
        <option key={c.code} value={c.code}>
          {formatCurrencyOption(c)}
        </option>
      ))}
    </select>
  );
}
