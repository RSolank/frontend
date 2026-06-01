import { activityHandlers } from './activity';
import { adminHandlers } from './admin';
import { authHandlers } from './auth';
import { bankAccountHandlers } from './bank-accounts';
import { expenseTrackerHandlers } from './expense-tracker';
import { healthHandlers } from './health';
import { metadataHandlers } from './metadata';
import { recurringHandlers } from './recurring';
import { statementUploadHandlers } from './statement-upload';
import { tagsHandlers } from './tags';
import { taxationHandlers } from './taxation';
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
  ...activityHandlers,
  ...expenseTrackerHandlers,
  ...taxationHandlers,
  ...recurringHandlers,
  ...statementUploadHandlers,
  ...bankAccountHandlers,
];
