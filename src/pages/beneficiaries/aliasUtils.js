/** Format aliases for list/detail display: (Jio, Airtel) */
export function formatAliasesDisplay(aliases) {
  if (!aliases || aliases.length === 0) return '';
  return `(${aliases.join(', ')})`;
}

export function buildAliasCheckUrl(alias, excludeUid = null) {
  const params = new URLSearchParams({ alias: alias.trim() });
  if (excludeUid != null) params.set('exclude_uid', String(excludeUid));
  return `/api/beneficiaries/check-alias?${params.toString()}`;
}
