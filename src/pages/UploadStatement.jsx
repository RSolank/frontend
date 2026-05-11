import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch } from '../utils/apiClient.js';

function flattenTags(nodes, out = []) {
  for (const n of nodes || []) {
    out.push({ tag_id: n.tag_id, name: n.name, parent: n.parent });
    flattenTags(n.children, out);
  }
  return out;
}

function ProblematicTxnRow({ txn, tags, onSaveTags, saved }) {
  const [tagSearch, setTagSearch] = useState('');
  const [tagSearchFocused, setTagSearchFocused] = useState(false);
  const [activeTagIndex, setActiveTagIndex] = useState(-1);
  const [selectedTagIds, setSelectedTagIds] = useState([]);
  const availableTags = useMemo(() => {
    return tags.filter(
      (t) =>
        !selectedTagIds.includes(t.tag_id) &&
        (!tagSearch || t.name.toLowerCase().includes(tagSearch.toLowerCase()))
    );
  }, [tags, selectedTagIds, tagSearch]);

  useEffect(() => {
    // If user saved already, keep selectedTagIds in sync with backend state.
    if (saved && selectedTagIds.length === 0 && txn.tag_ids && txn.tag_ids.length) {
      setSelectedTagIds(txn.tag_ids);
    }
  }, [saved]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAddTag = (id) => {
    setSelectedTagIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setTagSearch('');
    setActiveTagIndex(-1);
  };

  const handleToggleTag = (id) => {
    setSelectedTagIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <div style={{ border: '1px solid #ddd', borderRadius: 6, padding: '1rem', marginBottom: '1rem' }}>
      <div style={{ marginBottom: '0.75rem' }}>
        <div style={{ fontWeight: 600 }}>{txn.merchant || '—'}</div>
        <div style={{ color: '#666', fontSize: '0.9rem' }}>
          {txn.date} • {txn.debit_credit} • ₹{txn.amount}
        </div>
      </div>

      <div style={{ marginBottom: '0.75rem' }}>
        <div style={{ marginBottom: 6, fontWeight: 500 }}>Categorize</div>
        <input
          type="text"
          placeholder="Search tags..."
          value={tagSearch}
          onChange={(e) => {
            setTagSearch(e.target.value);
            setActiveTagIndex(0);
          }}
          onFocus={() => {
            setTagSearchFocused(true);
            if (availableTags.length > 0) setActiveTagIndex(0);
          }}
          onBlur={() => {
            setTimeout(() => {
              setTagSearchFocused(false);
              setActiveTagIndex(-1);
            }, 120);
          }}
          onKeyDown={(e) => {
            if (!availableTags.length) return;
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActiveTagIndex((idx) => (idx < availableTags.length - 1 ? idx + 1 : 0));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActiveTagIndex((idx) => (idx > 0 ? idx - 1 : availableTags.length - 1));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              const chosen = availableTags[activeTagIndex] || availableTags[0];
              if (chosen) handleAddTag(chosen.tag_id);
            } else if (e.key === 'Escape') {
              setTagSearch('');
              setTagSearchFocused(false);
              setActiveTagIndex(-1);
            }
          }}
          style={{ width: '100%', padding: '0.5rem', marginBottom: 4 }}
        />

        {tagSearchFocused && tagSearch && availableTags.length > 0 && (
          <div
            style={{
              border: '1px solid #ddd',
              borderRadius: 4,
              maxHeight: 160,
              overflowY: 'auto',
              background: 'white'
            }}
          >
            {availableTags.slice(0, 10).map((t) => (
              <button
                key={t.tag_id}
                type="button"
                onClick={() => handleAddTag(t.tag_id)}
                onMouseEnter={() => setActiveTagIndex(availableTags.findIndex((x) => x.tag_id === t.tag_id))}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '0.4rem 0.5rem',
                  border: 'none',
                  background: availableTags[activeTagIndex]?.tag_id === t.tag_id ? '#e5e7eb' : 'white',
                  cursor: 'pointer'
                }}
              >
                {t.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedTagIds.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
          {selectedTagIds.map((id) => {
            const t = tags.find((x) => x.tag_id === id);
            return (
              <label key={id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="checkbox" checked={true} onChange={() => handleToggleTag(id)} />
                {t?.name || id}
              </label>
            );
          })}
        </div>
      )}

      <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <button
          type="button"
          onClick={() => onSaveTags(txn.txn_id, selectedTagIds)}
          style={{ padding: '0.5rem 1rem' }}
        >
          {saved ? 'Saved' : 'Save tags'}
        </button>
        <div style={{ color: '#666', fontSize: '0.9rem' }}>
          If you save with no tags, it will be marked as Miscellaneous.
        </div>
      </div>
    </div>
  );
}

export function UploadStatementPage() {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const [uploadResult, setUploadResult] = useState(null);
  const [tagsFlat, setTagsFlat] = useState([]);
  const [saveStatus, setSaveStatus] = useState({}); // txn_id -> boolean
  const [error, setError] = useState(null);

  useEffect(() => {
    apiFetch('/api/tags')
      .then((d) => setTagsFlat(flattenTags(d.tags || [])))
      .catch(() => setTagsFlat([]));
  }, []);

  const problematic = uploadResult?.problematic || [];

  const handleUpload = async () => {
    if (!file) {
      setError('Choose a CSV or PDF file first.');
      return;
    }
    setError(null);
    setUploading(true);
    setUploadResult(null);
    setSaveStatus({});
    try {
      const fd = new FormData();
      fd.append('file', file);
      const d = await apiFetch('/api/transactions/upload-statement', {
        method: 'POST',
        body: fd
      });
      setUploadResult(d);
    } catch (err) {
      setError(err.detail || err.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleSaveTags = async (txnId, tagIds) => {
    try {
      await apiFetch(`/api/transactions/${txnId}/manual-tags`, {
        method: 'POST',
        body: JSON.stringify({
          tag_ids: tagIds && tagIds.length ? tagIds : []
        })
      });
      setSaveStatus((prev) => ({ ...prev, [txnId]: true }));
    } catch (err) {
      setError(err.detail || err.error || 'Failed to save tags');
    }
  };

  const handleFinalize = async (decision) => {
    if (!uploadResult?.upload_id) return;
    setError(null);
    try {
      await apiFetch(`/api/transactions/upload-statement/${uploadResult.upload_id}/finalize`, {
        method: 'POST',
        body: JSON.stringify({ decision })
      });
      navigate('/dashboard');
    } catch (err) {
      setError(err.detail || err.error || 'Failed to finalize upload');
    }
  };

  return (
    <div style={{ maxWidth: 720, margin: '2rem auto', padding: '1.5rem' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Upload statement</h1>
        <Link to="/dashboard">Back</Link>
      </header>

      <div style={{ marginTop: '1rem', border: '1px solid #ddd', borderRadius: 8, padding: '1rem' }}>
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <label>
            Choose file (CSV/PDF)
            <input
              type="file"
              accept=".csv,.pdf"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              style={{ display: 'block', marginTop: 6 }}
              disabled={uploading}
            />
          </label>

          <button type="button" onClick={handleUpload} disabled={uploading} style={{ padding: '0.6rem 1rem' }}>
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
        </div>
      </div>

      {error && <div style={{ color: 'red', marginTop: '1rem' }}>{error}</div>}

      {uploadResult && (
        <div style={{ marginTop: '1.5rem' }}>
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontWeight: 700 }}>Upload summary</div>
            <div style={{ color: '#666' }}>
              Inserted: {uploadResult.inserted_count} • Tagged: {uploadResult.categorized_count} • Problematic:{' '}
              {uploadResult.problematic_count}
            </div>
          </div>

          {uploadResult.requires_confirmation ? (
            <>
              <div style={{ fontWeight: 700, marginBottom: '0.5rem' }}>
                Some transactions need attention. Categorize them below or choose one of the bulk actions.
              </div>

              {problematic.length === 0 ? (
                <div>No problematic transactions reported.</div>
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

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => handleFinalize('commit')}
                  style={{ padding: '0.6rem 1rem' }}
                >
                  Commit upload
                </button>
                <button
                  type="button"
                  onClick={() => handleFinalize('set_misc')}
                  style={{ padding: '0.6rem 1rem' }}
                >
                  Set Miscellaneous for unresolved
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!window.confirm('Rollback this entire upload?')) return;
                    handleFinalize('rollback');
                  }}
                  style={{ padding: '0.6rem 1rem' }}
                >
                  Rollback upload
                </button>
              </div>
            </>
          ) : (
            <div>
              <div style={{ color: 'green', fontWeight: 700 }}>Upload completed and categorized.</div>
              <div style={{ marginTop: '0.75rem' }}>
                <button type="button" onClick={() => navigate('/dashboard')} style={{ padding: '0.6rem 1rem' }}>
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

