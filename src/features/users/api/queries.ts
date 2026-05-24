import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '../../../shared/api/apiClient';

import { userKeys } from './keys';

export interface UserProfile {
  user_id: number;
  email_id: string;
  first_name?: string;
  last_name?: string;
  dob?: string | null;
  contact?: string | null;
  country?: string | null;
  currency?: string | null;
  timezone?: string | null;
  [key: string]: unknown;
}

export interface UserMeResponse {
  user: UserProfile;
}

export interface PreferencesResponse {
  currency?: string | null;
  country?: string | null;
  timezone?: string | null;
}

export interface RecoveryQuestionItem {
  question: string;
}

export interface RecoveryListResponse {
  questions: RecoveryQuestionItem[];
}

export function fetchCurrentUser(): Promise<UserMeResponse> {
  return apiFetch<UserMeResponse>('/api/users/me');
}

export function fetchUserPreferences(): Promise<PreferencesResponse> {
  return apiFetch<PreferencesResponse>('/api/users/preferences');
}

export function fetchRecoveryQuestions(): Promise<RecoveryListResponse> {
  return apiFetch<RecoveryListResponse>('/api/auth/recovery');
}

export function useCurrentUserQuery(enabled = true) {
  return useQuery({
    queryKey: userKeys.me(),
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
