import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../state/AuthContext.jsx';
import { apiFetch } from '../utils/apiClient.js';


export function AddTransactionPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [tags, setTags] = useState([]);
  const [tagSearch, setTagSearch] = useState('');
  const [tagSearchFocused, setTagSearchFocused] = useState(false);
  const [activeTagIndex, setActiveTagIndex] = useState(-1);
  const [form, setForm] = useState({
    amount: '',
    debit_credit: 'debit',
    merchant: '',
    txn_date: new Date().toISOString().slice(0, 10),
    notes: '',
    tag_ids: []
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiFetch('/api/tags')
      .then((data) => flattenTags(data.tags))
      .then(setTags)
      .catch(() => setTags([]));
  }, []);

  function flattenTags(nodes, out = []) {
    for (const n of nodes || []) {
      out.push({ tag_id: n.tag_id, tag_name: n.tag_name, parent: n.parent });
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
        ? f.tag_ids.filter((id) => id !== tagId)
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

  const selectedTags = tags.filter((t) => form.tag_ids.includes(t.tag_id));
  const availableTags = tags.filter(
    (t) =>
      !form.tag_ids.includes(t.tag_id) &&
      (!tagSearch ||
        t.tag_name.toLowerCase().includes(tagSearch.toLowerCase()))
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch('/api/transactions', {
        method: 'POST',
        body: JSON.stringify({
          amount: parseFloat(form.amount),
          debit_credit: form.debit_credit,
          merchant: form.merchant || null,
          txn_date: form.txn_date,
          notes: form.notes || null,
          tag_ids: form.tag_ids.length > 0 ? form.tag_ids : undefined
        })
      });
      navigate('/dashboard');
    } catch (err) {
      setError(err.error || 'Failed to add transaction');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: 500, margin: '2rem auto', padding: '1.5rem' }}>
      <h1>Add transaction</h1>
      {error && <div style={{ color: 'red', marginBottom: '0.5rem' }}>{error}</div>}
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '0.75rem' }}>
          <label>
            Amount ({user?.currency || '$'})

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
              name="txn_date"
              value={form.txn_date}
              onChange={handleChange}
              required
              style={{ width: '100%', padding: '0.5rem', marginTop: 4 }}
            />
          </label>
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
        <div style={{ marginBottom: '0.75rem' }}>
          <span>Tags (optional, defaults to Miscellaneous)</span>
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
                // Small timeout to allow click selection before hiding
                setTimeout(() => {
                  setTagSearchFocused(false);
                  setActiveTagIndex(-1);
                }, 100);
              }}
              onKeyDown={(e) => {
                if (!availableTags.length) return;
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setActiveTagIndex((idx) =>
                    idx < availableTags.length - 1 ? idx + 1 : 0
                  );
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setActiveTagIndex((idx) =>
                    idx > 0 ? idx - 1 : availableTags.length - 1
                  );
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
                        availableTags[activeTagIndex]?.tag_id === t.tag_id
                          ? '#e5e7eb'
                          : 'white',
                      cursor: 'pointer'
                    }}
                  >
                    {t.tag_name}
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
                  {t.tag_name}
                </label>
              ))}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
          <button type="submit" disabled={submitting} style={{ padding: '0.5rem 1rem' }}>
            {submitting ? 'Adding...' : 'Add'}
          </button>
          <button type="button" onClick={() => navigate('/dashboard')} style={{ padding: '0.5rem 1rem' }}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
