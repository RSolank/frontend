import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '../../../shared/api/apiClient';

import { authKeys, userKeys } from './keys';

interface UserMeResponse {
  user: {
    user_id: number;
    email_id: string;
    first_name?: string;
    last_name?: string;
    [key: string]: unknown;
  };
}

interface PreferencesResponse {
  currency?: string | null;
  country?: string | null;
  timezone?: string | null;
}

export function fetchCurrentUser(): Promise<UserMeResponse> {
  return apiFetch<UserMeResponse>('/api/users/me');
}

export function fetchUserPreferences(): Promise<PreferencesResponse> {
  return apiFetch<PreferencesResponse>('/api/users/preferences');
}

// React-query bindings — not used by AuthInit (which runs imperatively
// on mount) but available to feature batches that want declarative
// access to the same surface.
export function useCurrentUserQuery(enabled = true) {
  return useQuery({
    queryKey: authKeys.me(),
    queryFn: fetchCurrentUser,
    enabled,
  });
}

export function useUserPreferencesQuery(enabled = true) {
  return useQuery({
    queryKey: userKeys.preferences(),
    queryFn: fetchUserPreferences,
    enabled,
  });
}
