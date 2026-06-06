import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  forgotPasswordRequest,
  recoveryQuestionRequest,
  verifyAnswerRequest,
  verifyOtpRequest,
} from '../../api/mutations';

import { RecoveryFlow } from './RecoveryFlow';

// Behaviour coverage added in Batch 10.11 round-2, alongside the split of
// the 5-step flow into per-step sub-components (EmailStep / ChoiceStep /
// QuestionStep / OtpStep / ResetStep). The recovery mutations are mocked so
// the test drives the state machine deterministically and pins the
// step transitions the parent orchestrates.
vi.mock('../../api/mutations', () => ({
  forgotPasswordRequest: vi.fn(),
  recoveryQuestionRequest: vi.fn(),
  resetPasswordFinalRequest: vi.fn(),
  verifyAnswerRequest: vi.fn(),
  verifyOtpRequest: vi.fn(),
}));

const mockRecoveryQuestion = vi.mocked(recoveryQuestionRequest);
const mockVerifyAnswer = vi.mocked(verifyAnswerRequest);
const mockVerifyOtp = vi.mocked(verifyOtpRequest);
const mockForgot = vi.mocked(forgotPasswordRequest);

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
