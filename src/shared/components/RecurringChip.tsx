import { RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';

interface RecurringChipProps {
  // When set, the chip becomes a link to the recurring template (which is
  // flashed + scrolled into view on the recurring page). Omitted → static chip.
  templateId?: number | null;
  className?: string;
}

// Marks a transaction that settled a recurring bill. Uses the VIOLET tone —
// the app convention for chips that mark something significant or carry a link
// (distinct from neutral-slate tags and the teal brand-accent). See
// conventions.md → "Chip tones".
const BASE =
  'inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700 dark:bg-violet-950/50 dark:text-violet-300';

export function RecurringChip({
  templateId,
  className = '',
}: RecurringChipProps) {
  const content = (
    <>
      <RefreshCw aria-hidden size={11} />
      Recurring
    </>
  );

  if (templateId != null) {
    return (
      <Link
        to={`/recurring?template=${templateId}`}
        className={`${BASE} no-underline transition-colors hover:bg-violet-200 dark:hover:bg-violet-900/70 ${className}`}
        title="View the recurring template"
      >
        {content}
      </Link>
    );
  }

  return (
    <span className={`${BASE} ${className}`} title="Settled a recurring bill">
      {content}
    </span>
  );
}
