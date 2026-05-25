// Pure utilities shared between the alias chip input and the
// beneficiaries list display. Kept here (not in shared/) because they
// only make sense inside the beneficiary flow.

/** Format aliases for list/detail display: (Jio, Airtel) */
export function formatAliasesDisplay(
  aliases: string[] | null | undefined
): string {
  if (!aliases || aliases.length === 0) return '';
  return `(${aliases.join(', ')})`;
}

/**
 * Builds the URL used by the backend's alias-uniqueness probe. Encodes
 * the alias safely and threads through an `exclude_uid` so an edit
 * doesn't trip on its own current alias.
 */
export function buildAliasCheckUrl(
  alias: string,
  excludeUid: number | null = null
): string {
  const params = new URLSearchParams({ alias: alias.trim() });
  if (excludeUid != null) params.set('exclude_uid', String(excludeUid));
  return `/api/beneficiaries/check-alias?${params.toString()}`;
}
