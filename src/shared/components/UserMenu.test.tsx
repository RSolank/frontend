import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuthStore } from '../state/auth.store';

import { UserMenu } from './UserMenu';

function renderMenu(onLogout = vi.fn()) {
  return render(
    <MemoryRouter>
      <UserMenu onLogout={onLogout} />
    </MemoryRouter>
  );
}

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
    const { container } = renderMenu();
    expect(container).toBeEmptyDOMElement();
  });

  it('trigger shows the initials only — no email text', () => {
    setUser({
      user_id: 1,
      email_id: 'taylor@example.test',
      first_name: 'Taylor',
      last_name: 'Doe',
    });
    renderMenu();

    const trigger = screen.getByRole('button', { name: /account menu/i });
    expect(trigger).toHaveTextContent('TD');
    // Email is in the title attribute (tooltip) but NOT rendered as
    // visible text on the trigger itself.
    expect(trigger).toHaveAttribute('title', 'taylor@example.test');
    expect(trigger).not.toHaveTextContent('taylor@example.test');
  });

  it('opens the menu on click, shows Signed-in / Profile / Logout', () => {
    setUser({
      user_id: 1,
      email_id: 'taylor@example.test',
      first_name: 'Taylor',
      last_name: 'Doe',
    });
    renderMenu();

    fireEvent.click(screen.getByRole('button', { name: /account menu/i }));
    expect(screen.getByText('Signed in as')).toBeInTheDocument();
    // Email surfaces inside the dropdown header.
    expect(screen.getByText('taylor@example.test')).toBeInTheDocument();

    const profile = screen.getByRole('menuitem', { name: /Profile/ });
    expect(profile).toHaveAttribute('href', '/profile');
    expect(
      screen.getByRole('menuitem', { name: /Logout/ })
    ).toBeInTheDocument();
  });

  it('calls onLogout when Logout is selected', () => {
    setUser({
      user_id: 1,
      email_id: 'taylor@example.test',
      first_name: 'Taylor',
      last_name: 'Doe',
    });
    const onLogout = vi.fn();
    renderMenu(onLogout);

    fireEvent.click(screen.getByRole('button', { name: /account menu/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Logout/ }));

    expect(onLogout).toHaveBeenCalledTimes(1);
  });
});
