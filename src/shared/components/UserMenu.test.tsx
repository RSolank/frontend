import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuthStore } from '../state/auth.store';

import { UserMenu } from './UserMenu';

function setUser(user: unknown) {
  useAuthStore.setState({
    user: user as never,
    constants: null,
    loading: false,
    error: null,
  });
}

describe('UserMenu', () => {
  beforeEach(() => {
    setUser(null);
  });

  it('renders nothing when no user is signed in', () => {
    const { container } = render(<UserMenu onLogout={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the user email + initials when signed in', () => {
    setUser({
      user_id: 1,
      email_id: 'taylor@example.test',
      first_name: 'Taylor',
      last_name: 'Doe',
    });
    render(<UserMenu onLogout={vi.fn()} />);

    expect(screen.getByText('taylor@example.test')).toBeInTheDocument();
    expect(screen.getByText('TD')).toBeInTheDocument();
  });

  it('opens the menu on click and calls onLogout when Logout is selected', () => {
    setUser({
      user_id: 1,
      email_id: 'taylor@example.test',
      first_name: 'Taylor',
      last_name: 'Doe',
    });
    const onLogout = vi.fn();
    render(<UserMenu onLogout={onLogout} />);

    fireEvent.click(screen.getByRole('button', { expanded: false }));
    const logoutItem = screen.getByRole('menuitem', { name: /Logout/ });
    fireEvent.click(logoutItem);

    expect(onLogout).toHaveBeenCalledTimes(1);
  });
});
