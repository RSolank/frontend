import { describe, expect, it } from 'vitest';

import type { CountryOption } from '../api/referenceData';

import {
  getCountryNameFromRegion,
  getTimezonesForCountryName,
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

  it('reads a single-tz country from the metadata payload', () => {
    const countries: CountryOption[] = [
      { name: 'India', timezones: ['Asia/Kolkata'] },
    ];
    expect(getTimezonesForCountryName('India', countries)).toEqual([
      'Asia/Kolkata',
    ]);
  });

  it('reads the full multi-tz list from a multi-zone country payload', () => {
    const countries: CountryOption[] = [
      {
        name: 'United States',
        timezones: [
          'America/New_York',
          'America/Chicago',
          'America/Denver',
          'America/Los_Angeles',
          'America/Anchorage',
        ],
      },
    ];
    expect(getTimezonesForCountryName('United States', countries)).toHaveLength(
      5
    );
  });

  it('matches case-insensitively', () => {
    const countries: CountryOption[] = [
      { name: 'India', timezones: ['Asia/Kolkata'] },
    ];
    expect(getTimezonesForCountryName('india', countries)).toEqual([
      'Asia/Kolkata',
    ]);
    expect(getTimezonesForCountryName('INDIA', countries)).toEqual([
      'Asia/Kolkata',
    ]);
  });

  it('returns an empty array for an unknown country or absent name', () => {
    expect(getTimezonesForCountryName('Atlantis', [])).toEqual([]);
    expect(getTimezonesForCountryName(null, [])).toEqual([]);
  });

  it('returns an empty array when the country has no timezones field', () => {
    const countries: CountryOption[] = [{ name: 'Foo' }];
    expect(getTimezonesForCountryName('Foo', countries)).toEqual([]);
  });
});
