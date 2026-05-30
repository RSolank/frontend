import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { fetchTags, type TagNode } from '../../../tags/api/queries';
import {
  categorizeUploadRequest,
  finalizeUploadRequest,
  mapBeneficiariesRequest,
  saveManualTagsRequest,
  uploadStatementRequest,
  type FinalizeDecision,
} from '../../api/mutations';
import type { UploadResult } from '../../api/schemas';
import { ProblematicTxnRow } from '../components/ProblematicTxnRow';

interface ApiErrorShape {
  detail?: string;
  error?: string;
}

interface FlatTag {
  tag_id: number;
  tag_name: string;
}

function flattenTags(nodes: TagNode[] | undefined, out: FlatTag[] = []): FlatTag[] {
  for (const n of nodes ?? []) {
    out.push({ tag_id: n.tag_id, tag_name: n.tag_name });
    flattenTags(n.children, out);
  }
  return out;
}

// Upload-button label by pipeline phase — if/else (not a nested ternary) so
// it stays off sonarjs/no-nested-conditional.
function uploadButtonLabel(
  uploading: boolean,
  mapping: boolean,
  categorizing: boolean
): string {
  if (uploading) return 'Uploading...';
  if (mapping) return 'Mapping beneficiaries...';
  if (categorizing) return 'Categorizing rules...';
  return 'Upload';
}

export function UploadStatementPage() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [mapping, setMapping] = useState(false);
  const [categorizing, setCategorizing] = useState(false);

  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [tagsFlat, setTagsFlat] = useState<FlatTag[]>([]);
  const [saveStatus, setSaveStatus] = useState<Record<number, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTags()
      .then((d) => setTagsFlat(flattenTags(d.tags)))
      .catch(() => setTagsFlat([]));
  }, []);

  const problematic = uploadResult?.problematic ?? [];

  async function handleUpload() {
    if (!file) {
      setError('Choose a CSV or PDF file first.');
      return;
    }
    setError(null);
    setUploading(true);
    setMapping(false);
    setCategorizing(false);
    setUploadResult(null);
    setSaveStatus({});
    try {
      const uploaded = await uploadStatementRequest(file);

      setUploading(false);
      setMapping(true);

      await mapBeneficiariesRequest(uploaded.upload_id);

      setMapping(false);
      setCategorizing(true);

      const categorized = await categorizeUploadRequest(uploaded.upload_id);
      setUploadResult({ ...uploaded, ...categorized });
    } catch (err) {
      const e = err as ApiErrorShape;
      setError(e.detail || e.error || 'Upload failed');
    } finally {
      setUploading(false);
      setMapping(false);
      setCategorizing(false);
    }
  }

  async function handleSaveTags(txnId: number, tagIds: number[]) {
    try {
      await saveManualTagsRequest(txnId, tagIds);
      setSaveStatus((prev) => ({ ...prev, [txnId]: true }));
    } catch (err) {
      const e = err as ApiErrorShape;
      setError(e.detail || e.error || 'Failed to save tags');
    }
  }

  async function handleFinalize(decision: FinalizeDecision) {
    if (!uploadResult?.upload_id) return;
    setError(null);

    // If commit is selected but there are unsaved problematic rows,
    // fall back to set_misc so the backend resolves them with the
    // miscellaneous tag rather than aborting.
    let resolved: FinalizeDecision = decision;
    if (resolved === 'commit' && problematic.length > 0) {
      const allSaved = problematic.every((txn) => saveStatus[txn.txn_id]);
      if (!allSaved) resolved = 'set_misc';
    }

    try {
      await finalizeUploadRequest(uploadResult.upload_id, resolved);
      navigate('/dashboard');
    } catch (err) {
      const e = err as ApiErrorShape;
      setError(e.detail || e.error || 'Failed to finalize upload');
    }
  }

  const uploadLabel = uploadButtonLabel(uploading, mapping, categorizing);

  return (
    <div className="mx-auto my-6 max-w-3xl px-4 sm:my-10">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Upload statement
        </h1>
        <Link
          to="/dashboard"
          className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
        >
          ← Back to Dashboard
        </Link>
      </header>

      <div className="rounded-xl bg-white p-4 shadow-sm sm:p-6 dark:bg-slate-900 dark:shadow-none dark:ring-1 dark:ring-slate-800">
        <div className="grid gap-3">
          <label className="form-label">
            Choose file (CSV/PDF)
            <input
              type="file"
              accept=".csv,.pdf"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="mt-2 block w-full text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100 dark:text-slate-300 dark:file:bg-indigo-950/40 dark:file:text-indigo-300 dark:hover:file:bg-indigo-950/60"
              disabled={uploading || mapping || categorizing}
            />
          </label>

          <button
            type="button"
            onClick={handleUpload}
            disabled={uploading || mapping || categorizing}
            className="btn-primary !w-auto"
          >
            {uploadLabel}
          </button>
        </div>
      </div>

      {error && <div className="form-error mt-4">{error}</div>}

      {uploadResult && (
        <div className="mt-6">
          <div className="mb-4 rounded-lg bg-slate-50 p-4 dark:bg-slate-900/60">
            <div className="font-semibold text-slate-900 dark:text-slate-100">
              Upload summary
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-400">
              Inserted: {uploadResult.inserted_count} • Tagged:{' '}
              {uploadResult.categorized_count} • Problematic:{' '}
              {uploadResult.problematic_count}
            </div>
          </div>

          {uploadResult.requires_confirmation ? (
            <>
              <div className="mb-3 font-semibold text-slate-900 dark:text-slate-100">
                Some transactions need attention. Categorize them below or
                choose one of the bulk actions.
              </div>

              {problematic.length === 0 ? (
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  No problematic transactions reported.
                </div>
              ) : (
                problematic.map((txn) => (
                  <ProblematicTxnRow
                    key={txn.txn_id}
                    txn={txn}
                    tags={tagsFlat}
                    saved={!!saveStatus[txn.txn_id]}
                    onSaveTags={handleSaveTags}
                  />
                ))
              )}

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => handleFinalize('commit')}
                  className="btn-primary !w-auto"
                >
                  Commit upload
                </button>
                <button
                  type="button"
                  onClick={() => handleFinalize('set_misc')}
                  className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Set Miscellaneous for unresolved
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!window.confirm('Rollback this entire upload?'))
                      return;
                    handleFinalize('rollback');
                  }}
                  className="rounded-md border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-50 dark:border-rose-800 dark:bg-slate-900 dark:text-rose-300 dark:hover:bg-rose-950/40"
                >
                  Rollback upload
                </button>
              </div>
            </>
          ) : (
            <div>
              <div className="font-semibold text-emerald-700 dark:text-emerald-400">
                Upload completed and categorized.
              </div>
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => navigate('/dashboard')}
                  className="btn-primary !w-auto"
                >
                  Go to dashboard
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
