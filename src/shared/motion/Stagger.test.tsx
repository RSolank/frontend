import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../test/renderWithProviders';
import { useMotionStore } from '../state/motion.store';

import { Stagger, StaggerItem } from './Stagger';

describe('Stagger / StaggerItem', () => {
  afterEach(() => {
    useMotionStore.setState({ reducedMotion: false });
  });

  it('renders every child', () => {
    renderWithProviders(
      <Stagger>
        <StaggerItem>
          <span>zone a</span>
        </StaggerItem>
        <StaggerItem>
          <span>zone b</span>
        </StaggerItem>
      </Stagger>
    );
    expect(screen.getByText('zone a')).toBeInTheDocument();
    expect(screen.getByText('zone b')).toBeInTheDocument();
  });

  it('forwards className and data-* props to the rendered element', () => {
    renderWithProviders(
      <Stagger className="grid gap-4" data-testid="stagger-root">
        <StaggerItem data-testid="stagger-item">
          <span>child</span>
        </StaggerItem>
      </Stagger>
    );
    expect(screen.getByTestId('stagger-root')).toHaveClass('grid', 'gap-4');
    expect(screen.getByTestId('stagger-item')).toBeInTheDocument();
  });

  it('still renders content with the in-app reduced-motion override on', () => {
    // Motion collapses to nothing under reduced motion, but content is
    // never gated by it — the children must always be in the document.
    useMotionStore.setState({ reducedMotion: true });
    renderWithProviders(
      <Stagger>
        <StaggerItem>
          <span>still here</span>
        </StaggerItem>
      </Stagger>
    );
    expect(screen.getByText('still here')).toBeInTheDocument();
  });
});
