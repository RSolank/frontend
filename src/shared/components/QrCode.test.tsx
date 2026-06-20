import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { QrCode } from './QrCode';

describe('<QrCode>', () => {
  it('lazy-renders an accessible QR svg from the value', async () => {
    render(<QrCode value="https://example.test/pay" label="Pay code" />);
    const qr = await screen.findByRole('img', { name: 'Pay code' });
    expect(qr.querySelector('svg')).toBeInTheDocument();
  });

  it('omits the caption by default (no copyable text)', async () => {
    render(<QrCode value="otpauth://totp/secret" label="2FA" />);
    await screen.findByRole('img', { name: '2FA' });
    expect(screen.queryByTestId('qr-caption')).not.toBeInTheDocument();
  });

  it('shows a copyable caption when one is provided', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    render(<QrCode value="upi://pay?pa=acme@bank" caption="acme@bank" />);

    expect(await screen.findByTestId('qr-caption')).toHaveTextContent(
      'acme@bank'
    );
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('acme@bank'));
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument();
  });
});
