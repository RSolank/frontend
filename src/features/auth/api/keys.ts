export const authKeys = {
  all: ['auth'] as const,
  constants: () => [...authKeys.all, 'constants'] as const,
  sessions: () => [...authKeys.all, 'sessions'] as const,
  devices: () => [...authKeys.all, 'devices'] as const,
  security: () => [...authKeys.all, 'security'] as const,
} as const;
