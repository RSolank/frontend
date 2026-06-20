import '@testing-library/jest-dom';
import { afterAll, afterEach, beforeAll } from 'vitest';

import { server } from './test/server';

// happy-dom doesn't implement scrollIntoView; stub it so the shared highlight
// auto-scroll (useRowHighlight → scrollHighlightIntoView) doesn't throw in any
// component test that flashes a row.
Element.prototype.scrollIntoView = () => {};

// MSW lifecycle. `error` means an un-handled fetch in a test fails the
// test rather than silently passing — feature batches must register the
// endpoint they expect to hit.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
