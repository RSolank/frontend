import { adminHandlers } from './admin';
import { authHandlers } from './auth';
import { healthHandlers } from './health';
import { metadataHandlers } from './metadata';
import { tagsHandlers } from './tags';
import { usersHandlers } from './users';

// Add per-feature handler arrays here as Batches 2-8 land. Tests can
// also call `server.use(...)` to register one-off handlers inline.
export const handlers = [
  ...healthHandlers,
  ...authHandlers,
  ...usersHandlers,
  ...metadataHandlers,
  ...tagsHandlers,
  ...adminHandlers,
];
