// React-query keys for the metadata feature. The metadata endpoints are
// effectively static reference data per session — a long `staleTime`
// makes the dropdowns cheap to mount on every page.
export const metadataKeys = {
  all: ['metadata'] as const,
  countries: () => [...metadataKeys.all, 'countries'] as const,
  currencies: () => [...metadataKeys.all, 'currencies'] as const,
  constants: () => [...metadataKeys.all, 'constants'] as const,
} as const;
