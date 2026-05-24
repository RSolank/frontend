import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../../state/AuthContext.jsx';
import { apiFetch } from '../../utils/apiClient.js';

export function AddTransactionPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [tags, setTags] = useState([]);
  const [beneficiaries, setBeneficiaries] = useState([]);
  const [form, setForm] = useState({
    amount: '',
    debit_credit: 'debit',
    beneficiary_id: '',
    txn_date: new Date().toISOString().split('T')[0],
    notes: '',
    tag_ids: [],
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [constants, setConstants] = useState(null);

  // Search states
  const [tagSearch, setTagSearch] = useState('');
  const [tagSearchFocused, setTagSearchFocused] = useState(false);
  const [bSearch, setBSearch] = useState('');
  const [bSearchFocused, setBSearchFocused] = useState(false);

  useEffect(() => {
    Promise.all([
      apiFetch('/api/tags').then((d) => flattenTags(d.tags)),
      apiFetch('/api/beneficiaries'),
      apiFetch('/api/metadata/constants'),
    ])
      .then(([tagList, bList, consts]) => {
        setTags(tagList);
        setBeneficiaries(bList);
        setConstants(consts);
      })
      .catch((err) => setError('Failed to load metadata'));
  }, []);

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
  };

  const handleAddTag = (tagId) => {
    setForm((f) => {
      let ids = [...f.tag_ids];
      if (ids.includes(tagId)) return f;
      const MISC_ID = constants?.MISCELLANEOUS_TAG_ID;
      if (tagId !== MISC_ID) {
        ids = ids.filter((x) => x !== MISC_ID);
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

  const availableTags = tags.filter(
    (t) =>
      !form.tag_ids.includes(t.tag_id) &&
      t.tag_id !== constants?.TOTAL_TAG_ID &&
      (!tagSearch || t.tag_name.toLowerCase().includes(tagSearch.toLowerCase()))
  );

  const availableBeneficiaries = beneficiaries.filter(
    (b) => !bSearch || b.name.toLowerCase().includes(bSearch.toLowerCase())
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      let ruleIdToLink = null;
      if (form.tag_ids.length > 0 && form.beneficiary_id) {
        if (
          window.confirm(
            'Would you like to create a categorization rule for this beneficiary?'
          )
        ) {
          const newRule = await apiFetch('/api/categorization-rules', {
            method: 'POST',
            body: JSON.stringify({
              name: `Rule for ${bSearch}`,
              beneficiary_id: form.beneficiary_id,
              tag_ids: form.tag_ids,
            }),
          });
          ruleIdToLink = newRule.rule.uid;
        }
      }

      await apiFetch(
        `/api/transactions${ruleIdToLink ? `?rule_id=${ruleIdToLink}` : ''}`,
        {
          method: 'POST',
          body: JSON.stringify({
            ...form,
            amount: parseFloat(form.amount),
            beneficiary_id: form.beneficiary_id || null,
            beneficiary_name: bSearch || null,
          }),
        }
      );
      navigate('/transactions');
    } catch (err) {
      setError(err.detail || 'Failed to create');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        maxWidth: '600px',
        margin: '2rem auto',
        padding: '2rem',
        background: 'white',
        borderRadius: '16px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
      }}
    >
      <h1
        style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '1.5rem' }}
      >
        Add Transaction
      </h1>
      {error && (
        <div style={{ color: 'red', marginBottom: '1rem' }}>{error}</div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '1rem', position: 'relative' }}>
          <label
            htmlFor="beneficiary_name"
            style={{ display: 'block', marginBottom: '4px', fontWeight: 600 }}
          >
            Beneficiary
          </label>
          <input
            id="beneficiary_name"
            value={bSearch}
            onChange={(e) => {
              setBSearch(e.target.value);
              setForm((f) => ({ ...f, beneficiary_id: '' }));
            }}
            onFocus={() => setBSearchFocused(true)}
            onBlur={() => setTimeout(() => setBSearchFocused(false), 200)}
            placeholder="Search..."
            required
            style={{
              width: '100%',
              padding: '0.6rem',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
            }}
          />
          {bSearchFocused && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                background: 'white',
                border: '1px solid #e2e8f0',
                zIndex: 10,
                maxHeight: '200px',
                overflowY: 'auto',
              }}
            >
              <div
                onMouseDown={() => window.open('/beneficiaries', '_blank')}
                style={{
                  padding: '0.6rem 1rem',
                  color: '#2563eb',
                  cursor: 'pointer',
                }}
              >
                + Add New
              </div>
              {availableBeneficiaries.map((b) => (
                <div
                  key={b.uid}
                  onMouseDown={() => {
                    setBSearch(b.name);
                    setForm((f) => ({ ...f, beneficiary_id: b.uid }));
                  }}
                  style={{ padding: '0.6rem 1rem', cursor: 'pointer' }}
                >
                  {b.name}
                </div>
              ))}
            </div>
          )}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '1rem',
            marginBottom: '1rem',
          }}
        >
          <div>
            <label
              htmlFor="amount"
              style={{ display: 'block', marginBottom: '4px', fontWeight: 600 }}
            >
              Amount
            </label>
            <input
              id="amount"
              type="number"
              step="0.01"
              name="amount"
              value={form.amount}
              onChange={handleChange}
              required
              style={{
                width: '100%',
                padding: '0.6rem',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
              }}
            />
          </div>
          <div>
            <label
              htmlFor="debit_credit"
              style={{ display: 'block', marginBottom: '4px', fontWeight: 600 }}
            >
              Type
            </label>
            <select
              id="debit_credit"
              name="debit_credit"
              value={form.debit_credit}
              onChange={handleChange}
              style={{
                width: '100%',
                padding: '0.6rem',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
              }}
            >
              <option value="debit">Debit</option>
              <option value="credit">Credit</option>
            </select>
          </div>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label
            htmlFor="txn_date"
            style={{ display: 'block', marginBottom: '4px', fontWeight: 600 }}
          >
            Date
          </label>
          <input
            id="txn_date"
            type="date"
            name="txn_date"
            value={form.txn_date}
            onChange={handleChange}
            required
            style={{
              width: '100%',
              padding: '0.6rem',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
            }}
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label
            htmlFor="tags_search"
            style={{ display: 'block', marginBottom: '4px', fontWeight: 600 }}
          >
            Tags
          </label>
          <div style={{ position: 'relative' }}>
            <input
              id="tags_search"
              type="text"
              value={tagSearch}
              onChange={(e) => setTagSearch(e.target.value)}
              onFocus={() => setTagSearchFocused(true)}
              onBlur={() => setTimeout(() => setTagSearchFocused(false), 200)}
              placeholder="Search tags..."
              style={{
                width: '100%',
                padding: '0.6rem',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
              }}
            />
            {tagSearchFocused && availableTags.length > 0 && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  background: 'white',
                  border: '1px solid #e2e8f0',
                  zIndex: 10,
                  maxHeight: '200px',
                  overflowY: 'auto',
                }}
              >
                {availableTags.map((t) => (
                  <div
                    key={t.tag_id}
                    onMouseDown={() => handleAddTag(t.tag_id)}
                    style={{ padding: '0.6rem 1rem', cursor: 'pointer' }}
                  >
                    {t.tag_name}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
              marginTop: '0.5rem',
            }}
          >
            {form.tag_ids.map((tid) => {
              const tag = tags.find((tg) => tg.tag_id === tid);
              return (
                <div
                  key={tid}
                  style={{
                    background: '#eff6ff',
                    padding: '4px 10px',
                    borderRadius: '20px',
                    fontSize: '0.85rem',
                  }}
                >
                  {tag?.tag_name}{' '}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tid)}
                    style={{
                      border: 'none',
                      background: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label
            htmlFor="notes"
            style={{ display: 'block', marginBottom: '4px', fontWeight: 600 }}
          >
            Notes
          </label>
          <textarea
            id="notes"
            name="notes"
            value={form.notes}
            onChange={handleChange}
            rows={3}
            style={{
              width: '100%',
              padding: '0.6rem',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              resize: 'vertical',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
          <button
            type="submit"
            disabled={submitting}
            style={{
              flex: 1,
              padding: '0.75rem',
              background: '#2563eb',
              color: 'white',
              borderRadius: '8px',
              border: 'none',
              fontWeight: 700,
            }}
          >
            {submitting ? 'Creating...' : 'Create Transaction'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/transactions')}
            style={{
              flex: 1,
              padding: '0.75rem',
              background: '#f1f5f9',
              borderRadius: '8px',
              border: 'none',
              fontWeight: 700,
            }}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
