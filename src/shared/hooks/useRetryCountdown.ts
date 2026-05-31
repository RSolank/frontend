import { useEffect, useRef, useState } from 'react';

// Live countdown for a `Retry-After` header value. Pass the seconds
// returned by the server (parsed in `apiClient` and attached to the
// thrown `ApiError`); the hook returns the remaining seconds,
// re-rendering once per second until zero. Pass `null` to clear the
// countdown — the next render returns `null`.
//
// Used by login / register / recovery forms to render an inline
// "Too many attempts, try again in N seconds." message when the
// backend rate-limits the request (auth.rate-limit) or device-
// blocks the user (auth.devices).
//
// Mounted once per form; the input changes whenever a fresh error
// arrives, which restarts the timer at the new value. Cleanup runs
// on unmount + on every input change so we never stack intervals.
export function useRetryCountdown(seconds: number | null): number | null {
  const [remaining, setRemaining] = useState<number | null>(seconds);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (seconds === null || seconds <= 0) {
      setRemaining(seconds);
      return undefined;
    }
    setRemaining(seconds);
    const interval = setInterval(() => {
      setRemaining((prev) => {
        if (prev === null || prev <= 1) {
          if (intervalRef.current !== null) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          return prev === null ? null : 0;
        }
        return prev - 1;
      });
    }, 1000);
    intervalRef.current = interval;
    return () => {
      clearInterval(interval);
      intervalRef.current = null;
    };
  }, [seconds]);

  return remaining;
}

// Formats a seconds count for the inline error message. Picks the
// coarsest unit that fits — "in 45 seconds" vs "in 3 minutes" — so
// long lockouts don't display as 1800s.
export function formatRetryAfter(seconds: number): string {
  if (seconds <= 1) return 'in 1 second';
  if (seconds < 60) return `in ${seconds} seconds`;
  const minutes = Math.ceil(seconds / 60);
  if (minutes === 1) return 'in 1 minute';
  if (minutes < 60) return `in ${minutes} minutes`;
  const hours = Math.ceil(minutes / 60);
  return hours === 1 ? 'in 1 hour' : `in ${hours} hours`;
}
