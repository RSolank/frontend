import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Root font-size multiplier. Tailwind's `rem` utilities (text-*, spacing,
// layout) inherit from `html` font-size, so multiplying the root by this
// factor scales the entire text + spacing scale proportionally. Pixel
// utilities (px-4, fixed icon sizes) stay constant on purpose — chrome
// stays usable at larger zoom levels.
//
// Stored locally only — the backend's UserPreferencesMiddleware does not
// (yet) carry a zoom column. A future batch can sync this to
// /api/users/preferences if needed; for now, persistence is via the
// Zustand `persist` middleware ⇒ `localStorage["zoom"]`.

export const ZOOM_MIN = 0.85;
export const ZOOM_MAX = 1.4;
export const ZOOM_STEP = 0.05;
export const ZOOM_DEFAULT = 1.0;
export const BASE_FONT_PX = 16; // matches the browser default

export function clampZoom(value: number): number {
  if (!Number.isFinite(value)) return ZOOM_DEFAULT;
  if (value < ZOOM_MIN) return ZOOM_MIN;
  if (value > ZOOM_MAX) return ZOOM_MAX;
  return value;
}

interface ZoomState {
  zoom: number;
  setZoom: (next: number) => void;
  reset: () => void;
}

export const useZoomStore = create<ZoomState>()(
  persist(
    (set) => ({
      zoom: ZOOM_DEFAULT,
      setZoom: (next) => set({ zoom: clampZoom(next) }),
      reset: () => set({ zoom: ZOOM_DEFAULT }),
    }),
    { name: 'zoom' }
  )
);

// Idempotent: write the current zoom into <html> font-size in px so
// Tailwind rem utilities pick it up. Pixel utilities (icons, px-4)
// stay constant — the scale only affects text + rem-based spacing.
export function applyZoom(zoom: number): void {
  if (typeof document === 'undefined') return;
  document.documentElement.style.fontSize = `${clampZoom(zoom) * BASE_FONT_PX}px`;
}
