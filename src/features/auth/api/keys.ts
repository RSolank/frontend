export const authKeys = {
  all: ['auth'] as const,
  constants: () => [...authKeys.all, 'constants'] as const,
  sessions: () => [...authKeys.all, 'sessions'] as const,
} as const;
