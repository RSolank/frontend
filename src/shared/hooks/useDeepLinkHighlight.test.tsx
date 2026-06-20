import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { useDeepLinkHighlight } from './useDeepLinkHighlight';

function SearchProbe() {
  const { search } = useLocation();
  return <div data-testid="search">{search}</div>;
}

interface HarnessProps {
  flash: (value: string) => void;
  ready?: boolean;
  accept?: (value: string) => boolean;
}

function Harness({ flash, ready, accept }: HarnessProps) {
  useDeepLinkHighlight({ param: 'highlight', flash, ready, accept });
  return <div id="target" />;
}

function renderAt(path: string, props: HarnessProps) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Harness {...props} />
      <SearchProbe />
    </MemoryRouter>
  );
}

describe('useDeepLinkHighlight', () => {
  it('flashes the param value and consumes the param when ready', async () => {
    const flash = vi.fn();
    renderAt('/p?highlight=abc', { flash });
    await waitFor(() => expect(flash).toHaveBeenCalledWith('abc'));
    await waitFor(() =>
      expect(screen.getByTestId('search').textContent).not.toContain('highlight')
    );
  });

  it('does not fire until ready', async () => {
    const flash = vi.fn();
    const { rerender } = renderAt('/p?highlight=abc', { flash, ready: false });
    // Give effects a tick; nothing should fire.
    await waitFor(() =>
      expect(screen.getByTestId('search').textContent).toContain('highlight')
    );
    expect(flash).not.toHaveBeenCalled();

    rerender(
      <MemoryRouter initialEntries={['/p?highlight=abc']}>
        <Harness flash={flash} ready />
        <SearchProbe />
      </MemoryRouter>
    );
    await waitFor(() => expect(flash).toHaveBeenCalledWith('abc'));
  });

  it('ignores a value the page rejects (accept=false) and leaves the param', async () => {
    const flash = vi.fn();
    renderAt('/p?highlight=nope', {
      flash,
      accept: (v) => v === 'yes',
    });
    await waitFor(() =>
      expect(screen.getByTestId('search').textContent).toContain('highlight')
    );
    expect(flash).not.toHaveBeenCalled();
  });

  it('does nothing when the param is absent', async () => {
    const flash = vi.fn();
    renderAt('/p', { flash });
    await waitFor(() => expect(screen.getByTestId('search')).toBeInTheDocument());
    expect(flash).not.toHaveBeenCalled();
  });
});
