import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useCallback } from 'react';

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
  // Legacy escape hatch for callers that need a Tailwind override on
  // the panel. New code should use `size` — `panelClassName` exists so
  // pre-Batch-6.5 callers keep compiling without a refactor.
  panelClassName?: string;
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
  panelClassName,
}: ModalProps) {
  const cap = panelClassName ?? SIZE_CAP[size];

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
        if (!next) guardedClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in dark:bg-slate-950/70" />
        <Dialog.Content
          aria-describedby={description ? undefined : undefined}
          className={`fixed inset-x-0 bottom-0 z-50 flex max-h-[90vh] w-full ${cap} flex-col rounded-t-xl bg-white shadow-xl outline-none sm:top-1/2 sm:right-auto sm:bottom-auto sm:left-1/2 sm:mx-0 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl dark:bg-slate-900 dark:ring-1 dark:ring-slate-800`}
        >
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
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <X aria-hidden="true" size={18} />
              </button>
            </Dialog.Close>
          </header>
          <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer && (
            <footer className="flex flex-wrap justify-end gap-2 border-t border-slate-200 px-5 py-3 dark:border-slate-800">
              {footer}
            </footer>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
