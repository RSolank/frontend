export const authKeys = {
  all: ['auth'] as const,
  constants: () => [...authKeys.all, 'constants'] as const,
} as const;
