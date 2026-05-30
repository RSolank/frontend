import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useThemeStore } from '../state/theme.store';

import { ThemeOptions } from './ThemeOptions';

describe('ThemeOptions', () => {
  beforeEach(() => {
    useThemeStore.setState({ mode: 'system' });
  });

  it('renders all three modes with the current one marked active', () => {
    render(<ThemeOptions />);
    const systemBtn = screen.getByRole('button', { name: /system theme/i });
    const lightBtn = screen.getByRole('button', { name: /light theme/i });
    const darkBtn = screen.getByRole('button', { name: /dark theme/i });

    expect(systemBtn).toHaveAttribute('aria-pressed', 'true');
    expect(lightBtn).toHaveAttribute('aria-pressed', 'false');
    expect(darkBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('switches the active mode on click and invokes onSelect', () => {
    const onSelect = vi.fn();
    render(<ThemeOptions onSelect={onSelect} />);

    fireEvent.click(screen.getByRole('button', { name: /dark theme/i }));
    expect(useThemeStore.getState().mode).toBe('dark');
    expect(onSelect).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /light theme/i }));
    expect(useThemeStore.getState().mode).toBe('light');
    expect(onSelect).toHaveBeenCalledTimes(2);
  });
});
