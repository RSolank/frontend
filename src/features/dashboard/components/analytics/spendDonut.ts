import {
  OTHERS_SLICE,
  SLICE_PALETTE,
  type DonutSlice,
} from '../../../../shared/components/charts/trendCharts';
import type { BudgetCategory } from '../../../budgets/api/queries';

export interface DonutLegendRow {
  label: string;
  pct: number;
  dotClass: string;
}

const MAX_SLICES = 6; // top 5 + "Others"

// Build the "where it went" donut from the budget-status categories: rank by
// this-month net spend, keep the top 5 + an "Others" tail, percentages of total
// spend. Pure so the card stays a thin render and this is unit-testable.
export function buildCategoryDonut(categories: BudgetCategory[]): {
  slices: DonutSlice[];
  legend: DonutLegendRow[];
} {
  const ranked = categories
    .map((c) => ({
      label: c.tag_name ?? 'Untagged',
      value: Math.max(0, c.current_net_expense ?? 0),
    }))
    .filter((c) => c.value > 0)
    .sort((a, b) => b.value - a.value);

  const grand = ranked.reduce((s, c) => s + c.value, 0);
  if (grand <= 0) return { slices: [], legend: [] };

  const head =
    ranked.length > MAX_SLICES ? ranked.slice(0, MAX_SLICES - 1) : ranked;
  const tail = ranked.length > MAX_SLICES ? ranked.slice(MAX_SLICES - 1) : [];

  const display = head.map((c, i) => ({
    ...c,
    palette: SLICE_PALETTE[i % SLICE_PALETTE.length]!,
  }));
  if (tail.length > 0) {
    display.push({
      label: 'Others',
      value: tail.reduce((s, c) => s + c.value, 0),
      palette: OTHERS_SLICE,
    });
  }

  return {
    slices: display.map((d) => ({
      label: d.label,
      value: d.value,
      pct: (d.value / grand) * 100,
      strokeClass: d.palette.strokeClass,
    })),
    legend: display.map((d) => ({
      label: d.label,
      pct: (d.value / grand) * 100,
      dotClass: d.palette.dotClass,
    })),
  };
}
