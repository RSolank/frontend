import { http, HttpResponse } from 'msw';

import { API_BASE } from '../baseUrl';

// Default metadata handlers used across the suite. Mirror the BE
// Phase 1.3 shape — `countries` carries a `timezones: string[]` and
// the dedicated `/timezones` endpoint serves the full IANA list.

export const metadataHandlers = [
  http.get(`${API_BASE}/metadata/countries`, () =>
    HttpResponse.json({
      countries: [
        {
          name: 'India',
          country_code: '+91',
          default_currency: 'INR',
          timezones: ['Asia/Kolkata'],
        },
        {
          name: 'United States',
          country_code: '+1',
          default_currency: 'USD',
          timezones: [
            'America/New_York',
            'America/Chicago',
            'America/Denver',
            'America/Los_Angeles',
            'America/Anchorage',
          ],
        },
      ],
    })
  ),
  http.get(`${API_BASE}/metadata/currencies`, () =>
    HttpResponse.json({
      currencies: [
        { code: 'INR', label: 'INR - Indian Rupee', symbol: '₹' },
        { code: 'USD', label: 'USD - US Dollar', symbol: '$' },
      ],
    })
  ),
  http.get(`${API_BASE}/metadata/timezones`, () =>
    HttpResponse.json({
      timezones: [
        { name: 'UTC', offset_winter: '+00:00', offset_summer: '+00:00' },
        { name: 'Asia/Kolkata', offset_winter: '+05:30', offset_summer: '+05:30' },
        { name: 'America/New_York', offset_winter: '-05:00', offset_summer: '-04:00' },
        { name: 'America/Chicago', offset_winter: '-06:00', offset_summer: '-05:00' },
        { name: 'America/Denver', offset_winter: '-07:00', offset_summer: '-06:00' },
        { name: 'America/Los_Angeles', offset_winter: '-08:00', offset_summer: '-07:00' },
        { name: 'America/Anchorage', offset_winter: '-09:00', offset_summer: '-08:00' },
        { name: 'Europe/Berlin', offset_winter: '+01:00', offset_summer: '+02:00' },
        { name: 'Europe/London', offset_winter: '+00:00', offset_summer: '+01:00' },
      ],
    })
  ),
  http.get(`${API_BASE}/metadata/constants`, () =>
    HttpResponse.json({
      TOTAL_TAG_ID: 1,
      MISCELLANEOUS_TAG_ID: 2,
      CONSUMPTION_TAX_TAG_ID: 3,
      TAXABLE_TXN_TYPES: ['debit'],
      VALID_TAG_TYPES: ['essential', 'discretionary', 'committed', 'exempted'],
      VALID_TXN_TYPES: ['debit', 'credit'],
      RELATIONSHIP_TYPES: ['friend', 'family'],
    })
  ),
  // BE Phase 2.11 brand identity — default to the production "Aevum"
  // record so the few surfaces that consume the query in tests render
  // a stable name without per-test wiring.
  http.get(`${API_BASE}/metadata/branding`, () =>
    HttpResponse.json({
      name: 'Aevum',
      tagline: 'Future begins today',
      description:
        'Aevum turns the limits you set for yourself into a self-imposed consumption tax — overspend a category and the difference is billed back to you each week.',
      logo_url: null,
    })
  ),
];
