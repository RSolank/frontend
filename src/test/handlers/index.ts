import { healthHandlers } from './health';

// Add per-feature handler arrays here as Batches 2-8 land. Tests can
// also call `server.use(...)` to register one-off handlers inline.
export const handlers = [...healthHandlers];
