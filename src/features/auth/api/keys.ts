export const authKeys = {
  all: ['auth'] as const,
  me: () => [...authKeys.all, 'me'] as const,
  constants: () => [...authKeys.all, 'constants'] as const,
} as const;

export const userKeys = {
  all: ['users'] as const,
  preferences: () => [...userKeys.all, 'preferences'] as const,
} as const;
