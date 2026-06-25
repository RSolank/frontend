import '@testing-library/jest-dom';
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest';

import { useMotionStore } from './shared/state/motion.store';
import { server } from './test/server';

// happy-dom doesn't implement scrollIntoView; stub it so the shared highlight
// auto-scroll (useRowHighlight → scrollHighlightIntoView) doesn't throw in any
// component test that flashes a row.
Element.prototype.scrollIntoView = () => {};

// Default every test to reduced motion so JS-driven animation (count-ups,
// chart draw-ins, progress fills) snaps to its final state immediately —
// deterministic assertions, and no rAF / framer timers linger across tests
// (a cross-test flake source). Tests that exercise the animation itself opt
// back in explicitly via `useMotionStore.setState({ reducedMotion: false })`
// (see `useCountUp.test`).
beforeEach(() => {
  useMotionStore.setState({ reducedMotion: true });
});

// MSW lifecycle. `error` means an un-handled fetch in a test fails the
// test rather than silently passing — feature batches must register the
// endpoint they expect to hit.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
