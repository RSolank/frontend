// Single source of truth for activity priority → tone mapping.
// **Locked spec: priority 1 = highest = danger** (lower number =
// higher severity). Any new feed surface MUST consume this helper
// rather than re-deriving its own mapping — see `task-admin.md` →
// "Follow-ups (after T-admin lands)" → "Locked invariants".

export type Priority = 1 | 2 | 3 | number;

export type Tone = 'danger' | 'warning' | 'neutral';

export function priorityTone(p: Priority): Tone {
  if (p === 1) return 'danger';
  if (p === 2) return 'warning';
  return 'neutral';
}

// Convenience: full text-color utility class for the most common
// rendering site (the row icon + heading). Defined here so the
// danger/warning/neutral semantic tokens (defined in
// src/index.css's @theme block) stay consistent across surfaces.
export function priorityToneClass(p: Priority): string {
  switch (priorityTone(p)) {
    case 'danger':
      return 'text-danger-500 dark:text-danger-400';
    case 'warning':
      return 'text-warning-500 dark:text-warning-400';
    default:
      return 'text-slate-400 dark:text-slate-500';
  }
}
