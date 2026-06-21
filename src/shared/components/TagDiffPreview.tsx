interface TagDiffPreviewProps {
  // Tag ids added / removed relative to the baseline being edited.
  added: number[];
  removed: number[];
  // Resolves a tag id to its display label (kept out of the component so it
  // stays decoupled from any particular tag shape).
  resolveLabel: (id: number) => string;
  // Header text — e.g. "Changes from the saved rule" / "Tag changes".
  title: string;
}

// Shared added/removed tag preview. Lets the user see exactly which tags a save
// will add (green +) or drop (struck-through −) before committing, instead of
// relying on memory. Used by the categorization-rule form and the transaction
// edit form. Renders nothing when there's no change, so callers can mount it
// unconditionally.
export function TagDiffPreview({
  added,
  removed,
  resolveLabel,
  title,
}: TagDiffPreviewProps) {
  if (added.length === 0 && removed.length === 0) return null;
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/40">
      <p className="mb-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
        {title}
      </p>
      <div className="flex flex-wrap gap-2">
        {added.map((id) => (
          <span
            key={`a-${id}`}
            className="bg-success-100 text-success-800 dark:bg-success-950/50 dark:text-success-300 inline-flex items-center gap-0.5 rounded-full px-2.5 py-0.5 text-sm font-medium"
          >
            <span aria-hidden="true">+</span>
            {resolveLabel(id)}
          </span>
        ))}
        {removed.map((id) => (
          <span
            key={`r-${id}`}
            className="inline-flex items-center gap-0.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-sm font-medium text-slate-400 line-through dark:bg-slate-800 dark:text-slate-500"
          >
            <span aria-hidden="true">−</span>
            {resolveLabel(id)}
          </span>
        ))}
      </div>
    </div>
  );
}
