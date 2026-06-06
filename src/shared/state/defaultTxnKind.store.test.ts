import { beforeEach, describe, expect, it } from 'vitest';

import {
  getDefaultTxnKind,
  useDefaultTxnKindStore,
} from './defaultTxnKind.store';

describe('useDefaultTxnKindStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useDefaultTxnKindStore.setState({ kind: 'debit' });
  });

  it('defaults to debit', () => {
    expect(useDefaultTxnKindStore.getState().kind).toBe('debit');
    expect(getDefaultTxnKind()).toBe('debit');
  });

  it('persists user selection to localStorage', () => {
    useDefaultTxnKindStore.getState().setKind('credit');
    expect(useDefaultTxnKindStore.getState().kind).toBe('credit');
    expect(localStorage.getItem('default-txn-kind')).toContain(
      '"kind":"credit"'
    );
  });

  it('getDefaultTxnKind() returns the current value (imperative read)', () => {
    useDefaultTxnKindStore.getState().setKind('credit');
    expect(getDefaultTxnKind()).toBe('credit');
  });
});
