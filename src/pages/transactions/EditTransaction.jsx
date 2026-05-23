import React, { useState, useEffect, useRef } from 'react';
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
  const [beneficiaries, setBeneficiaries] = useState([]);
  const [form, setForm] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [constants, setConstants] = useState(null);

  // Tag Search
  const [tagSearch, setTagSearch] = useState('');
  const [tagSearchFocused, setTagSearchFocused] = useState(false);
  const [activeTagIndex, setActiveTagIndex] = useState(-1);

  // Beneficiary Search
  const [bSearch, setBSearch] = useState('');
  const [bSearchFocused, setBSearchFocused] = useState(false);
  const [activeBIndex, setActiveBIndex] = useState(-1);
  const bRef = useRef(null);

  useEffect(() => {
    Promise.all([
      apiFetch(`/api/transactions/${id}`).then((d) => d.transaction), // note: single returns object
      apiFetch('/api/tags').then((d) => flattenTags(d.tags)),
      apiFetch('/api/beneficiaries'),
      apiFetch('/api/metadata/constants')
    ])
      .then(([t, tagList, bList, consts]) => {
        setConstants(consts);
        setTags(tagList);
        setBeneficiaries(bList);
        if (t) {
          setTxn(t);
          setBSearch(t.beneficiary_name || '');
          setForm({
            amount: t.amount,
            debit_credit: t.debit_credit,
            beneficiary_id: t.beneficiary_id || '',
            txn_date: formatInputDate(t.txn_date),
            notes: t.notes || '',
            tag_ids: t.tag_ids || []
          });
        } else {
          setError('Transaction not found');
        }
      })
      .catch((err) => {
        console.error(err);
        setError('Failed to load data');
      });
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
      if (tagId !== MISC_ID) {
        ids = ids.filter(x => x !== MISC_ID);
        ids.push(tagId);
      } else {
        if (ids.length === 0) ids = [MISC_ID];
        else return f;
      }
      return { ...f, tag_ids: ids };
    });
    setTagSearch('');
  };

  const handleRemoveTag = (tagId) => {
    setForm((f) => {
      let ids = f.tag_ids.filter((x) => x !== tagId);
      const MISC_ID = constants?.MISCELLANEOUS_TAG_ID;
      if (ids.length === 0 && tagId !== MISC_ID && MISC_ID) ids = [MISC_ID];
      return { ...f, tag_ids: ids };
    });
  };

  const availableTags = tags.filter(t => {
    const isSelected = form?.tag_ids?.includes(t.tag_id);
    const isMisc = t.tag_id === constants?.MISCELLANEOUS_TAG_ID;
    const hasOtherTags = form?.tag_ids?.some(id => id !== constants?.MISCELLANEOUS_TAG_ID);
    const isTotal = t.tag_id === constants?.TOTAL_TAG_ID;
    if (isSelected || isTotal) return false;
    if (isMisc && hasOtherTags) return false;
    return !tagSearch || t.tag_name.toLowerCase().includes(tagSearch.toLowerCase());
  });

  const availableBeneficiaries = beneficiaries.filter(b =>
    !bSearch || b.name.toLowerCase().includes(bSearch.toLowerCase())
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      // Check if tags changed
      const tagsChanged = JSON.stringify(form.tag_ids.sort()) !== JSON.stringify(txn.tag_ids.sort());

      let ruleIdToLink = null;
      if (tagsChanged && form.beneficiary_id) {
        const createRule = window.confirm('You updated the tags. Would you like to create/update a categorization rule for this beneficiary?');
        if (createRule) {
          // Check if rule exists
          const { rules } = await apiFetch('/api/categorization-rules');
          const existingRule = rules.find(r => r.beneficiary_id === form.beneficiary_id);

          if (existingRule) {
            if (window.confirm(`A rule for "${existingRule.beneficiary_name}" already exists. Update it with these tags?`)) {
              await apiFetch(`/api/categorization-rules/${existingRule.uid}`, {
                method: 'PUT',
                body: JSON.stringify({ tag_ids: form.tag_ids })
              });
              ruleIdToLink = existingRule.uid;
            }
          } else {
            const newRule = await apiFetch('/api/categorization-rules', {
              method: 'POST',
              body: JSON.stringify({
                name: `Rule for ${bSearch}`,
                beneficiary_id: form.beneficiary_id,
                tag_ids: form.tag_ids
              })
            });
            ruleIdToLink = newRule.rule.uid;
          }
        }
      }

      const payload = txn?.source === 'statement' ? {
        notes: form.notes || null,
        tag_ids: form.tag_ids
      } : {
        amount: parseFloat(form.amount),
        debit_credit: form.debit_credit,
        beneficiary_id: form.beneficiary_id || null,
        beneficiary_name: bSearch || null,
        txn_date: form.txn_date,
        notes: form.notes || null,
        tag_ids: form.tag_ids
      };

      await apiFetch(`/api/transactions/${id}${ruleIdToLink ? `?rule_id=${ruleIdToLink}` : ''}`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });
      navigate('/transactions');
    } catch (err) {
      setError(err.detail || 'Failed to update');
    } finally {
      setSubmitting(false);
    }
  };

  if (error && !form) return <div style={{ padding: '2rem', color: '#ef4444' }}>{error}</div>;
  if (!form) return <div style={{ padding: '2rem' }}>Loading...</div>;

  return (
    <div style={{ maxWidth: '600px', margin: '2rem auto', padding: '2rem', background: 'white', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '1.5rem', color: '#1e293b' }}>Edit Transaction</h1>

      {error && <div style={{ color: '#ef4444', background: '#fef2f2', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem', fontWeight: 600 }}>{error}</div>}

      <form onSubmit={handleSubmit}>
        {txn?.source === 'manual' && (
          <>
            <div style={{ marginBottom: '1rem', position: 'relative' }}>
              <label htmlFor="beneficiary_name" style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>Beneficiary</label>
              <input
                id="beneficiary_name"
                value={bSearch}
                onChange={(e) => {
                  setBSearch(e.target.value);
                  setForm(f => ({ ...f, beneficiary_id: '' }));
                  setActiveBIndex(0);
                }}
                onFocus={() => setBSearchFocused(true)}
                onBlur={() => setTimeout(() => setBSearchFocused(false), 200)}
                placeholder="Search beneficiary..."
                required
                style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.95rem' }}
              />
              {bSearchFocused && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', zIndex: 10, maxHeight: '200px', overflowY: 'auto', marginTop: '4px' }}>
                  {availableBeneficiaries.map((b, i) => (
                    <div
                      key={b.uid}
                      onMouseDown={() => {
                        setBSearch(b.name);
                        setForm(f => ({ ...f, beneficiary_id: b.uid }));
                      }}
                      style={{ padding: '0.6rem 1rem', cursor: 'pointer', background: activeBIndex === i ? '#f1f5f9' : 'white' }}
                    >
                      {b.name}
                    </div>
                  ))}
                  <div
                    onMouseDown={() => window.open('/beneficiaries', '_blank')}
                    style={{ padding: '0.6rem 1rem', cursor: 'pointer', borderTop: '1px solid #f1f5f9', color: '#2563eb', fontWeight: 600 }}
                  >
                    + Add New Beneficiary
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label htmlFor="amount" style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>Amount</label>
                <input id="amount" type="number" step="0.01" name="amount" value={form.amount} onChange={handleChange} style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
              </div>
              <div>
                <label htmlFor="debit_credit" style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>Type</label>
                <select id="debit_credit" name="debit_credit" value={form.debit_credit} onChange={handleChange} style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <option value="debit">Debit</option>
                  <option value="credit">Credit</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label htmlFor="txn_date" style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>Date</label>
              <input id="txn_date" type="date" name="txn_date" value={form.txn_date} onChange={handleChange} style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
            </div>
          </>
        )}

        <div style={{ marginBottom: '1.5rem' }}>
          <label htmlFor="tags_search" style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>Tags</label>
          <div style={{ position: 'relative' }}>
            <input
              id="tags_search"
              type="text"
              placeholder="Search tags..."
              value={tagSearch}
              onChange={(e) => setTagSearch(e.target.value)}
              onFocus={() => setTagSearchFocused(true)}
              onBlur={() => setTimeout(() => setTagSearchFocused(false), 200)}
              style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}
            />
            {tagSearchFocused && availableTags.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', zIndex: 10, maxHeight: '200px', overflowY: 'auto' }}>
                {availableTags.map((t) => (
                  <div key={t.tag_id} onMouseDown={() => handleAddTag(t.tag_id)} style={{ padding: '0.6rem 1rem', cursor: 'pointer' }}>{t.tag_name}</div>
                ))}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '0.75rem' }}>
            {form.tag_ids.map(tid => {
              const tag = tags.find(tg => tg.tag_id === tid);
              return (
                <div key={tid} style={{ background: '#eff6ff', color: '#2563eb', padding: '4px 10px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 600 }}>
                  {tag?.tag_name} <button type="button" onClick={() => handleRemoveTag(tid)} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer' }}>×</button>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>Notes</label>
          <textarea name="notes" value={form.notes} onChange={handleChange} rows={3} style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #e2e8f0', resize: 'vertical' }} />
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
          <button type="submit" disabled={submitting} style={{ flex: 1, padding: '0.75rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}>
            {submitting ? 'Saving...' : 'Save Changes'}
          </button>
          <button type="button" onClick={() => navigate('/transactions')} style={{ flex: 1, padding: '0.75rem', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
