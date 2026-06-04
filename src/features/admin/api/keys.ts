// React-query keys for the admin feature. Keep keys narrow + typed
// so admin pages can invalidate the exact slice they mutate
// (e.g. lock/unlock in B1 will invalidate users(...) so the list
// re-renders the status chip).

export interface AdminUsersListParams {
  q: string;
  include_deleted: boolean;
}

export interface AdminCemeteryListParams {
  q: string;
  from: string | null;
  to: string | null;
}

export const adminKeys = {
  all: ['admin'] as const,
  users: () => [...adminKeys.all, 'users'] as const,
  usersList: (params: AdminUsersListParams) =>
    [...adminKeys.users(), 'list', params] as const,
  userDetail: (userId: number) =>
    [...adminKeys.users(), 'detail', userId] as const,
  cemetery: () => [...adminKeys.all, 'cemetery'] as const,
  cemeteryList: (params: AdminCemeteryListParams) =>
    [...adminKeys.cemetery(), 'list', params] as const,
  cemeteryDetail: (deletedUserId: number) =>
    [...adminKeys.cemetery(), 'detail', deletedUserId] as const,
} as const;
