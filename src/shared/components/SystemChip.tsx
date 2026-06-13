interface SystemChipProps {
  /** Optional extra classes for layout (e.g. margins) at the call site. */
  className?: string;
}

// Small inline chip marking a row as system-created — i.e. seeded by the app
// (created_by == SYSTEM), not added by the user. Rendered on the seeded-data
// list pages (beneficiaries, categorization rules, taxation rules, categories)
// so the user can tell shipped rows from ones they added.
//
// The word is "System" (provenance), NOT "Default": the codebase does not
// transfer provenance when a user edits a seeded row (created_by stays SYSTEM),
// so a row keeps this marker even after its values are changed. "Default" would
// then be a lie ("no longer the default value"); "System" stays true — it
// describes who originally created the row, which editing never changes.
export function SystemChip({ className = '' }: SystemChipProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400 ${className}`}
      title="Created by the system. You can still edit or remove it."
    >
      System
    </span>
  );
}
