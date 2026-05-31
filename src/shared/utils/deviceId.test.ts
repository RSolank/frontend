import { beforeEach, describe, expect, it } from 'vitest';

import { _resetDeviceIdCacheForTests, getDeviceId } from './deviceId';

describe('getDeviceId', () => {
  beforeEach(() => {
    localStorage.clear();
    _resetDeviceIdCacheForTests();
  });

  it('generates a UUID v4 and persists it under pba.device_id on first call', () => {
    const id = getDeviceId();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
    expect(localStorage.getItem('pba.device_id')).toBe(id);
  });

  it('returns the same id across calls (in-memory cache)', () => {
    const a = getDeviceId();
    const b = getDeviceId();
    expect(a).toBe(b);
  });

  it('returns the persisted id across cache resets (i.e. across page reloads)', () => {
    const a = getDeviceId();
    _resetDeviceIdCacheForTests();
    const b = getDeviceId();
    expect(b).toBe(a);
  });

  it('honors an externally-set value rather than overwriting it', () => {
    localStorage.setItem('pba.device_id', 'preexisting-id-value');
    _resetDeviceIdCacheForTests();
    expect(getDeviceId()).toBe('preexisting-id-value');
  });
});
