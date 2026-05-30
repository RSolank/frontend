import { useState } from 'react';

import { Modal } from '../../../shared/components/Modal';

import { LoginForm } from './LoginForm';
import { RegisterForm } from './RegisterForm';

interface AuthModalProps {
  open: boolean;
  initialMode?: 'login' | 'register';
  onClose: () => void;
}

// Modal entry point for the hybrid auth flow (CONTRIBUTING.md §6 "Modal
// pattern" — Hybrid auth). Mounts <LoginForm /> or <RegisterForm />
// depending on the current mode; the in-modal switch keeps the user in
// the same overlay rather than navigating to /login or /register.
//
// The page-based /login and /register routes remain the canonical
// surface for password-manager autofill and deep links — see
// LoginPage.tsx / RegisterPage.tsx.
export function AuthModal({
  open,
  initialMode = 'login',
  onClose,
}: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === 'login' ? 'Sign in' : 'Create your account'}
      size={mode === 'login' ? 'sm' : 'lg'}
    >
      {mode === 'login' ? (
        <LoginForm
          onSuccess={onClose}
          onSwitchToRegister={() => setMode('register')}
        />
      ) : (
        <RegisterForm
          onSuccess={onClose}
          onSwitchToLogin={() => setMode('login')}
        />
      )}
    </Modal>
  );
}
