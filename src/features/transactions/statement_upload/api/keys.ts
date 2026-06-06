// React-query keys for the async statement-upload feature
// (BE Phase 2.2, `ac4ad00`).
//
// `job(id)` keys the poll for `GET /statement-uploads/{job_id}`. The
// `null` sentinel keeps the type stable so consumers can call
// `useJobStatusQuery(activeJobId)` without conditional unmounting —
// the query simply stays disabled when there's no active job.
export const statementUploadKeys = {
  all: ['statement-upload'] as const,
  job: (jobId: number | null) =>
    [...statementUploadKeys.all, 'job', jobId] as const,
  // Parser catalog (BE-side `available_parsers()`); cached for the
  // session — the registry is process-static on BE today and only
  // changes when BE redeploys.
  parsers: () => [...statementUploadKeys.all, 'parsers'] as const,
} as const;
