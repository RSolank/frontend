import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '../../../shared/api/apiClient';
import { routes } from '../../../shared/api/routes';

import { authKeys } from './keys';

// BE Phase 1.12 (`0ee25ef`) — `GET /api/auth/sessions` returns the
// active sessions for the current user, newest-first. `is_current`
// flags the row backing the request. `refresh_token` is never
// exposed (BE strips it from the serializer).
export interface SessionInfo {
  session_id: number;
  ip_address?: string | null;
  device_data?: string | null;
  known_device_uid?: string | null;
  is_current: boolean;
  created_at: string;
  last_modified: string;
  expires_at: string;
}

// BE returns a bare `list[SessionInfo]` (see
// `backend/app/modules/auth/auth_routes.py` —
// `response_model=list[SessionInfo]`). The previous wrapper
// `{sessions?: [...]}` always resolved to `undefined.sessions ?? []`,
// which is why the Security tab showed no active sessions even when
// the user was signed in (caught during E2E 2026-06-05).
export function fetchSessions(): Promise<SessionInfo[]> {
  return apiFetch<SessionInfo[]>(routes.auth.sessions());
}

export function useSessionsQuery(enabled = true) {
  return useQuery({
    queryKey: authKeys.sessions(),
    queryFn: fetchSessions,
    enabled,
    // Sessions change when the user revokes, logs in elsewhere, or a
    // device expires. Short staleTime so re-mounts pull fresh data;
    // mutations also invalidate explicitly.
    staleTime: 30_000,
  });
}
