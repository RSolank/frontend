import { http, HttpResponse } from 'msw';

// Placeholder metadata handlers (full set lands in Batch 3). Batch 2's
// Register page hits /countries + /currencies during locale defaulting,
// so this gives the test a predictable list to assert against.

export const metadataHandlers = [
  http.get('http://localhost:4000/api/metadata/countries', () =>
    HttpResponse.json({
      countries: [
        {
          name: 'India',
          country_code: '+91',
          default_currency: 'INR',
          timezone: 'Asia/Kolkata',
        },
        {
          name: 'United States',
          country_code: '+1',
          default_currency: 'USD',
          timezone: 'America/New_York',
        },
      ],
    })
  ),
  http.get('http://localhost:4000/api/metadata/currencies', () =>
    HttpResponse.json({
      currencies: [
        { code: 'INR', label: 'INR - Indian Rupee', symbol: '₹' },
        { code: 'USD', label: 'USD - US Dollar', symbol: '$' },
      ],
    })
  ),
  http.get('http://localhost:4000/api/metadata/constants', () =>
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
];
