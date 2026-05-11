import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiFetch } from '../utils/apiClient.js';

export function EditTransactionPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [txn, setTxn] = useState(null);
  const [tags, setTags] = useState([]);
  const [tagSearch, setTagSearch] = useState('');
  const [tagSearchFocused, setTagSearchFocused] = useState(false);
  const [activeTagIndex, setActiveTagIndex] = useState(-1);
  const [form, setForm] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([
      apiFetch(`/api/transactions/${id}`).then((d) => d.transaction),
      apiFetch('/api/tags').then((d) => flattenTags(d.tags))
    ])
      .then(([t, tagList]) => {
        if (t) {
          setTxn(t);
          setForm({
            amount: t.amount,
            debit_credit: t.debit_credit,
            merchant: t.merchant || '',
            date: t.date,
            notes: t.notes || '',
            tag_ids: t.tag_ids || []
          });
        } else {
          setError('Transaction not found');
        }
        setTags(tagList);
      })
      .catch(() => setError('Failed to load'));
  }, [id]);

  function flattenTags(nodes, out = []) {
    for (const n of nodes || []) {
      out.push({ tag_id: n.tag_id, name: n.name });
      flattenTags(n.children, out);
    }
    return out;
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    setError(null);
  };

  const handleTagToggle = (tagId) => {
    setForm((f) => {
      const ids = f.tag_ids.includes(tagId)
        ? f.tag_ids.filter((x) => x !== tagId)
        : [...f.tag_ids, tagId];
      return { ...f, tag_ids: ids };
    });
  };

  const handleAddTag = (id) => {
    setForm((f) => {
      if (f.tag_ids.includes(id)) return f;
      return { ...f, tag_ids: [...f.tag_ids, id] };
    });
    setTagSearch('');
  };

  const selectedTags = (form?.tag_ids || []).length
    ? tags.filter((t) => form.tag_ids.includes(t.tag_id))
    : [];
  const availableTags = tags.filter(
    (t) =>
      !form?.tag_ids?.includes(t.tag_id) &&
      (!tagSearch ||
        t.name.toLowerCase().includes(tagSearch.toLowerCase()))
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const isAutoStatement = txn.source === 'statement' || txn.source === 'statement_pending';
      const payload = isAutoStatement
        ? {
            notes: form.notes,
            tag_ids: form.tag_ids
          }
        : {
            amount: parseFloat(form.amount),
            debit_credit: form.debit_credit,
            merchant: form.merchant || null,
            date: form.date,
            notes: form.notes || null,
            tag_ids: form.tag_ids
          };
      await apiFetch(`/api/transactions/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });
      navigate('/dashboard');
    } catch (err) {
      setError(err.error || 'Failed to update');
    } finally {
      setSubmitting(false);
    }
  };

  if (error && !txn) {
    return (
      <div style={{ padding: '2rem' }}>
        {error}
        <p>
          <button onClick={() => navigate('/dashboard')}>Back to dashboard</button>
        </p>
      </div>
    );
  }

  if (!form) {
    return <div style={{ padding: '2rem' }}>Loading...</div>;
  }

  const isAutoStatement = txn.source === 'statement' || txn.source === 'statement_pending';
  const isManual = txn.source === 'manual';

  return (
    <div style={{ maxWidth: 500, margin: '2rem auto', padding: '1.5rem' }}>
      <h1>Edit transaction</h1>
      {isAutoStatement && (
        <p style={{ color: '#666' }}>
          Statement transactions can have notes and tags updated. Saving tags may also create new categorization rules (system tags remain protected).
        </p>
      )}
      {error && <div style={{ color: 'red', marginBottom: '0.5rem' }}>{error}</div>}
      <form onSubmit={handleSubmit}>
        {isManual && (
          <>
            <div style={{ marginBottom: '0.75rem' }}>
              <label>
                Amount
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  name="amount"
                  value={form.amount}
                  onChange={handleChange}
                  required
                  style={{ width: '100%', padding: '0.5rem', marginTop: 4 }}
                />
              </label>
            </div>
            <div style={{ marginBottom: '0.75rem' }}>
              <label>
                Type
                <select
                  name="debit_credit"
                  value={form.debit_credit}
                  onChange={handleChange}
                  style={{ width: '100%', padding: '0.5rem', marginTop: 4 }}
                >
                  <option value="debit">Debit</option>
                  <option value="credit">Credit</option>
                </select>
              </label>
            </div>
            <div style={{ marginBottom: '0.75rem' }}>
              <label>
                Merchant
                <input
                  name="merchant"
                  value={form.merchant}
                  onChange={handleChange}
                  style={{ width: '100%', padding: '0.5rem', marginTop: 4 }}
                />
              </label>
            </div>
            <div style={{ marginBottom: '0.75rem' }}>
              <label>
                Date
                <input
                  type="date"
                  name="date"
                  value={form.date}
                  onChange={handleChange}
                  required
                  style={{ width: '100%', padding: '0.5rem', marginTop: 4 }}
                />
              </label>
            </div>
          </>
        )}

        {/* Tags editor is available for both manual and statement uploads. */}
        <div style={{ marginBottom: '0.75rem' }}>
          <span>Tags</span>
          <div style={{ marginTop: 4, marginBottom: 8 }}>
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
                }, 100);
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
                      background:
                        availableTags[activeTagIndex]?.tag_id === t.tag_id ? '#e5e7eb' : 'white',
                      cursor: 'pointer'
                    }}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          {selectedTags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
              {selectedTags.map((t) => (
                <label key={t.tag_id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input
                    type="checkbox"
                    checked={form.tag_ids.includes(t.tag_id)}
                    onChange={() => handleTagToggle(t.tag_id)}
                  />
                  {t.name}
                </label>
              ))}
            </div>
          )}
        </div>

        <div style={{ marginBottom: '0.75rem' }}>
          <label>
            Notes
            <input
              name="notes"
              value={form.notes}
              onChange={handleChange}
              style={{ width: '100%', padding: '0.5rem', marginTop: 4 }}
            />
          </label>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
          <button type="submit" disabled={submitting} style={{ padding: '0.5rem 1rem' }}>
            {submitting ? 'Saving...' : 'Save'}
          </button>
          <button type="button" onClick={() => navigate('/dashboard')} style={{ padding: '0.5rem 1rem' }}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
