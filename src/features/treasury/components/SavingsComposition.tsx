type Money = (n: number | null | undefined) => string;

// Zone 2 — how the set-aside cash splits between revenue *recognized*
// against a levied bill and surplus *held in advance* (deferred revenue).
//
// A stacked horizontal bar, deliberately NOT a donut: in the everyday case
// there is only recognized revenue, so the bar reads as a single solid
// segment; the second (amber) segment only appears in the rare surplus case.
// A donut at a 98/2 split looks broken. (The donut primitive is reserved for
// the future treasury *expense* side, where slices are genuinely multi-way.)
//
// Pure / presentational — funded = recognized + deferred is asserted by the
// caller's data; this just lays it out.
export function SavingsComposition({
  recognized,
  deferred,
  money,
}: {
  recognized: number;
  deferred: number;
  money: Money;
}) {
  const total = recognized + deferred;
  // Guarded against a zero total (the page renders its empty state before
  // mounting this, but a defensive 0 keeps the bar from NaN-collapsing).
  const recognizedPct = total > 0 ? (recognized / total) * 100 : 100;
  const deferredPct = total > 0 ? (deferred / total) * 100 : 0;

  return (
    <section
      aria-labelledby="savings-composition-heading"
      className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <h2
        id="savings-composition-heading"
        className="mb-3 text-base font-semibold text-slate-900 dark:text-slate-100"
      >
        Composition
      </h2>

      <div
        className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
        role="img"
        aria-label={`Allocated to bills ${money(recognized)}, held in advance ${money(
          deferred
        )}`}
        data-testid="savings-composition-bar"
      >
        <div
          className="h-full bg-emerald-500 dark:bg-emerald-400"
          style={{ width: `${recognizedPct}%` }}
        />
        {deferred > 0 && (
          <div
            className="h-full bg-amber-500 dark:bg-amber-400"
            style={{ width: `${deferredPct}%` }}
            data-testid="savings-composition-deferred-segment"
          />
        )}
      </div>

      <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <LegendRow
          dotClass="bg-emerald-500 dark:bg-emerald-400"
          label="Allocated to bills"
          value={money(recognized)}
          testid="savings-legend-recognized"
        />
        <LegendRow
          dotClass="bg-amber-500 dark:bg-amber-400"
          label="Held in advance"
          value={money(deferred)}
          testid="savings-legend-deferred"
        />
      </dl>
    </section>
  );
}

function LegendRow({
  dotClass,
  label,
  value,
  testid,
}: {
  dotClass: string;
  label: string;
  value: string;
  testid: string;
}) {
  return (
    <div className="flex items-center gap-2" data-testid={testid}>
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dotClass}`} />
      <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="font-medium text-slate-900 dark:text-slate-100">{value}</dd>
    </div>
  );
}
