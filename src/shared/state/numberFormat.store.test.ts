import { afterEach, describe, expect, it } from 'vitest';

import {
  intlConfigForNumberFormat,
  useNumberFormatStore,
} from './numberFormat.store';

describe('numberFormat.store', () => {
  afterEach(() => {
    useNumberFormatStore.setState({ format: 'system' });
  });

  it('default mode is system (no override)', () => {
    expect(useNumberFormatStore.getState().format).toBe('system');
    expect(intlConfigForNumberFormat('system')).toBeNull();
  });

  it('setFormat persists across getState calls', () => {
    useNumberFormatStore.getState().setFormat('dot-comma');
    expect(useNumberFormatStore.getState().format).toBe('dot-comma');
  });

  it('non-system modes map to (locale, opts) pairs', () => {
    expect(intlConfigForNumberFormat('comma-dot')).toEqual({
      locale: 'en-US',
      opts: {},
    });
    expect(intlConfigForNumberFormat('dot-comma')).toEqual({
      locale: 'de-DE',
      opts: {},
    });
    expect(intlConfigForNumberFormat('space-comma')).toEqual({
      locale: 'fr-FR',
      opts: {},
    });
    expect(intlConfigForNumberFormat('indian')).toEqual({
      locale: 'en-IN',
      opts: {},
    });
    expect(intlConfigForNumberFormat('plain')).toEqual({
      locale: 'en-US',
      opts: { useGrouping: false },
    });
  });

  it('indian mode renders lakh/crore grouping via en-IN', () => {
    const cfg = intlConfigForNumberFormat('indian');
    expect(cfg).not.toBeNull();
    const out = new Intl.NumberFormat(cfg!.locale, {
      ...cfg!.opts,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(1234567.89);
    // en-IN groups by lakh/crore: 12,34,567.89 (not 1,234,567.89).
    expect(out).toBe('12,34,567.89');
  });
});
