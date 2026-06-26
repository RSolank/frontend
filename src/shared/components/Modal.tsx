import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, m, type TargetAndTransition } from 'framer-motion';
import { X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { StaggerSettledContext } from '../motion/staggerContext';
import { useReducedMotionPref } from '../motion/useReducedMotionPref';
import { MOTION_TOKENS } from '../motion/variants';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: ModalSize;
  // Block stray-click / Escape close if the wrapped form is dirty.
  // Caller is responsible for setting `isDirty` from its form state.
  confirmOnDirty?: boolean;
  isDirty?: boolean;
  // When false, the modal can only be closed by an explicit in-content
  // action: the header X is hidden and Escape / overlay-click are blocked.
  // Use for must-acknowledge surfaces (e.g. a one-time backup-codes reveal).
  // Default true. The caller still wires `onClose` to its own Done action.
  dismissible?: boolean;
  // Legacy escape hatch for callers that need a Tailwind override on
  // the panel. New code should use `size` — `panelClassName` exists so
  // pre-Batch-6.5 callers keep compiling without a refactor.
  panelClassName?: string;
  // Optional slot for modal-level actions (e.g. a Trash icon button
  // for destructive actions). Renders between the title block and the
  // close X — so the action is discoverable at the top of the modal
  // without crowding the footer's Cancel / Save cluster. Use icon-only
  // buttons sized 32×32 to match the close button's chrome.
  headerActions?: React.ReactNode;
  // Optional motion anchors (T-nav-ia-reorg). `originRef` = the element the
  // panel **scales up out of** on open; `destinationRef` = the element it
  // **collapses toward** on close (defaults to `originRef`). The destination
  // can differ — e.g. a pointed-at item the modal hands off to. Both absent
  // (or reduced motion) → the plain center rise/fade, so every existing
  // consumer is untouched. This is the infra; the app-wide rollout threads
  // each modal's trigger/target ref here (the per-surface wiring).
  originRef?: React.RefObject<HTMLElement | null>;
  destinationRef?: React.RefObject<HTMLElement | null>;
}

// The offset from screen centre to a ref's centre, so a panel can start/end
// translated onto that element. Null when the ref is missing.
function deltaToward(
  ref: React.RefObject<HTMLElement | null> | undefined
): { x: number; y: number } | null {
  const el = ref?.current;
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return {
    x: r.left + r.width / 2 - window.innerWidth / 2,
    y: r.top + r.height / 2 - window.innerHeight / 2,
  };
}

// Start/end size of the "small modal" the panel grows from / shrinks to. Equal
// both ways: the panel grows from / shrinks to nearly a point on the anchor, so
// the open and close are symmetric and the close leaves negligible residual at
// the hard-cut (no panel opacity needed). Fields render visible THROUGHOUT the
// grow (the two-beat's pulse reveal fires after land — see ActivityFeedModal),
// so there is no empty shell to hide (tunable).
const PANEL_START_SCALE = 0.1;
const PANEL_EXIT_SCALE = 0.1;

// Grow/shrink timing for the anchored path (shared tokens so the in-modal field
// fade can derive its delay from the same open duration — see `formFieldReveal`).
// ASYMMETRIC by design: open is quicker than close because the open has a SECOND
// beat (the field fade→rise) after the panel lands, while the close is
// panel-only — so a faster grow keeps the total open from reading ~2× the close
// (T-nav-ia-reorg #6). A single uniform ease both ways (no expo) keeps velocity
// even — expo's slow-in reads as a "pause" before the collapse. Panel opacity is
// CONSTANT: the overlay backdrop cues appear/disappear and the fields carry
// their own settle.
const PANEL_OPEN_DUR = MOTION_TOKENS.modalPanelOpen;
const PANEL_CLOSE_DUR = MOTION_TOKENS.modalPanelClose;
const PANEL_EASE = 'easeOut' as const;

// The panel's enter/exit motion. With an origin/destination (and motion on),
// the panel starts as a **small modal centred on the origin** and grows +
// glides to the screen centre; on close it shrinks + collapses toward the
// destination (defaults to origin). The CSS centering lives on the positioning
// wrapper, so framer's x/y here is a pure offset FROM centre. Each anchored
// variant carries its OWN transition so open/close can differ in duration while
// sharing one easing. No anchors (or reduced motion) → the plain center
// rise/fade (every consumer untouched), timed by the shared `transition` prop.
function panelMotion(
  originRef: React.RefObject<HTMLElement | null> | undefined,
  destinationRef: React.RefObject<HTMLElement | null> | undefined,
  reduced: boolean
): {
  initial: TargetAndTransition;
  animate: TargetAndTransition;
  exit: TargetAndTransition;
} {
  const openDelta = reduced ? null : deltaToward(originRef);
  // Close target: the destination element if it's actually in the DOM, else
  // fall back to the origin. (A provided-but-empty destinationRef — e.g. a
  // freshly-created row that hasn't mounted yet, or a plain discard — must
  // collapse toward the origin, NOT to centre.)
  const closeDelta = reduced
    ? null
    : (deltaToward(destinationRef) ?? deltaToward(originRef));
  if (!openDelta && !closeDelta) {
    return {
      initial: { opacity: 0, y: 16 },
      animate: { opacity: 1, x: 0, y: 0, scale: 1 },
      exit: { opacity: 0, y: 16 },
    };
  }
  const o = openDelta ?? { x: 0, y: 0 };
  const c = closeDelta ?? { x: 0, y: 0 };
  return {
    initial: { scale: PANEL_START_SCALE, x: o.x, y: o.y },
    animate: {
      scale: 1,
      x: 0,
      y: 0,
      transition: { duration: PANEL_OPEN_DUR, ease: PANEL_EASE },
    },
    exit: {
      scale: PANEL_EXIT_SCALE,
      x: c.x,
      y: c.y,
      transition: { duration: PANEL_CLOSE_DUR, ease: PANEL_EASE },
    },
  };
}

const SIZE_CAP: Record<ModalSize, string> = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
};

// Modal primitive backed by Radix UI's Dialog (focus trap, escape-key,
// ARIA dialog semantics, scroll lock, portal). Responsive: bottom-sheet
// on <sm, centered card on sm+. See CONTRIBUTING.md §6 "Modal pattern".
//
// Motion (the shared scaffold): the panel rises + fades in like a card and
// collapses on close, via framer (`forceMount` + `AnimatePresence` so the exit
// plays before unmount). The centering transform lives on a positioning
// WRAPPER while framer animates the inner PANEL, so the rise never fights the
// `-translate` centering. Reduced motion collapses it to an instant fade.
//
// TWO-BEAT floor: the panel publishes a "settled" signal (StaggerSettledContext)
// once it has landed — so a later task can wrap a modal's fields in
// `<StaggerItem>` and they'll rise as the second beat with zero extra plumbing.
// Until then fields render unanimated (this scaffold sets only the shell floor).
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  confirmOnDirty = false,
  isDirty = false,
  dismissible = true,
  panelClassName,
  headerActions,
  originRef,
  destinationRef,
}: ModalProps) {
  const cap = panelClassName ?? SIZE_CAP[size];
  const reduced = useReducedMotionPref();
  // Computed every render (cheap — only reads a rect when an anchor ref is
  // passed) so the exit delta still points at the destination when
  // AnimatePresence plays the close. No anchors → plain center rise/fade.
  const motion = panelMotion(originRef, destinationRef, reduced);
  const dur = reduced ? 0 : 0.2;

  // The two-beat signal for in-modal fields (consumed once a later task wraps
  // them). Reset on each open; flipped true when the panel finishes rising.
  const [settled, setSettled] = useState(false);
  // Discard-confirm overlay (replaces window.confirm). Shown when a dirty modal
  // is dismissed via X / Escape / overlay-click; reset on each open.
  const [discardOpen, setDiscardOpen] = useState(false);
  useEffect(() => {
    if (open) {
      setSettled(false);
      setDiscardOpen(false);
    }
  }, [open]);

  // Guarded close for the accidental-dismiss paths (X / Escape / overlay). A
  // dirty form raises the in-modal discard confirm instead of closing; the
  // explicit footer Cancel stays a direct dismiss (it already signals intent).
  const guardedClose = useCallback(() => {
    if (confirmOnDirty && isDirty) {
      setDiscardOpen(true);
      return;
    }
    onClose();
  }, [confirmOnDirty, isDirty, onClose]);

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        // When non-dismissible, ignore Radix's auto-close (Escape / overlay) —
        // only an explicit in-content action may close the modal.
        if (!next && dismissible) guardedClose();
      }}
    >
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <m.div
                className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm dark:bg-slate-950/70"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: dur, ease: 'easeOut' }}
              />
            </Dialog.Overlay>
            <Dialog.Content
              asChild
              forceMount
              onEscapeKeyDown={dismissible ? undefined : (e) => e.preventDefault()}
              onPointerDownOutside={
                dismissible ? undefined : (e) => e.preventDefault()
              }
              onInteractOutside={
                dismissible ? undefined : (e) => e.preventDefault()
              }
            >
              {/* Positioning wrapper — CSS centering only (no animated
                  transform), so framer's rise on the panel never fights it. */}
              <div
                className={`fixed inset-x-0 bottom-0 z-50 w-full ${cap} outline-none sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2`}
              >
                <m.div
                  className="relative flex max-h-[90vh] w-full flex-col rounded-t-xl bg-white shadow-xl sm:rounded-xl dark:bg-slate-900 dark:ring-1 dark:ring-slate-800"
                  initial={motion.initial}
                  animate={motion.animate}
                  exit={motion.exit}
                  transition={{ duration: dur, ease: 'easeOut' }}
                  onAnimationComplete={() => setSettled(true)}
                >
                  <StaggerSettledContext.Provider value={settled}>
                    <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-3 dark:border-slate-800">
                      <div className="min-w-0">
                        <Dialog.Title className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                          {title}
                        </Dialog.Title>
                        {description && (
                          <Dialog.Description className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                            {description}
                          </Dialog.Description>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {headerActions}
                        {dismissible && (
                          <Dialog.Close asChild>
                            <button
                              type="button"
                              aria-label="Close"
                              className="focus-visible:ring-accent-500 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-2 focus-visible:outline-none dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                            >
                              <X aria-hidden="true" size={18} />
                            </button>
                          </Dialog.Close>
                        )}
                      </div>
                    </header>
                    <div className="flex-1 overflow-y-auto px-5 py-4">
                      {children}
                    </div>
                    {footer && (
                      <footer className="flex flex-wrap justify-end gap-2 border-t border-slate-200 px-5 py-3 dark:border-slate-800">
                        {footer}
                      </footer>
                    )}
                    {discardOpen && (
                      <div className="absolute inset-0 z-10 flex items-center justify-center rounded-t-xl bg-slate-950/40 p-4 backdrop-blur-sm sm:rounded-xl">
                        <div
                          role="alertdialog"
                          aria-label="Discard changes"
                          className="w-full max-w-xs rounded-lg bg-white p-4 shadow-xl dark:bg-slate-900 dark:ring-1 dark:ring-slate-700"
                        >
                          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            Discard unsaved changes?
                          </p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            Your edits to this form will be lost.
                          </p>
                          <div className="mt-4 flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setDiscardOpen(false)}
                              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                              Keep editing
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setDiscardOpen(false);
                                onClose();
                              }}
                              className="bg-danger-600 hover:bg-danger-700 focus-visible:ring-danger-500 rounded-md px-3 py-1.5 text-sm font-semibold text-white transition-colors focus-visible:ring-2 focus-visible:outline-none"
                            >
                              Discard
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </StaggerSettledContext.Provider>
                </m.div>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
