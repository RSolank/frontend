import '@testing-library/jest-dom';
import { afterAll, afterEach, beforeAll } from 'vitest';

import { server } from './test/server';

// MSW lifecycle. `error` means an un-handled fetch in a test fails the
// test rather than silently passing — feature batches must register the
// endpoint they expect to hit.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
