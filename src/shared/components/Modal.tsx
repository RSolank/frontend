import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, m } from 'framer-motion';
import { X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { StaggerSettledContext } from '../motion/staggerContext';
import { useReducedMotionPref } from '../motion/useReducedMotionPref';

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
}: ModalProps) {
  const cap = panelClassName ?? SIZE_CAP[size];
  const reduced = useReducedMotionPref();
  const dur = reduced ? 0 : 0.2;

  // The two-beat signal for in-modal fields (consumed once a later task wraps
  // them). Reset on each open; flipped true when the panel finishes rising.
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (open) setSettled(false);
  }, [open]);

  const guardedClose = useCallback(() => {
    if (
      confirmOnDirty &&
      isDirty &&
      !window.confirm('Discard unsaved changes?')
    ) {
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
                  className="flex max-h-[90vh] w-full flex-col rounded-t-xl bg-white shadow-xl sm:rounded-xl dark:bg-slate-900 dark:ring-1 dark:ring-slate-800"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 16 }}
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
