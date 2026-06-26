import { m } from 'framer-motion';

import { useStabilizedEntrance } from './staggerContext';
import { formFieldReveal, formStaggerContainer } from './variants';

interface ModalRevealProps {
  // True once the surface's data is ready to render. The rise (beat 3) holds
  // until this flips, so fields never animate while still fetching. Defaults to
  // true for surfaces whose content is already present when they mount (the
  // bell only renders once its feed has loaded). See `useStabilizedEntrance`
  // for the fallback that un-strands a slow/failed fetch.
  ready?: boolean;
  className?: string;
  children: React.ReactNode;
}

// Container for the app-wide three-beat in-modal field reveal (T-nav-ia-reorg
// #6). Drop it around a modal's field groups and wrap each group in
// <RevealField>; pass `ready` = all-data-loaded. The choreography (panel land →
// fade → gated rise) lives in `formFieldReveal` — see that comment. Outside a
// <Modal> (no StaggerSettledContext) or under reduced motion the phase is
// 'static', so fields render final with no motion: a non-adopting modal, or a
// reduced-motion user, simply gets static fields.
export function ModalReveal({
  ready = true,
  className,
  children,
}: ModalRevealProps) {
  const phase = useStabilizedEntrance(ready);
  return (
    <m.div
      className={className}
      variants={formStaggerContainer}
      // 'static' → render final (initial=false). Otherwise start content-rich
      // ('shell', opacity 1) so the growing panel isn't an empty box.
      initial={phase === 'static' ? false : 'shell'}
      // 'hold' → fade to (and rest at) 0 while data loads; 'static'/'go' → rise.
      animate={phase === 'hold' ? 'hidden' : 'show'}
    >
      {children}
    </m.div>
  );
}

interface RevealFieldProps {
  className?: string;
  children: React.ReactNode;
}

// One field group inside a <ModalReveal>. Inherits the container's beat (shell →
// fade → rise) via the shared `formFieldReveal` variant.
export function RevealField({ className, children }: RevealFieldProps) {
  return (
    <m.div className={className} variants={formFieldReveal}>
      {children}
    </m.div>
  );
}
