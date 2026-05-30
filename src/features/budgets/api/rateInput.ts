// Shared input helpers for the penalty-rate form field. Mirrors the
// pattern locked in features/taxation/components/TaxationRuleFormDialog
// so the user-facing parsing semantics stay identical across the two
// surfaces (taxation rules ⇒ default penalty rate; budgets ⇒
// per-budget penalty rate override).

// Fractions → "5%" / "12.5%" for display. Trim trailing zeros.
export function formatRateForInput(fraction: number): string {
  const pct = fraction * 100;
  // parseFloat drops trailing zeros numerically (5.00 -> 5, 12.50 -> 12.5)
  // — no regex needed.
  const fixed = String(parseFloat(pct.toFixed(2)));
  return `${fixed || '0'}%`;
}

// Parses "5", "5%", or "0.05" → fraction (0.05). `%` suffix → divide
// by 100; bare numbers ≥ 1 are treated as percent for forgiveness (a
// user typing "5" almost certainly means 5%, not 500%). The form's
// Zod schema's max=10 catches the rare "500" landing as 500× rate.
export function parseRateInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const hasPercent = trimmed.endsWith('%');
  const numeric = Number(trimmed.replace(/%\s*$/, ''));
  if (!Number.isFinite(numeric)) return null;
  if (hasPercent) return numeric / 100;
  return numeric >= 1 ? numeric / 100 : numeric;
}
