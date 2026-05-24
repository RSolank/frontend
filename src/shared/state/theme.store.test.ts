import { beforeEach, describe, expect, it, vi } from 'vitest';

import { applyTheme, resolveEffectiveMode, useThemeStore } from './theme.store';

describe('useThemeStore', () => {
  beforeEach(() => {
    useThemeStore.setState({ mode: 'system' });
    localStorage.clear();
  });

  it('starts on system', () => {
    expect(useThemeStore.getState().mode).toBe('system');
  });

  it('setMode updates the slice', () => {
    useThemeStore.getState().setMode('dark');
    expect(useThemeStore.getState().mode).toBe('dark');
  });

  it('cycle goes system -> light -> dark -> system', () => {
    const { cycle, mode: m0 } = useThemeStore.getState();
    expect(m0).toBe('system');
    cycle();
    expect(useThemeStore.getState().mode).toBe('light');
    useThemeStore.getState().cycle();
    expect(useThemeStore.getState().mode).toBe('dark');
    useThemeStore.getState().cycle();
    expect(useThemeStore.getState().mode).toBe('system');
  });

  it('persists into localStorage under the "theme" key', () => {
    useThemeStore.getState().setMode('dark');
    const raw = localStorage.getItem('theme');
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw!).state.mode).toBe('dark');
  });
});

describe('resolveEffectiveMode', () => {
  it('returns the explicit mode when not system', () => {
    expect(resolveEffectiveMode('light')).toBe('light');
    expect(resolveEffectiveMode('dark')).toBe('dark');
  });

  it('reads prefers-color-scheme when system', () => {
    const matchMedia = vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: true,
      media: '(prefers-color-scheme: dark)',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as unknown as MediaQueryList);

    expect(resolveEffectiveMode('system')).toBe('dark');
    matchMedia.mockRestore();
  });
});

describe('applyTheme', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('dark');
  });

  it('adds .dark on documentElement when mode resolves to dark', () => {
    applyTheme('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('removes .dark on documentElement when mode resolves to light', () => {
    document.documentElement.classList.add('dark');
    applyTheme('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});
