import { useEffect } from 'react';

// Idle prefetch helper — warms a code-split chunk after a short delay
// so the click-driven `lazy()` consumer never has to fetch on the hot
// path. The dynamic import resolves once, the bundler caches the
// module by URL, and any subsequent `lazy(() => import(SAME_URL))`
// resolves synchronously from cache.
//
// Mechanism (in order):
//   1. setTimeout(delayMs) — gives first paint + initial user
//      interactions room to breathe before we add network/CPU work.
//   2. requestIdleCallback (when available) — defers the actual
//      import() to a true idle window with a 2s timeout cap so the
//      prefetch always fires eventually even on busy main threads.
//      Falls back to immediate fire if RIC isn't supported (Safari).
//   3. Idempotence: each `importFn` is fired at most once per page
//      session via a module-level WeakSet — re-mount safe.
//
// Returns a cleanup that cancels the pending timer + idle callback,
// so a component that unmounts before the delay elapses doesn't pull
// the chunk anyway.

const FIRED = new WeakSet<() => Promise<unknown>>();

// `requestIdleCallback` isn't in TS's default lib (Safari skips it),
// so we feature-detect via a narrow typed handle instead of widening
// the global Window declaration.
type RequestIdleCallback = (
  cb: () => void,
  opts?: { timeout?: number }
) => number;
type CancelIdleCallback = (handle: number) => void;

function getIdleApi(): {
  request?: RequestIdleCallback;
  cancel?: CancelIdleCallback;
} {
  const w = window as unknown as {
    requestIdleCallback?: RequestIdleCallback;
    cancelIdleCallback?: CancelIdleCallback;
  };
  return { request: w.requestIdleCallback, cancel: w.cancelIdleCallback };
}

export function prefetchOnIdle(
  importFn: () => Promise<unknown>,
  delayMs: number
): () => void {
  let cancelled = false;
  let idleId: number | undefined;

  const fire = () => {
    if (cancelled || FIRED.has(importFn)) return;
    FIRED.add(importFn);
    void importFn().catch(() => {
      // If the import fails (offline, deploy-time chunk hash drift),
      // drop the memo so a later retry path can try again.
      FIRED.delete(importFn);
    });
  };

  const timeoutId = window.setTimeout(() => {
    const api = getIdleApi();
    if (api.request) {
      idleId = api.request(fire, { timeout: 2000 });
    } else {
      fire();
    }
  }, delayMs);

  return () => {
    cancelled = true;
    window.clearTimeout(timeoutId);
    const api = getIdleApi();
    if (idleId !== undefined && api.cancel) {
      api.cancel(idleId);
    }
  };
}

export interface PrefetchEntry {
  load: () => Promise<unknown>;
  delayMs: number;
}

// Hook variant — schedules a batch of prefetches and cancels them all
// on unmount. Pass `enabled=false` to no-op (e.g., for auth-gated
// chunks when the user is unauthenticated). Stable `entries`
// references avoid re-scheduling on every render; if you build the
// array inline, wrap it in `useMemo` at the call site.
export function useIdlePrefetch(
  entries: readonly PrefetchEntry[],
  enabled = true
): void {
  useEffect(() => {
    if (!enabled || entries.length === 0) return undefined;
    const cancels = entries.map((e) => prefetchOnIdle(e.load, e.delayMs));
    return () => cancels.forEach((c) => c());
  }, [entries, enabled]);
}
