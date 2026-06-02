import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ProfileImage, profileImageSrc } from './ProfileImage';

describe('ProfileImage', () => {
  it('renders the BE-served image when profileImageUrl is non-null', () => {
    render(
      <ProfileImage
        profileImageUrl="/media/presets/geo-03.webp"
        email="user@example.test"
      />
    );
    const img = screen.getByRole('img') as HTMLImageElement;
    expect(img.src).toBe(profileImageSrc('/media/presets/geo-03.webp'));
    expect(img.alt).toBe('Account avatar');
  });

  it('renders an initials monogram when profileImageUrl is null', () => {
    render(
      <ProfileImage
        profileImageUrl={null}
        email="taylor@example.test"
        firstName="Taylor"
        lastName="Doe"
      />
    );
    const monogram = screen.getByTestId('profile-image-monogram');
    expect(monogram.textContent).toBe('TD');
  });

  it('falls back to the first two letters of first_name when last_name is absent', () => {
    render(
      <ProfileImage
        profileImageUrl={null}
        email="solo@example.test"
        firstName="Cher"
      />
    );
    expect(screen.getByTestId('profile-image-monogram').textContent).toBe('CH');
  });

  it('falls back to the first char of email when no names are set', () => {
    render(
      <ProfileImage profileImageUrl={null} email="zed@example.test" />
    );
    expect(screen.getByTestId('profile-image-monogram').textContent).toBe('Z');
  });

  it('renders the monogram with the shared indigo background', () => {
    render(
      <ProfileImage
        profileImageUrl={null}
        email="taylor@example.test"
        firstName="Taylor"
        lastName="Doe"
      />
    );
    const monogram = screen.getByTestId('profile-image-monogram');
    expect(monogram.classList.contains('bg-accent-600')).toBe(true);
  });
});
