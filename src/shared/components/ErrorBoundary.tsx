import React, { type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: unknown;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: unknown, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  override render() {
    if (!this.state.hasError) return this.props.children;

    const errorMessage =
      this.state.error instanceof Error
        ? this.state.error.message
        : String(this.state.error ?? 'Unknown error');

    return (
      <div
        role="alert"
        className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 p-8 text-center dark:bg-slate-950"
      >
        <h1 className="text-2xl font-semibold text-rose-600 dark:text-rose-400">
          Something went wrong.
        </h1>
        <p className="max-w-md text-sm text-slate-600 dark:text-slate-400">
          An unexpected error occurred. Please try refreshing the page.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-full bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
        >
          Refresh page
        </button>
        {import.meta.env.DEV ? (
          <pre className="mt-4 max-w-2xl overflow-auto rounded-md border border-slate-200 bg-slate-100 p-3 text-left text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
            {errorMessage}
          </pre>
        ) : null}
      </div>
    );
  }
}
