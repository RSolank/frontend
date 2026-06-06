import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AccountAccessibilityPage } from './AccountAccessibilityPage';

describe('AccountAccessibilityPage', () => {
  it('renders the seven Display & motion controls', () => {
    render(<AccountAccessibilityPage />);
    // Theme — three icon buttons.
    expect(
      screen.getByRole('button', { name: /light theme/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /dark theme/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /system theme/i })
    ).toBeInTheDocument();
    // Zoom — slider.
    expect(
      screen.getByRole('slider', { name: /Text size/i })
    ).toBeInTheDocument();
    // The four switches (role=switch): reduce-motion, privacy mask,
    // high contrast, underline links, always-show focus.
    expect(
      screen.getByRole('switch', { name: /reduce motion/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('switch', { name: /hide amounts/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('switch', { name: /high contrast/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('switch', { name: /underline links/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('switch', { name: /always show focus/i })
    ).toBeInTheDocument();
  });

  it('renders the three Data formatting controls', () => {
    render(<AccountAccessibilityPage />);
    expect(screen.getByLabelText(/Date format/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Numbers/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/After login go to/i)).toBeInTheDocument();
  });
});
