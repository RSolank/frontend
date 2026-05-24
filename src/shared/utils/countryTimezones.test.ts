import { describe, expect, it } from 'vitest';

import {
  getAllTimezones,
  getCountryNameFromRegion,
  getTimezonesForCountryName,
  getTimezonesForRegion,
} from './countryTimezones';

describe('countryTimezones', () => {
  it('resolves an ISO region to its English display name', () => {
    expect(getCountryNameFromRegion('IN')).toBe('India');
    expect(getCountryNameFromRegion('US')).toBe('United States');
  });

  it('returns null for falsy region input', () => {
    expect(getCountryNameFromRegion(null)).toBeNull();
    expect(getCountryNameFromRegion('')).toBeNull();
  });

  it('looks up timezones by country name', () => {
    expect(getTimezonesForCountryName('India')).toEqual(['Asia/Kolkata']);
    expect(getTimezonesForCountryName('United States').length).toBeGreaterThan(1);
  });

  it('looks up timezones by ISO region code', () => {
    expect(getTimezonesForRegion('IN')).toEqual(['Asia/Kolkata']);
  });

  it('returns the full IANA list with at least the common zones', () => {
    const all = getAllTimezones();
    expect(all).toContain('UTC');
    expect(all).toContain('Asia/Kolkata');
    expect(all).toContain('Europe/Berlin');
    expect(all.length).toBeGreaterThan(100);
  });
});
