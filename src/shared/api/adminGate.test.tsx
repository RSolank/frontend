import { renderHook, act } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { useAuthStore, type AuthUser } from '../state/auth.store';

import { useAdminGateQuery } from './adminGate';

// BE T-admin A1 (`2c47fa9`, FE Platform Batch 18) — the gate is now a
// sync read on `useAuthStore`, not a network probe of `/admin/ping`.
// These tests exercise the store-state-to-gate-output mapping.

function setAuthState(partial: {
  user: AuthUser | null;
  loading: boolean;
}) {
  act(() => {
    useAuthStore.getState().setUser(partial.user);
    useAuthStore.getState().setLoading(partial.loading);
  });
}

describe('useAdminGateQuery', () => {
  afterEach(() => {
    act(() => {
      useAuthStore.getState().reset();
    });
  });

  it('returns data=true when the user has role=admin', () => {
    setAuthState({
      user: {
        user_id: 1,
        email_id: 'admin@example.test',
        role: 'admin',
      },
      loading: false,
    });
    const { result } = renderHook(() => useAdminGateQuery());
    expect(result.current.data).toBe(true);
    expect(result.current.isLoading).toBe(false);
  });

  it('returns data=false when the user has role=user', () => {
    setAuthState({
      user: {
        user_id: 2,
        email_id: 'user@example.test',
        role: 'user',
      },
      loading: false,
    });
    const { result } = renderHook(() => useAdminGateQuery());
    expect(result.current.data).toBe(false);
  });

  it('returns data=false when the user is unauthenticated (user=null)', () => {
    setAuthState({ user: null, loading: false });
    const { result } = renderHook(() => useAdminGateQuery());
    expect(result.current.data).toBe(false);
  });

  it('returns data=false when the user payload omits role (legacy fixture)', () => {
    setAuthState({
      user: {
        user_id: 3,
        email_id: 'legacy@example.test',
      },
      loading: false,
    });
    const { result } = renderHook(() => useAdminGateQuery());
    expect(result.current.data).toBe(false);
  });

  it('mirrors the boot-time loading flag in isLoading', () => {
    setAuthState({ user: null, loading: true });
    const { result } = renderHook(() => useAdminGateQuery());
    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBe(false);
  });

  it('returns closed (data=false, isLoading=false) when enabled=false', () => {
    setAuthState({
      user: {
        user_id: 1,
        email_id: 'admin@example.test',
        role: 'admin',
      },
      loading: false,
    });
    const { result } = renderHook(() => useAdminGateQuery(false));
    expect(result.current.data).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });
});
