// React-query keys for the treasury (Savings) feature. The summary read
// is parameterised by the trend window (`weeks`) so the Savings page and a
// future dashboard hero requesting a different window don't share a cache
// entry.
export const treasuryKeys = {
  all: ['treasury'] as const,
  summary: (weeks: number) => [...treasuryKeys.all, 'summary', weeks] as const,
} as const;
