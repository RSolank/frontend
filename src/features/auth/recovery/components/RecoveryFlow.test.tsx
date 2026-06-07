import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  forgotPasswordRequest,
  recoveryQuestionRequest,
  resetPasswordFinalRequest,
  verifyAnswerRequest,
  verifyOtpRequest,
} from '../../api/mutations';
import { establishSession } from '../../state/useAuth';

import { RecoveryFlow } from './RecoveryFlow';

// Behaviour coverage added in Batch 10.11 round-2, alongside the split of
// the 5-step flow into per-step sub-components (EmailStep / ChoiceStep /
// QuestionStep / OtpStep / ResetStep). The recovery mutations are mocked so
// the test drives the state machine deterministically and pins the
// step transitions the parent orchestrates.
const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../../api/mutations', () => ({
  forgotPasswordRequest: vi.fn(),
  recoveryQuestionRequest: vi.fn(),
  resetPasswordFinalRequest: vi.fn(),
  verifyAnswerRequest: vi.fn(),
  verifyOtpRequest: vi.fn(),
  isTwoFactorChallenge: vi.fn(() => false),
}));

vi.mock('../../state/useAuth', () => ({
  establishSession: vi.fn().mockResolvedValue(undefined),
}));

const mockRecoveryQuestion = vi.mocked(recoveryQuestionRequest);
const mockVerifyAnswer = vi.mocked(verifyAnswerRequest);
const mockVerifyOtp = vi.mocked(verifyOtpRequest);
const mockForgot = vi.mocked(forgotPasswordRequest);
const mockResetFinal = vi.mocked(resetPasswordFinalRequest);
const mockEstablish = vi.mocked(establishSession);

function renderFlow() {
  const onError = vi.fn();
  const onExit = vi.fn();
  render(
    <MemoryRouter>
      <RecoveryFlow onError={onError} onExit={onExit} />
    </MemoryRouter>
  );
  return { onError, onExit };
}

async function submitEmail() {
  fireEvent.change(screen.getByLabelText(/Registered email/), {
    target: { value: 'user@example.test' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
}

describe('RecoveryFlow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockForgot.mockResolvedValue(undefined as never);
  });

  it('email -> choice -> question -> reset when a security question exists', async () => {
    mockRecoveryQuestion.mockResolvedValue({
      question: 'First pet?',
    } as never);
    mockVerifyAnswer.mockResolvedValue({ reset_token: 'tok-123' } as never);

    renderFlow();
    await submitEmail();

    // Choice step appears because the account has a security question.
    expect(
      await screen.findByRole('button', { name: 'Security question' })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Security question' }));

    // Question step renders the question text + answer input.
    expect(screen.getByText('First pet?')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Answer/), {
      target: { value: 'Rex' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Verify answer' }));

    await waitFor(() =>
      expect(mockVerifyAnswer).toHaveBeenCalledWith('user@example.test', 'Rex')
    );
    // Reset step.
    expect(await screen.findByLabelText(/New password/)).toBeInTheDocument();
  });

  it('email -> otp directly when the account has no security question', async () => {
    mockRecoveryQuestion.mockResolvedValue({ question: null } as never);

    renderFlow();
    await submitEmail();

    await waitFor(() =>
      expect(mockForgot).toHaveBeenCalledWith('user@example.test')
    );
    // OTP step.
    expect(await screen.findByLabelText(/OTP/)).toBeInTheDocument();
  });

  it('verifies an OTP and advances to the reset step', async () => {
    mockRecoveryQuestion.mockResolvedValue({ question: null } as never);
    mockVerifyOtp.mockResolvedValue({ reset_token: 'tok-otp' } as never);

    renderFlow();
    await submitEmail();

    const otpInput = await screen.findByLabelText(/OTP/);
    fireEvent.change(otpInput, { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify OTP' }));

    await waitFor(() =>
      expect(mockVerifyOtp).toHaveBeenCalledWith('user@example.test', '123456')
    );
    expect(await screen.findByLabelText(/New password/)).toBeInTheDocument();
  });

  it('reset success establishes a session and redirects (no bounce to login)', async () => {
    // Regression: reset-password-final returns a fresh session, but the flow
    // used to navigate to /dashboard without persisting it, so the route guard
    // bounced the user back to login. It must establish the session first.
    mockRecoveryQuestion.mockResolvedValue({ question: null } as never);
    mockVerifyOtp.mockResolvedValue({ reset_token: 'tok-otp' } as never);
    mockResetFinal.mockResolvedValue({
      access_token: 'access',
      refresh_token: 'refresh',
    } as never);

    renderFlow();
    await submitEmail();

    const otpInput = await screen.findByLabelText(/OTP/);
    fireEvent.change(otpInput, { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify OTP' }));

    const pwInput = await screen.findByLabelText(/New password/);
    fireEvent.change(pwInput, { target: { value: 'NewPassw0rd!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reset password' }));

    // The fresh session is established client-side (the core fix)...
    await waitFor(() => expect(mockEstablish).toHaveBeenCalledTimes(1));
    // ...a success confirmation is shown (not a silent modal close)...
    expect(await screen.findByText(/signed in/i)).toBeInTheDocument();
    // ...and "Continue to dashboard" routes onward.
    fireEvent.click(
      screen.getByRole('button', { name: 'Continue to dashboard' })
    );
    expect(mockNavigate).toHaveBeenCalled();
  });

  it('"Back to login" resets to the email step and calls onExit', async () => {
    mockRecoveryQuestion.mockResolvedValue({ question: null } as never);

    const { onExit } = renderFlow();
    await submitEmail();
    await screen.findByLabelText(/OTP/);

    fireEvent.click(screen.getByRole('button', { name: 'Back to login' }));
    expect(onExit).toHaveBeenCalled();
    expect(screen.getByLabelText(/Registered email/)).toBeInTheDocument();
  });
});
