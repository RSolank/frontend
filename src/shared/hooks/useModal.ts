import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

interface UseModalOptions {
  // When set, modal open/close is mirrored into the URL search param so
  // the state survives reloads and is shareable as a deep link.
  // Boolean mode: `?<urlKey>=true` toggles `isOpen`. The hook ignores
  // any value — presence is what matters.
  urlKey?: string;
}

interface UseModalReturn {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

// Boolean-presence modal: open() → `?<urlKey>=true`, close() → key removed.
// Without `urlKey`, falls back to local component state.
export function useModal({ urlKey }: UseModalOptions = {}): UseModalReturn {
  const [localOpen, setLocalOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  const urlOpen = urlKey != null && searchParams.has(urlKey);
  const isOpen = urlKey != null ? urlOpen : localOpen;

  const open = useCallback(() => {
    if (urlKey != null) {
      const next = new URLSearchParams(searchParams);
      next.set(urlKey, 'true');
      setSearchParams(next, { replace: false });
    } else {
      setLocalOpen(true);
    }
  }, [urlKey, searchParams, setSearchParams]);

  const close = useCallback(() => {
    if (urlKey != null) {
      const next = new URLSearchParams(searchParams);
      next.delete(urlKey);
      setSearchParams(next, { replace: true });
    } else {
      setLocalOpen(false);
    }
  }, [urlKey, searchParams, setSearchParams]);

  return useMemo(() => ({ isOpen, open, close }), [isOpen, open, close]);
}

interface UseUrlValueModalReturn {
  value: string | null;
  isOpen: boolean;
  openWith: (value: string) => void;
  close: () => void;
}

// Value-carrying modal: open(id) → `?<urlKey>=<id>`. Used for "edit X" or
// "view X" flows where the target id is part of the URL — reload-safe
// and shareable.
export function useUrlValueModal(urlKey: string): UseUrlValueModalReturn {
  const [searchParams, setSearchParams] = useSearchParams();
  const value = searchParams.get(urlKey);

  const openWith = useCallback(
    (next: string) => {
      const params = new URLSearchParams(searchParams);
      params.set(urlKey, next);
      setSearchParams(params, { replace: false });
    },
    [urlKey, searchParams, setSearchParams]
  );

  const close = useCallback(() => {
    const params = new URLSearchParams(searchParams);
    params.delete(urlKey);
    setSearchParams(params, { replace: true });
  }, [urlKey, searchParams, setSearchParams]);

  return useMemo(
    () => ({ value, isOpen: value != null, openWith, close }),
    [value, openWith, close]
  );
}
