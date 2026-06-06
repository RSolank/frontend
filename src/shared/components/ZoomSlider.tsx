import { useState } from 'react';

import {
  ZOOM_MAX,
  ZOOM_MIN,
  ZOOM_STEP,
  useZoomStore,
} from '../state/zoom.store';

// Single-line accessibility control — "Text size" label on the left,
// a compact range slider on the right. The percent readout is rendered
// as a transient bubble above the slider thumb, visible only while
// the slider is active (focused via keyboard, dragged via pointer).
//
// Slider width is capped to match the <ThemeOptions /> segmented
// control above it (~128 px) so both accessibility rows read as
// "label on the left, ~equal-width control on the right". The
// ZoomOut / ZoomIn flanking icons were dropped in the 2026-05-27
// review — sliders carry their "low-left / high-right" semantic
// universally, and the bubble exposes the precise value on demand.
//
// Drives the root html font-size through `useZoomStore` → `applyZoom`
// (bridge in providers.tsx). Persists locally only.
export function ZoomSlider() {
  const zoom = useZoomStore((s) => s.zoom);
  const setZoom = useZoomStore((s) => s.setZoom);
  const pct = Math.round(zoom * 100);
  // Linear mapping of the current value into a 0–100% slot for the
  // bubble's `left:`. Doesn't compensate for the thumb-radius inset
  // at the extremes; the small visual offset is acceptable for a
  // transient tooltip.
  const valuePct = ((zoom - ZOOM_MIN) / (ZOOM_MAX - ZOOM_MIN)) * 100;

  // Active covers mouse, touch (PointerEvents), and keyboard (focus).
  const [active, setActive] = useState(false);

  return (
    <div
      className="flex items-center justify-between gap-3 px-4 py-2"
      role="group"
      aria-label="Text size"
    >
      <span className="text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
        Text size
      </span>
      <div className="relative w-32 shrink-0">
        <input
          type="range"
          aria-label="Text size"
          aria-valuemin={ZOOM_MIN}
          aria-valuemax={ZOOM_MAX}
          aria-valuenow={zoom}
          aria-valuetext={`${pct} percent`}
          min={ZOOM_MIN}
          max={ZOOM_MAX}
          step={ZOOM_STEP}
          value={zoom}
          onChange={(e) => setZoom(parseFloat(e.target.value))}
          onPointerDown={() => setActive(true)}
          onPointerUp={() => setActive(false)}
          onPointerCancel={() => setActive(false)}
          onFocus={() => setActive(true)}
          onBlur={() => setActive(false)}
          className="accent-accent-600 block h-1.5 w-full appearance-none rounded-full bg-slate-200 dark:bg-slate-700"
        />
        {active && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -top-7 -translate-x-1/2 rounded bg-slate-900 px-1.5 py-0.5 text-[10px] font-semibold text-white tabular-nums shadow-md dark:bg-slate-700"
            style={{ left: `${valuePct}%` }}
          >
            {pct}%
          </span>
        )}
      </div>
    </div>
  );
}
