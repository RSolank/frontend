import { useQuery } from '@tanstack/react-query';

import { apiFetch, type ApiError } from '../../../../shared/api/apiClient';
import { routes } from '../../../../shared/api/routes';

import { statementUploadKeys } from './keys';
import {
  HARDCODED_PARSER_CATALOG,
  isTerminalStatus,
  type JobStatusResponse,
  type ParserOption,
} from './schemas';

export function fetchJobStatus(jobId: number): Promise<JobStatusResponse> {
  return apiFetch<JobStatusResponse>(routes.statementUploads.byId(jobId));
}

// Poll a job's status. The poll interval is adaptive: while the job
// is non-terminal (PENDING / PARSING / CATEGORIZING) the query
// re-fires every 2s; once COMPLETE / FAILED it stops polling and
// caches the terminal payload (`staleTime: Infinity`) so re-mounts
// don't re-fire. Pass `jobId: null` (e.g. before the user has
// uploaded anything) to keep the hook present-but-disabled — the
// hook returns React Query's idle shape and the upload page renders
// its pre-upload state.
const POLL_INTERVAL_MS = 2_000;

// Parser catalog — pulled from the BE registry. The route isn't
// shipped yet (BE handoff filed alongside this batch), so the
// query gracefully falls back to `HARDCODED_PARSER_CATALOG` on
// 404 / any error so the picker keeps working until BE catches
// up. `queryFn` resolves rather than throws on fallback so React
// Query's `data` is always populated.
export async function fetchParserCatalog(): Promise<ParserOption[]> {
  try {
    return await apiFetch<ParserOption[]>(routes.statementUploads.parsers());
  } catch (err) {
    const e = err as ApiError;
    if (e?.status === 404 || e?.status === undefined) {
      return [...HARDCODED_PARSER_CATALOG];
    }
    throw err;
  }
}

export function useParserCatalogQuery() {
  return useQuery({
    queryKey: statementUploadKeys.parsers(),
    queryFn: fetchParserCatalog,
    // The registry is process-static on BE; we don't need to
    // re-check during a session.
    staleTime: Infinity,
  });
}

export function useJobStatusQuery(jobId: number | null) {
  return useQuery({
    queryKey: statementUploadKeys.job(jobId),
    queryFn: () => fetchJobStatus(jobId as number),
    enabled: jobId !== null,
    refetchInterval: (query) => {
      const data = query.state.data as JobStatusResponse | undefined;
      return isTerminalStatus(data?.status) ? false : POLL_INTERVAL_MS;
    },
    // Terminal payloads never change; cache them forever so a
    // navigation away and back doesn't re-fire the poll.
    staleTime: Infinity,
  });
}
