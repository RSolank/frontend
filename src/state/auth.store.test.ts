import { beforeEach, describe, expect, it } from 'vitest';

import { useAuthStore } from './auth.store';

describe('useAuthStore (Batch 0 skeleton)', () => {
  beforeEach(() => {
    useAuthStore.getState().reset();
  });

  it('starts with no user', () => {
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('setUser updates the slice', () => {
    useAuthStore.getState().setUser({ id: '1', email: 'a@b.test' });
    expect(useAuthStore.getState().user).toEqual({
      id: '1',
      email: 'a@b.test',
    });
  });

  it('reset clears the slice', () => {
    useAuthStore.getState().setUser({ id: '1', email: 'a@b.test' });
    useAuthStore.getState().reset();
    expect(useAuthStore.getState().user).toBeNull();
  });
});
