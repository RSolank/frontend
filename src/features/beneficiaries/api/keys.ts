// React-query keys for the beneficiaries feature. The mutations
// (create / update / delete / merge) invalidate `beneficiaryKeys.all`
// so list + detail views refresh in lockstep.
export const beneficiaryKeys = {
  all: ['beneficiaries'] as const,
  list: () => [...beneficiaryKeys.all, 'list'] as const,
  detail: (id: number | string) =>
    [...beneficiaryKeys.all, 'detail', String(id)] as const,
  relationships: () => [...beneficiaryKeys.all, 'relationships'] as const,
} as const;
