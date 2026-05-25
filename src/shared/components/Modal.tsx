import { X } from 'lucide-react';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  // Tailwind size-cap for the panel. Defaults to a comfortable
  // mid-width that fits most forms.
  panelClassName?: string;
}

// Minimal modal: portaled to <body>, click-outside + Escape close,
// scroll-locks the page while open. Focus trap is intentionally not
// implemented — the form's first input naturally takes focus via
// autoFocus and the visible Cancel/Close buttons are reachable via
// tab order without trapping.
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  panelClassName = 'max-w-xl',
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 backdrop-blur-sm sm:items-center sm:p-4 dark:bg-slate-950/70"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`flex max-h-[90vh] w-full ${panelClassName} flex-col rounded-t-xl bg-white shadow-xl sm:rounded-xl dark:bg-slate-900 dark:ring-1 dark:ring-slate-800`}
      >
        <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3 dark:border-slate-800">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X aria-hidden="true" size={18} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <footer className="flex flex-wrap justify-end gap-2 border-t border-slate-200 px-5 py-3 dark:border-slate-800">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body
  );
}
