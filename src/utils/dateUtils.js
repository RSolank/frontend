/**
 * Date utility functions for consistent formatting.
 */

/**
 * Format an ISO date string for display in the UI (e.g., "Mar 5, 2026").
 */
export function formatDisplayDate(isoString) {
  if (!isoString) return '—';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString; // Fallback to raw string
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return isoString;
  }
}

/**
 * Format an ISO date string for use in <input type="date"> (YYYY-MM-DD).
 */
export function formatInputDate(isoString) {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0];
  } catch {
    return '';
  }
}
