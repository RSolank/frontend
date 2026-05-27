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
    expect(intlConfigForNumberFormat('plain')).toEqual({
      locale: 'en-US',
      opts: { useGrouping: false },
    });
  });
});
