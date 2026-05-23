import React, { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../../utils/apiClient.js';
import { formatAliasesDisplay } from '../../beneficiaries/aliasUtils.js';
import { buildRuleName, flattenTags, formatTagAssignment } from './categorizationRuleUtils.js';

const emptyForm = () => ({
  uid: null,
  beneficiary_id: '',
  beneficiary_name: '',
  tag_ids: [],
  notes: '',
});

export function CategorizationRulesTab() {
  const [rules, setRules] = useState([]);
  const [tags, setTags] = useState([]);
  const [beneficiaries, setBeneficiaries] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [constants, setConstants] = useState(null);
  const [hoveredFormTagId, setHoveredFormTagId] = useState(null);
  const [hoveredRuleTag, setHoveredRuleTag] = useState(null);

  const [isFormVisible, setIsFormVisible] = useState(false);
  const [form, setForm] = useState(emptyForm());

  const [bSearch, setBSearch] = useState('');
  const [bSearchFocused, setBSearchFocused] = useState(false);
  const [tempTagId, setTempTagId] = useState('');
  const [beneficiaryConflict, setBeneficiaryConflict] = useState(null);

  const isEditing = form.uid != null;

  const filteredTags = tags.filter(
    (t) =>
      t.tag_id !== constants?.TOTAL_TAG_ID &&
      t.tag_id !== constants?.MISCELLANEOUS_TAG_ID
  );

  const generatedRuleName = useMemo(
    () => buildRuleName(form.beneficiary_name, form.tag_ids, tags),
    [form.beneficiary_name, form.tag_ids, tags]
  );

  const loadAll = () => {
    setLoading(true);
    setError(null);
    Promise.all([
      apiFetch('/api/categorization-rules').then((d) => d.rules || []),
      apiFetch('/api/tags').then((d) => flattenTags(d.tags || [])),
      apiFetch('/api/beneficiaries'),
      apiFetch('/api/metadata/constants'),
    ])
      .then(([r, t, bList, c]) => {
        setRules(r);
        setTags(t);
        setBeneficiaries(bList);
        setConstants(c);
      })
      .catch((err) => setError(err.detail || err.error || 'Failed to load rules'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!form.beneficiary_id) {
      setBeneficiaryConflict(null);
      return;
    }
    const existing = rules.find(
      (r) =>
        r.beneficiary_id === form.beneficiary_id &&
        (!isEditing || r.uid !== form.uid)
    );
    if (existing) {
      setBeneficiaryConflict(
        `A rule already exists for beneficiary "${existing.beneficiary_name}"`
      );
    } else {
      setBeneficiaryConflict(null);
    }
  }, [form.beneficiary_id, rules, isEditing, form.uid]);

  const isUserRule = (rule) =>
    rule.created_by != null && rule.created_by !== constants?.SYSTEM_USER_ID;

  const availableBeneficiaries = beneficiaries.filter(
    (b) => !bSearch || b.name.toLowerCase().includes(bSearch.toLowerCase())
  );

  const resetForm = () => {
    setForm(emptyForm());
    setBSearch('');
    setTempTagId('');
    setBeneficiaryConflict(null);
    setIsFormVisible(false);
  };

  const handleSelectBeneficiary = (b) => {
    setBSearch(b.name);
    setForm((f) => ({
      ...f,
      beneficiary_id: b.uid,
      beneficiary_name: b.name,
    }));
  };

  const handleAddTag = () => {
    if (!tempTagId) return;
    const tid = parseInt(tempTagId, 10);
    if (form.tag_ids.includes(tid)) return;
    setForm((f) => ({ ...f, tag_ids: [...f.tag_ids, tid] }));
    setTempTagId('');
  };

  const handleRemoveTag = (tid) => {
    setForm((f) => ({ ...f, tag_ids: f.tag_ids.filter((id) => id !== tid) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!form.beneficiary_id) return setError('Please select a beneficiary');
    if (beneficiaryConflict) return setError(beneficiaryConflict);
    if (form.tag_ids.length === 0) return setError('At least one tag is required');
    if (!generatedRuleName) return setError('Could not generate rule name');

    const payload = {
      name: generatedRuleName,
      beneficiary_id: form.beneficiary_id,
      tag_ids: form.tag_ids,
      notes: form.notes || null,
    };

    try {
      if (isEditing) {
        await apiFetch(`/api/categorization-rules/${form.uid}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch('/api/categorization-rules', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      resetForm();
      loadAll();
    } catch (err) {
      setError(err.detail || err.error || 'Failed to save rule');
    }
  };

  const handleEdit = (r) => {
    setError(null);
    setForm({
      uid: r.uid,
      beneficiary_id: r.beneficiary_id,
      beneficiary_name: r.beneficiary_name || '',
      tag_ids: [...(r.tag_ids || [])],
      notes: r.notes || '',
    });
    setBSearch(r.beneficiary_name || '');
    setIsFormVisible(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRemoveTagFromRule = async (rule, tid) => {
    const nextTags = (rule.tag_ids || []).filter(id => id !== tid);
    try {
      if (nextTags.length === 0) {
        if (window.confirm(`Deleting the last tag will delete the categorization rule for "${rule.beneficiary_name}". Proceed?`)) {
          await apiFetch(`/api/categorization-rules/${rule.uid}`, { method: 'DELETE' });
        } else {
          return;
        }
      } else {
        await apiFetch(`/api/categorization-rules/${rule.uid}`, {
          method: 'PUT',
          body: JSON.stringify({ tag_ids: nextTags }),
        });
      }
      loadAll();
    } catch (err) {
      setError(err.detail || 'Failed to update rule');
    }
  };

  const handleSetPrimaryInRule = async (rule, tid) => {
    const nextTags = [tid, ...(rule.tag_ids || []).filter(id => id !== tid)];
    try {
      await apiFetch(`/api/categorization-rules/${rule.uid}`, {
        method: 'PUT',
        body: JSON.stringify({ tag_ids: nextTags }),
      });
      loadAll();
    } catch (err) {
      setError(err.detail || 'Failed to update rule');
    }
  };

  const handleDelete = async (uid) => {
    if (!window.confirm('Delete this categorization rule?')) return;
    setError(null);
    setLoading(true);
    try {
      await apiFetch(`/api/categorization-rules/${uid}`, { method: 'DELETE' });
      loadAll();
    } catch (err) {
      setError(err.detail || err.error || 'Failed to delete rule');
      setLoading(false);
    }
  };

  const handleReRun = async () => {
    setError(null);
    setLoading(true);
    try {
      await apiFetch('/api/categorization-rules/re-run', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      loadAll();
    } catch (err) {
      setError(err.detail || err.error || 'Re-run failed');
      setLoading(false);
    }
  };

  const formatRuleTags = (tagIds) =>
    (tagIds || []).map((tid) => formatTagAssignment(tid, tags)).join(', ');

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0 }}>Categorization Rules</h2>
        <button
          type="button"
          onClick={() => {
            if (isFormVisible) resetForm();
            else setIsFormVisible(true);
          }}
          style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}
        >
          {isFormVisible ? 'Cancel' : 'Add Rule'}
        </button>
      </div>

      <p style={{ color: '#666', marginBottom: '1rem' }}>
        Map beneficiaries to tags for <b>statement</b> transactions. Beneficiary identification is handled separately.
      </p>

      <div style={{ marginBottom: '1.5rem' }}>
        <button type="button" onClick={handleReRun} disabled={loading} style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}>
          Re-run categorization
        </button>
      </div>

      {isFormVisible && (
        <form
          onSubmit={handleSubmit}
          style={{
            border: '1px solid #ddd',
            borderRadius: 8,
            padding: '1.5rem',
            marginBottom: '2rem',
            background: '#f9f9f9',
            boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
          }}
        >
          <div style={{ display: 'grid', gap: '1rem' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontWeight: 500 }}>Rule name</span>
              <input
                readOnly
                value={generatedRuleName}
                placeholder="Select beneficiary and tags to generate name"
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  borderRadius: 4,
                  border: '1px solid #ccc',
                  background: '#f3f4f6',
                  color: '#475569',
                }}
              />
            </label>

            <div style={{ position: 'relative' }}>
              <label htmlFor="rule-beneficiary-search" style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>
                Beneficiary
              </label>
              <input
                id="rule-beneficiary-search"
                value={bSearch}
                onChange={(e) => {
                  setBSearch(e.target.value);
                  setForm((f) => ({
                    ...f,
                    beneficiary_id: '',
                    beneficiary_name: '',
                  }));
                }}
                onFocus={() => setBSearchFocused(true)}
                onBlur={() => setTimeout(() => setBSearchFocused(false), 200)}
                placeholder="Search beneficiary..."
                required
                style={{ width: '100%', padding: '0.5rem', borderRadius: 4, border: '1px solid #ccc' }}
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
                    borderRadius: 4,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                  }}
                >
                  {availableBeneficiaries.length === 0 ? (
                    <div style={{ padding: '0.6rem 1rem', color: '#94a3b8' }}>No matches</div>
                  ) : (
                    availableBeneficiaries.map((b) => (
                      <div
                        key={b.uid}
                        role="option"
                        tabIndex={0}
                        onMouseDown={() => handleSelectBeneficiary(b)}
                        style={{ padding: '0.6rem 1rem', cursor: 'pointer' }}
                      >
                        {b.name}
                        {b.aliases?.length > 0 && (
                          <span style={{ color: '#94a3b8', marginLeft: '0.5rem', fontSize: '0.85rem' }}>
                            {formatAliasesDisplay(b.aliases)}
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
              {beneficiaryConflict && (
                <div style={{ color: '#b91c1c', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                  {beneficiaryConflict}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontWeight: 500 }}>Tags to apply</span>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <select
                  value={tempTagId}
                  onChange={(e) => setTempTagId(e.target.value)}
                  style={{ flex: 1, padding: '0.5rem', borderRadius: 4, border: '1px solid #ccc' }}
                >
                  <option value="">Select a tag</option>
                  {filteredTags.map((t) => (
                    <option key={t.tag_id} value={t.tag_id}>
                      {formatTagAssignment(t.tag_id, tags)}
                    </option>
                  ))}
                </select>
                <button type="button" onClick={handleAddTag} style={{ padding: '0.5rem 1rem' }}>
                  Add
                </button>
              </div>
              <div
                style={{
                  padding: '0.75rem',
                  background: 'white',
                  border: '1px solid #eee',
                  borderRadius: 4,
                  minHeight: '2.5rem',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                }}
              >
                {form.tag_ids.length === 0 ? (
                  <span style={{ color: '#999', fontSize: '0.9rem' }}>No tags selected</span>
                ) : (
                  form.tag_ids.map((tid, idx) => {
                    const isPrimary = idx === 0;
                    const isHovered = hoveredFormTagId === tid;
                    return (
                      <span
                        key={tid}
                        onMouseEnter={() => setHoveredFormTagId(tid)}
                        onMouseLeave={() => setHoveredFormTagId(null)}
                        style={{
                          background: isPrimary ? '#dcfce7' : '#f1f5f9',
                          color: isPrimary ? '#166534' : '#475569',
                          padding: '0.3rem 0.6rem',
                          borderRadius: '16px',
                          fontSize: '0.85rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          border: isPrimary ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
                        }}
                      >
                        {formatTagAssignment(tid, tags)}
                        {isPrimary ? (
                          <span
                            style={{
                              fontSize: '0.7rem',
                              background: '#166534',
                              color: 'white',
                              padding: '1px 4px',
                              borderRadius: '4px',
                              textTransform: 'uppercase',
                              fontWeight: 'bold',
                            }}
                          >
                            Primary
                          </span>
                        ) : (
                          isHovered && (
                            <button
                              type="button"
                              onClick={() => {
                                setForm((f) => {
                                  const newTagIds = [tid, ...f.tag_ids.filter((id) => id !== tid)];
                                  return { ...f, tag_ids: newTagIds };
                                });
                              }}
                              style={{
                                background: '#3b82f6',
                                border: 'none',
                                color: 'white',
                                fontSize: '0.7rem',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontWeight: 'bold',
                              }}
                            >
                              Set Primary
                            </button>
                          )
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tid)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: isPrimary ? '#166534' : '#64748b',
                            cursor: 'pointer',
                            padding: 0,
                            fontWeight: 'bold',
                            fontSize: '1rem',
                            marginLeft: '2px',
                          }}
                        >
                          ×
                        </button>
                      </span>
                    );
                  })
                )}
              </div>
            </div>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontWeight: 500 }}>Notes (optional)</span>
              <input
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                style={{ width: '100%', padding: '0.5rem', borderRadius: 4, border: '1px solid #ccc' }}
              />
            </label>

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginTop: '0.5rem' }}>
              <button
                type="submit"
                disabled={loading || !!beneficiaryConflict || !form.beneficiary_id}
                style={{
                  padding: '0.75rem 2rem',
                  background: loading || beneficiaryConflict ? '#94a3b8' : '#2563eb',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  fontWeight: 600,
                  cursor: loading || beneficiaryConflict ? 'not-allowed' : 'pointer',
                }}
              >
                {isEditing ? 'Update Rule' : 'Create Rule'}
              </button>
              {isEditing && (
                <button
                  type="button"
                  onClick={resetForm}
                  style={{
                    padding: '0.75rem 2rem',
                    background: '#e5e7eb',
                    border: 'none',
                    borderRadius: 4,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </form>
      )}

      {error && (
        <div style={{ color: 'red', marginBottom: '1rem', fontWeight: 500 }}>{error}</div>
      )}

      <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h3 style={{ margin: 0 }}>Existing rules</h3>
          <div style={{ color: '#666', fontSize: '0.9rem' }}>
            {loading ? 'Loading…' : `${rules.length} rules total`}
          </div>
        </div>
        {rules.length === 0 ? (
          <div style={{ color: '#666' }}>No rules found.</div>
        ) : (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {rules.map((r) => {
              const aliasText = formatAliasesDisplay(r.beneficiary_aliases);
              const tagText = formatRuleTags(r.tag_ids);
              const userRule = isUserRule(r);

              return (
                <div
                  key={r.uid}
                  style={{
                    border: '1px solid #eee',
                    padding: '1rem',
                    borderRadius: 6,
                    background: '#fff',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
                    <div style={{ fontWeight: 650, fontSize: '1.05rem' }}>{r.rule_name}</div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button type="button" onClick={() => handleEdit(r)} style={{ padding: '0.25rem 0.75rem', cursor: 'pointer' }}>
                        Edit
                      </button>
                      {userRule && (
                        <button
                          type="button"
                          onClick={() => handleDelete(r.uid)}
                          style={{
                            padding: '0.25rem 0.75rem',
                            background: '#fee2e2',
                            color: '#b91c1c',
                            border: '1px solid #fecaca',
                            cursor: 'pointer',
                          }}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                  <div style={{ color: '#666', fontSize: '0.9rem', marginTop: '0.5rem', lineHeight: '1.5' }}>
                    <span style={{ fontWeight: 500 }}>Beneficiary:</span> {r.beneficiary_name}
                    {aliasText && (
                      <>
                        <br />
                        <span style={{ fontWeight: 500 }}>Aliases:</span>{' '}
                        <span style={{ color: '#94a3b8' }}>{aliasText}</span>
                      </>
                    )}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.4rem', alignItems: 'center' }}>
                      <span style={{ fontWeight: 500, marginRight: '4px', fontSize: '0.9rem', color: '#666' }}>Tags:</span>
                      {(r.tag_ids || []).map((tid, idx) => {
                        const isPrimary = idx === 0;
                        const isHovered = hoveredRuleTag === `${r.uid}-${tid}`;
                        return (
                          <span
                            key={tid}
                            onMouseEnter={() => setHoveredRuleTag(`${r.uid}-${tid}`)}
                            onMouseLeave={() => setHoveredRuleTag(null)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '0.15rem 0.5rem',
                              borderRadius: '12px',
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              background: isPrimary ? '#dcfce7' : '#f1f5f9',
                              color: isPrimary ? '#15803d' : '#475569',
                              border: isPrimary ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
                            }}
                          >
                            {formatTagAssignment(tid, tags)}
                            {isPrimary && (
                              <span
                                style={{
                                  marginLeft: '4px',
                                  fontSize: '0.65rem',
                                  background: '#15803d',
                                  color: 'white',
                                  padding: '1px 3px',
                                  borderRadius: '3px',
                                  textTransform: 'uppercase',
                                }}
                              >
                                Primary
                              </span>
                            )}
                            {!isPrimary && isHovered && (
                              <button
                                type="button"
                                onClick={() => handleSetPrimaryInRule(r, tid)}
                                style={{
                                  marginLeft: '4px',
                                  fontSize: '0.65rem',
                                  background: '#3b82f6',
                                  color: 'white',
                                  border: 'none',
                                  padding: '1px 4px',
                                  borderRadius: '3px',
                                  cursor: 'pointer',
                                  fontWeight: 'bold',
                                }}
                              >
                                Set Primary
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleRemoveTagFromRule(r, tid)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: isPrimary ? '#15803d' : '#64748b',
                                cursor: 'pointer',
                                padding: 0,
                                fontWeight: 'bold',
                                fontSize: '0.9rem',
                                marginLeft: '4px',
                              }}
                            >
                              ×
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  {r.notes && (
                    <div style={{ marginTop: '0.5rem', fontSize: '0.9rem', fontStyle: 'italic', color: '#444' }}>
                      &ldquo;{r.notes}&rdquo;
                    </div>
                  )}
                  <div style={{ color: '#999', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                    Created by: {userRule ? `User ${r.created_by}` : 'System'}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
