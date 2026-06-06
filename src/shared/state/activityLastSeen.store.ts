import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// `lastSeenAt` snapshot — the epoch-ms timestamp of the last time the
// user opened the activity bell. The ActivityBell badge counts feed
// items with `refreshed_at > lastSeenAt`, so opening the bell drops
// the badge to 0 in a single click (the "unseen-count" model: see the
// notifications-flow conversation 2026-06-05). Persists to
// `localStorage["activity-last-seen"]` so the badge stays cleared
// across reloads until a new event lands.
//
// Backed up by the BE's own soft-ack/hard-ack lifecycle, which is
// what removes items from the feed entirely; this store only
// controls the **badge**, not what's in the feed.

interface ActivityLastSeenState {
  lastSeenAt: number;
  markSeen: () => void;
}

export const useActivityLastSeenStore = create<ActivityLastSeenState>()(
  persist(
    (set) => ({
      lastSeenAt: 0,
      markSeen: () => set({ lastSeenAt: Date.now() }),
    }),
    { name: 'activity-last-seen' }
  )
);
