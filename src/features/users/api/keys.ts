// React-query keys for the users feature. `userKeys.me()` keys the
// /api/users/me result, `userKeys.preferences()` keys the
// /api/users/preferences result. The auth flow (login / boot) and the
// Profile page both consume the preferences query — both invalidate it
// on mutation so a profile save / login refresh propagates everywhere.
export const userKeys = {
  all: ['users'] as const,
  me: () => [...userKeys.all, 'me'] as const,
  preferences: () => [...userKeys.all, 'preferences'] as const,
  stats: () => [...userKeys.all, 'stats'] as const,
  profileImagePresets: () => [...userKeys.all, 'profile-image-presets'] as const,
} as const;
