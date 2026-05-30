import { beforeEach, describe, expect, it } from 'vitest';

import { useAuthStore } from './auth.store';

describe('useAuthStore', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      constants: null,
      loading: true,
      error: null,
    });
  });

  it('starts with no user, no constants, loading true', () => {
    const s = useAuthStore.getState();
    expect(s.user).toBeNull();
    expect(s.constants).toBeNull();
    expect(s.loading).toBe(true);
    expect(s.error).toBeNull();
  });

  it('setUser updates the slot', () => {
    useAuthStore.getState().setUser({
      user_id: 7,
      email_id: 'a@b.test',
    });
    expect(useAuthStore.getState().user?.user_id).toBe(7);
  });

  it('setError + setLoading update independently', () => {
    useAuthStore.getState().setError('oops');
    useAuthStore.getState().setLoading(false);
    expect(useAuthStore.getState().error).toBe('oops');
    expect(useAuthStore.getState().loading).toBe(false);
  });

  it('reset clears user/constants/error and flips loading off', () => {
    useAuthStore.getState().setUser({ user_id: 1, email_id: 'x@x.test' });
    useAuthStore.getState().setError('boom');
    useAuthStore.getState().reset();
    const s = useAuthStore.getState();
    expect(s.user).toBeNull();
    expect(s.constants).toBeNull();
    expect(s.error).toBeNull();
    expect(s.loading).toBe(false);
  });
});
