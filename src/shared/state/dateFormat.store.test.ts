import { afterEach, describe, expect, it } from 'vitest';

import {
  localeForDateFormat,
  optsForDateFormat,
  useDateFormatStore,
} from './dateFormat.store';

describe('dateFormat.store', () => {
  afterEach(() => {
    useDateFormatStore.setState({ format: 'system' });
  });

  it('default mode is system (no override)', () => {
    expect(useDateFormatStore.getState().format).toBe('system');
    expect(optsForDateFormat('system')).toBeNull();
    expect(localeForDateFormat('system')).toBeUndefined();
  });

  it('setFormat persists across getState calls', () => {
    useDateFormatStore.getState().setFormat('dmy');
    expect(useDateFormatStore.getState().format).toBe('dmy');
  });

  it('non-system modes map to (locale, opts) pairs', () => {
    expect(localeForDateFormat('dmy')).toBe('en-GB');
    expect(localeForDateFormat('mdy')).toBe('en-US');
    expect(localeForDateFormat('ymd')).toBe('en-CA');
    expect(localeForDateFormat('dmonth')).toBeUndefined();

    expect(optsForDateFormat('dmy')).toEqual({
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    expect(optsForDateFormat('dmonth')).toEqual({
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  });
});
