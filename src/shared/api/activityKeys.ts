// React-query keys for the activity feature. Shared between the
// TopNav bell modal (feed + catalog), the user-side Notifications
// settings tab (signalSettings), and the admin user-detail signal-
// settings section (admin user-signal-settings + catalog tune).

export const activityKeys = {
  all: ['activity'] as const,
  feed: (limit: number) => [...activityKeys.all, 'feed', limit] as const,
  catalog: () => [...activityKeys.all, 'catalog'] as const,
  // The user's own disabled-kinds list (drives Notifications tab).
  signalSettings: () => [...activityKeys.all, 'signal-settings'] as const,
  // Per-user disabled-kinds list as viewed by an admin (drives the
  // admin user-detail signal section). Keyed by target user_id so a
  // mutation invalidates exactly the page that's open.
  adminUserSignalSettings: (userId: number) =>
    [...activityKeys.all, 'admin', 'user-signal-settings', userId] as const,
} as const;
