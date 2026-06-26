import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Button } from './Button';

describe('Button', () => {
  it('always carries the shared .tap-press token + defaults to type=button', () => {
    render(<Button>Go</Button>);
    const btn = screen.getByRole('button', { name: 'Go' });
    expect(btn).toHaveClass('tap-press');
    expect(btn).toHaveAttribute('type', 'button');
  });

  it('applies the accent fill for the primary variant', () => {
    render(<Button variant="primary">Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toHaveClass(
      'bg-accent-600'
    );
  });

  it('applies the bordered surface for the (default) secondary variant', () => {
    render(<Button>Add</Button>);
    const btn = screen.getByRole('button', { name: 'Add' });
    expect(btn).toHaveClass('border', 'bg-white');
  });

  it('forwards onClick, extra className, and arbitrary props', () => {
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} className="custom" data-testid="b">
        Hit
      </Button>
    );
    const btn = screen.getByTestId('b');
    expect(btn).toHaveClass('custom', 'tap-press');
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
