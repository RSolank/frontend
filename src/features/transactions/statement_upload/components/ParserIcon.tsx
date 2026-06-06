import { FileText } from 'lucide-react';
import { useState } from 'react';

// Maps BE parser keys (`backend/app/modules/transactions/
// statement_upload/parsers/registry.py`) to brand icons surfaced
// alongside the parser label in the picker + the parser list.
//
// Icons are served from the simpleicons.org CDN (CC0). We treat the
// network fetch as optional — `onError` falls back to a generic file
// icon so the picker still renders correctly when offline or when
// the brand isn't in simpleicons. The map is forward-looking: only
// `phonepe` + `csv` are wired on the BE today, but Paytm + Google
// Pay slots are pre-populated so they light up the day BE registers
// their parsers (Decision pending — see the
// `transactions.statement-upload` slot in `.scratch/task-platform.md`).

interface BrandSpec {
  slug: string | null;
  color: string;
}

// simpleicons slugs use lowercase letters/digits/dashes. Trying a
// stale slug just falls back to the FileText icon — it's not a hard
// dependency. Colors are the brand hex without the `#`.
const PARSER_BRAND: Record<string, BrandSpec> = {
  phonepe: { slug: 'phonepe', color: '5F259F' },
  paytm: { slug: 'paytm', color: '00BAF2' },
  googlepay: { slug: 'googlepay', color: '4285F4' },
  gpay: { slug: 'googlepay', color: '4285F4' },
  // Generic CSV — no brand. Falls through to the file-icon fallback.
  csv: { slug: null, color: '64748B' },
};

interface ParserIconProps {
  parserKey: string;
  size?: number;
}

export function ParserIcon({ parserKey, size = 18 }: ParserIconProps) {
  const [failed, setFailed] = useState(false);
  const spec = PARSER_BRAND[parserKey];
  if (!spec || !spec.slug || failed) {
    return (
      <FileText
        aria-hidden="true"
        size={size}
        className="text-slate-500 dark:text-slate-400"
      />
    );
  }
  const src = `https://cdn.simpleicons.org/${spec.slug}/${spec.color}`;
  // onError is a network-failure fallback, not a user interaction —
  // jsx-a11y/no-noninteractive-element-interactions doesn't model
  // that distinction.
  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <img
      src={src}
      width={size}
      height={size}
      alt=""
      onError={() => setFailed(true)}
      className="shrink-0 object-contain"
      style={{ width: size, height: size }}
      loading="lazy"
    />
  );
}
