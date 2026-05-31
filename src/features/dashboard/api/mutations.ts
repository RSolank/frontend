import { apiFetch } from '../../../shared/api/apiClient';
import { routes } from '../../../shared/api/routes';

import type { SeenRequestPayload, SeenResponse } from './schemas';

// BE Phase 2.4 — `POST /api/activity/seen`. The widget fires this
// twice per event lifecycle:
//   • `signal=soft` when the event renders for the first time in the
//     current session (counts toward auto-mute; BE dedupes per cycle
//     so a poll-loop firing on every render is safe).
//   • `signal=hard` when the user clicks an event (exits auto-mute
//     until the source resolves).
export function markActivitySeenRequest(
  payload: SeenRequestPayload
): Promise<SeenResponse> {
  return apiFetch<SeenResponse>(routes.activity.seen(), {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
