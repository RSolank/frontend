import { afterEach, describe, expect, it } from 'vitest';

import {
  BASE_FONT_PX,
  ZOOM_DEFAULT,
  ZOOM_MAX,
  ZOOM_MIN,
  applyZoom,
  clampZoom,
  useZoomStore,
} from './zoom.store';

describe('zoom.store', () => {
  afterEach(() => {
    useZoomStore.setState({ zoom: ZOOM_DEFAULT });
    document.documentElement.style.removeProperty('font-size');
  });

  it('clamps out-of-range values', () => {
    expect(clampZoom(0)).toBe(ZOOM_MIN);
    expect(clampZoom(10)).toBe(ZOOM_MAX);
    expect(clampZoom(1.1)).toBe(1.1);
    expect(clampZoom(Number.NaN)).toBe(ZOOM_DEFAULT);
  });

  it('setZoom clamps and persists into state', () => {
    useZoomStore.getState().setZoom(2);
    expect(useZoomStore.getState().zoom).toBe(ZOOM_MAX);

    useZoomStore.getState().setZoom(1.15);
    expect(useZoomStore.getState().zoom).toBe(1.15);
  });

  it('applyZoom writes html font-size in pixels', () => {
    applyZoom(1.25);
    expect(document.documentElement.style.fontSize).toBe(
      `${1.25 * BASE_FONT_PX}px`
    );
  });
});
