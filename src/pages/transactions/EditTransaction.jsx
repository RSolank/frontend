import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../state/AuthContext.jsx';
import { apiFetch } from '../../utils/apiClient.js';
import { formatInputDate } from '../../utils/dateUtils.js';

export function EditTransactionPage() {
  const { user } = useAuth();
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
  const [constants, setConstants] = useState(null);

  useEffect(() => {
    Promise.all([
      apiFetch(`/api/transactions/${id}`).then((d) => d.transaction),
      apiFetch('/api/tags').then((d) => flattenTags(d.tags)),
      apiFetch('/api/options/constants')
    ])
      .then(([t, tagList, consts]) => {
        setConstants(consts);
        if (t) {
          setTxn(t);
          setForm({
            amount: t.amount,
            debit_credit: t.debit_credit,
            beneficiary: t.beneficiary || '',
            txn_date: formatInputDate(t.txn_date),
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
      out.push({ tag_id: n.tag_id, tag_name: n.tag_name });
      flattenTags(n.children, out);
    }
    return out;
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    setError(null);
  };

  const handleAddTag = (tagId) => {
    setForm((f) => {
      let ids = [...f.tag_ids];
      if (ids.includes(tagId)) return f;

      const MISC_ID = constants?.MISCELLANEOUS_TAG_ID;
      
      // If adding a real tag, remove Misc if present
      if (tagId !== MISC_ID) {
        ids = ids.filter(x => x !== MISC_ID);
        ids.push(tagId);
      } else {
        // If adding Misc, it can only be added if no other tags exist
        if (ids.length === 0) {
          ids = [MISC_ID];
        } else {
          return f; // Cannot add misc if other tags exist
        }
      }
      return { ...f, tag_ids: ids };
    });
    setTagSearch('');
  };

  const handleRemoveTag = (tagId) => {
    setForm((f) => {
      let ids = f.tag_ids.filter((x) => x !== tagId);
      const MISC_ID = constants?.MISCELLANEOUS_TAG_ID;
      
      // If we removed the last tag, and it wasn't misc, add misc back
      if (ids.length === 0 && tagId !== MISC_ID && MISC_ID) {
        ids = [MISC_ID];
      }
      return { ...f, tag_ids: ids };
    });
  };

  const selectedTags = (form?.tag_ids || []).length
    ? tags.filter((t) => form.tag_ids.includes(t.tag_id))
    : [];

  const availableTags = tags.filter(
    (t) => {
      const isSelected = form?.tag_ids?.includes(t.tag_id);
      const isMisc = t.tag_id === constants?.MISCELLANEOUS_TAG_ID;
      const hasOtherTags = form?.tag_ids?.some(id => id !== constants?.MISCELLANEOUS_TAG_ID);
      const isTotal = t.tag_id === constants?.TOTAL_TAG_ID;

      if (isSelected) return false;
      if (isTotal) return false;
      if (isMisc && hasOtherTags) return false; // Hide misc if other tags selected
      
      return !tagSearch || t.tag_name.toLowerCase().includes(tagSearch.toLowerCase());
    }
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
            beneficiary: form.beneficiary || null,
            txn_date: form.txn_date,
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
    <div style={{ maxWidth: '600px', margin: '2rem auto', padding: '2rem', background: 'white', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '1.5rem', color: '#1e293b' }}>Edit transaction</h1>
      
      {isAutoStatement && (
        <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', borderLeft: '4px solid #2563eb', marginBottom: '1.5rem', fontSize: '0.9rem', color: '#64748b' }}>
          Statement transactions can have notes and tags updated. Saving tags may also create new categorization rules.
        </div>
      )}

      {error && <div style={{ color: '#ef4444', background: '#fef2f2', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem', fontWeight: 600 }}>{error}</div>}
      
      <form onSubmit={handleSubmit}>
        {isManual && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>Beneficiary</label>
              <input
                name="beneficiary"
                value={form.beneficiary}
                onChange={handleChange}
                style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.95rem' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>Amount ({user?.currency || '$'})</label>
              <input
                type="number"
                step="0.01"
                min="0"
                name="amount"
                value={form.amount}
                onChange={handleChange}
                required
                style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.95rem' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>Type</label>
              <select
                name="debit_credit"
                value={form.debit_credit}
                onChange={handleChange}
                style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.95rem' }}
              >
                <option value="debit">Debit</option>
                <option value="credit">Credit</option>
              </select>
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>Date</label>
              <input
                type="date"
                name="txn_date"
                value={form.txn_date}
                onChange={handleChange}
                required
                style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.95rem' }}
              />
            </div>
          </div>
        )}

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>Tags</label>
          <div style={{ position: 'relative' }}>
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
                }, 200);
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
                  const chosen = availableTags[activeTagIndex];
                  if (chosen) handleAddTag(chosen.tag_id);
                } else if (e.key === 'Escape') {
                  setTagSearch('');
                  setTagSearchFocused(false);
                }
              }}
              style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.95rem' }}
            />
            {tagSearchFocused && (tagSearch || availableTags.length > 0) && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  background: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                  zIndex: 10,
                  maxHeight: '200px',
                  overflowY: 'auto',
                  marginTop: '4px'
                }}
              >
                {availableTags.length === 0 ? (
                  <div style={{ padding: '0.75rem', color: '#94a3b8', fontSize: '0.9rem' }}>No tags found</div>
                ) : availableTags.map((t, i) => (
                  <div
                    key={t.tag_id}
                    onMouseDown={(e) => {
                      e.preventDefault(); // Prevent blur before click
                      handleAddTag(t.tag_id);
                    }}
                    onMouseEnter={() => setActiveTagIndex(i)}
                    style={{
                      padding: '0.6rem 1rem',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      background: activeTagIndex === i ? '#f1f5f9' : 'white',
                      color: '#1e293b',
                      transition: 'background 0.2s'
                    }}
                  >
                    {t.tag_name}
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '0.75rem' }}>
            {selectedTags.map((t) => (
              <div 
                key={t.tag_id} 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px', 
                  background: '#eff6ff', 
                  color: '#2563eb', 
                  padding: '4px 10px', 
                  borderRadius: '20px', 
                  fontSize: '0.85rem', 
                  fontWeight: 600,
                  border: '1px solid #dbeafe'
                }}
              >
                {t.tag_name}
                <button 
                  type="button" 
                  onClick={() => handleRemoveTag(t.tag_id)}
                  style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', fontSize: '1rem', fontWeight: 700 }}
                >
                  ×
                </button>
              </div>
            ))}
            {selectedTags.length === 0 && <span style={{ color: '#94a3b8', fontSize: '0.85rem', fontStyle: 'italic' }}>No tags selected (Uncategorized)</span>}
          </div>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>Notes</label>
          <textarea
            name="notes"
            value={form.notes}
            onChange={handleChange}
            rows={3}
            style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.95rem', resize: 'vertical', fontFamily: 'inherit' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
          <button 
            type="submit" 
            disabled={submitting} 
            style={{ flex: 1, padding: '0.75rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', transition: 'background 0.2s' }}
            onMouseEnter={(e) => !submitting && (e.target.style.background = '#1d4ed8')}
            onMouseLeave={(e) => !submitting && (e.target.style.background = '#2563eb')}
          >
            {submitting ? 'Saving...' : 'Save Changes'}
          </button>
          <button 
            type="button" 
            onClick={() => navigate('/transactions')} 
            style={{ flex: 1, padding: '0.75rem', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
