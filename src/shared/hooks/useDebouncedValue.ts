import { useEffect, useState } from 'react';

// Returns `value` only after it has been stable for `delayMs`.
// Useful for type-as-you-search inputs where firing a fetch per
// keystroke is wasteful — wire `debounced` into the query and the
// raw `value` into the input. Cancelling on unmount/re-trigger is
// handled by the useEffect cleanup.
//
// Lives in `shared/hooks/` because both the admin user-search and
// future admin cemetery-search rely on it; lift here when a third
// consumer appears or keep colocated if it stays admin-local.
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);

  return debounced;
}
