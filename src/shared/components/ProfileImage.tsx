// Tail of the URL that `apiClient` prepends with `VITE_API_URL`. The
// BE serves images from a `/media/...` static mount (NOT `/api/`) so
// the path is usable directly in `<img src>` without an auth header.
const BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  'http://localhost:4000';

export interface ProfileImageProps {
  // `null` (or undefined) → render initials monogram. Non-null →
  // render `<img>` with `${BASE_URL}${profileImageUrl}` — the BE
  // returns either `/media/presets/<id>.webp` or
  // `/media/profile-images/<user>/<uuid>.webp`.
  profileImageUrl?: string | null;
  // Identity source for the initials + monogram colour. `email` is
  // the deterministic fallback when first/last name aren't set.
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  // Tailwind size class. Default is medium (44 px) to match the
  // TopNav avatar. Pass `h-24 w-24` etc. for the Account preview.
  sizeClassName?: string;
  // Accessible label override. Defaults to "Account avatar".
  alt?: string;
  className?: string;
}

// First+last initial when both present; first name's first two
// letters; else the email's first character. Matches the TopNav
// helper exactly so the monogram doesn't visually shift when a
// surface starts going through `<ProfileImage>`.
function initialsFor(
  email: string,
  firstName?: string | null,
  lastName?: string | null
): string {
  if (firstName && lastName) {
    return `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase();
  }
  if (firstName) return firstName.slice(0, 2).toUpperCase();
  return (email[0] ?? '?').toUpperCase();
}

// Single indigo background for the monogram — matches the
// pre-Batch-5 TopNav avatar so the visual stays familiar. The
// deterministic-per-user palette idea is on hold until the bundle
// budget has headroom (CONTRIBUTING.md §3 ratchet).
const MONOGRAM_BG = 'bg-indigo-600';

// Builds the `<img src>` URL for a backend-served profile image.
// Exported so tests + non-component callers can compose it.
export function profileImageSrc(path: string): string {
  return `${BASE_URL}${path}`;
}

// One avatar primitive for the whole app. When `profileImageUrl` is
// non-null, renders the BE-served image; otherwise renders the
// initials monogram. Every avatar surface (TopNav, Account preview,
// future merchant avatars) routes through this so changing the
// initials/colour rules is a one-file edit.
export function ProfileImage({
  profileImageUrl,
  email,
  firstName,
  lastName,
  sizeClassName = 'h-11 w-11',
  alt = 'Account avatar',
  className = '',
}: ProfileImageProps) {
  if (profileImageUrl) {
    return (
      <img
        src={profileImageSrc(profileImageUrl)}
        alt={alt}
        className={`${sizeClassName} shrink-0 rounded-full object-cover ${className}`.trim()}
      />
    );
  }

  const initials = initialsFor(email, firstName, lastName);

  return (
    <span
      aria-label={alt}
      role="img"
      data-testid="profile-image-monogram"
      className={`${sizeClassName} ${MONOGRAM_BG} inline-flex shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white ${className}`.trim()}
    >
      {initials}
    </span>
  );
}
