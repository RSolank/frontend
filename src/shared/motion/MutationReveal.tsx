import { AnimatePresence } from 'framer-motion';
import { type ReactNode } from 'react';

// Per-field MUTATION motion (T-nav-ia-reorg shared primitive). For a field whose
// CONTENT recomputes reactively — e.g. derived chips that change when a value
// resolves or the user adds/removes one. Wrap the mapped, KEYED items in
// <MutationPresence> and spread `mutationItemProps` onto each item's motion
// element — keep an `m.*` element as the DIRECT child so framer can animate its
// exit:
//
//   <MutationPresence>
//     {tags.map((t) => (
//       <m.span key={t.id} {...mutationItemProps} className="chip">…</m.span>
//     ))}
//   </MutationPresence>
//
// On every change the removed items fade out and the new ones rise in (the field
// "flips" instead of snapping). `initial={false}` suppresses the first-mount
// pass — the surrounding entrance reveal (<ModalReveal>) already carries the
// block in; thereafter each add/remove animates. `popLayout` lets a removed item
// animate out while the row reflows. Reduced motion: the app-wide MotionConfig
// neutralises the transforms.
export function MutationPresence({ children }: { children: ReactNode }) {
  return (
    <AnimatePresence initial={false} mode="popLayout">
      {children}
    </AnimatePresence>
  );
}

// Spread onto each keyed `m.*` item inside a <MutationPresence>. One definition
// so every mutating field flips with the same character — retune here, all update.
export const mutationItemProps = {
  layout: true,
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: { duration: 0.18, ease: 'easeOut' },
} as const;
