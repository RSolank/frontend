import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../../utils/apiClient.js';

function flattenTags(nodes, out = []) {
  for (const n of nodes || []) {
    out.push({ tag_id: n.tag_id, tag_name: n.tag_name });
    flattenTags(n.children, out);
  }
  return out;
}

function parseKeywords(pattern) {
  if (!pattern) return [];
  const s = pattern.trim();
  let parts = [];
  if (s.startsWith('(') && s.endsWith(')')) {
    parts = s.slice(1, -1).split('|');
  } else {
    parts = s.split(',');
  }
  return parts.map(p => p.trim().toLowerCase()).filter(Boolean);
}

export function CategorizationRulesTab() {
  const [rules, setRules] = useState([]);
  const [tags, setTags] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [constants, setConstants] = useState(null);

  const [isFormVisible, setIsFormVisible] = useState(false);
  const [form, setForm] = useState({
    uid: null,
    name: '',
    field: 'beneficiary',
    match: 'icontains',
    keywords: [],
    tag_ids: [],
    notes: ''
  });

  const [tempKeyword, setTempKeyword] = useState('');
  const [tempTagId, setTempTagId] = useState('');
  const [keywordConflict, setKeywordConflict] = useState(null);

  const isEditing = form.uid != null;

  const loadAll = () => {
    setLoading(true);
    setError(null);
    Promise.all([
      apiFetch('/api/categorization-rules').then((d) => d.rules || []),
      apiFetch('/api/tags').then((d) => flattenTags(d.tags || [])),
      apiFetch('/api/options/constants')
    ])
      .then(([r, t, c]) => {
        setRules(r);
        setTags(t);
        setConstants(c);
      })
      .catch((err) => setError(err.detail || err.error || 'Failed to load rules'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live conflict checking
  useEffect(() => {
    if (form.keywords.length === 0) {
      setKeywordConflict(null);
      return;
    }

    const incomingKeywords = form.keywords.map(k => k.toLowerCase());

    for (const rule of rules) {
      if (isEditing && rule.uid === form.uid) continue;

      const existingPattern = rule.rule_condition?.pattern || '';
      const existingKeywords = parseKeywords(existingPattern);

      const conflict = incomingKeywords.find(kw => existingKeywords.includes(kw));
      if (conflict) {
        setKeywordConflict(`Warning: Keyword "${conflict}" is already used by rule "${rule.rule_name}"`);
        return;
      }
    }
    setKeywordConflict(null);
  }, [form.keywords, rules, isEditing, form.uid]);

  const resetForm = () => {
    setForm({
      uid: null,
      name: '',
      field: 'beneficiary',
      match: 'icontains',
      keywords: [],
      tag_ids: [],
      notes: ''
    });
    setTempKeyword('');
    setTempTagId('');
    setKeywordConflict(null);
    setIsFormVisible(false);
  };

  const handleAddKeyword = () => {
    const kw = tempKeyword.trim();
    if (!kw) return;
    if (form.keywords.includes(kw)) {
      setTempKeyword('');
      return;
    }
    setForm(f => ({ ...f, keywords: [...f.keywords, kw] }));
    setTempKeyword('');
  };

  const handleRemoveKeyword = (kw) => {
    setForm(f => ({ ...f, keywords: f.keywords.filter(k => k !== kw) }));
  };

  const handleAddTag = () => {
    if (!tempTagId) return;
    const tid = parseInt(tempTagId, 10);
    if (form.tag_ids.includes(tid)) return;
    setForm(f => ({ ...f, tag_ids: [...f.tag_ids, tid] }));
    setTempTagId('');
  };

  const handleRemoveTag = (tid) => {
    setForm(f => ({ ...f, tag_ids: f.tag_ids.filter(id => id !== tid) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) return setError('Rule name is required');
    if (form.keywords.length === 0) return setError('At least one keyword is required');
    if (form.tag_ids.length === 0) return setError('At least one tag is required');

    const payload = {
      name: form.name.trim(),
      field: form.field,
      match: form.match,
      pattern: form.keywords.join(', '),
      tag_ids: form.tag_ids,
      notes: form.notes || null
    };

    try {
      if (isEditing) {
        await apiFetch(`/api/categorization-rules/${form.uid}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
      } else {
        await apiFetch('/api/categorization-rules', {
          method: 'POST',
          body: JSON.stringify(payload)
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
    const existingKeywords = parseKeywords(r.rule_condition?.pattern || '');
    setForm({
      uid: r.uid,
      name: r.rule_name || '',
      field: r.rule_condition?.field || 'beneficiary',
      match: r.rule_condition?.match || 'icontains',
      keywords: existingKeywords,
      tag_ids: r.rule_implement?.tag_ids || (r.rule_implement?.tag_id ? [r.rule_implement?.tag_id] : []),
      notes: r.notes || ''
    });
    setIsFormVisible(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (uid) => {
    if (!window.confirm('Delete this categorization rule?')) return;
    setError(null);
    setLoading(true);
    try {
      await apiFetch(`/api/categorization-rules/${uid}`, {
        method: 'DELETE'
      });
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
        body: JSON.stringify({})
      });
      loadAll();
    } catch (err) {
      setError(err.detail || err.error || 'Re-run failed');
      setLoading(false);
    }
  };

  // Filter out Total and Miscellaneous tags
  const filteredTags = tags.filter(t =>
    t.tag_id !== constants?.TOTAL_TAG_ID &&
    t.tag_id !== constants?.MISCELLANEOUS_TAG_ID
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0 }}>Categorization Rules</h2>
        <button
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
        Categorization rules apply to <b>statement</b> transactions. Manual tags are not overridden.
      </p>

      <div style={{ marginBottom: '1.5rem' }}>
        <button type="button" onClick={handleReRun} disabled={loading} style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}>
          Re-run categorization
        </button>
      </div>

      {isFormVisible && (
        <form onSubmit={handleSubmit} style={{ border: '1px solid #ddd', borderRadius: 8, padding: '1.5rem', marginBottom: '2rem', background: '#f9f9f9', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: '1fr 1fr' }}>
            <label style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontWeight: 500 }}>Rule name</span>
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} style={{ width: '100%', padding: '0.5rem', borderRadius: 4, border: '1px solid #ccc' }} />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontWeight: 500 }}>Field</span>
              <select value={form.field} onChange={(e) => setForm((f) => ({ ...f, field: e.target.value }))} style={{ width: '100%', padding: '0.5rem', borderRadius: 4, border: '1px solid #ccc' }}>
                <option value="beneficiary">Beneficiary</option>
                <option value="notes">Notes</option>
              </select>
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontWeight: 500 }}>Match</span>
              <select value={form.match} onChange={(e) => setForm((f) => ({ ...f, match: e.target.value }))} style={{ width: '100%', padding: '0.5rem', borderRadius: 4, border: '1px solid #ccc' }}>
                <option value="icontains">Light - Keywords in Pattern are a subset of the value in Field.</option>
                <option value="equals">Strict - Pattern must exactly match the value in Field.</option>
                <option value="regex">Advanced - Pattern must match the value in Field using complex regex syntax.</option>
              </select>
            </label>

            <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontWeight: 500 }}>Keywords (Pattern)</span>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <input
                  value={tempKeyword}
                  onChange={(e) => setTempKeyword(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddKeyword())}
                  placeholder="Enter keyword"
                  style={{ flex: 1, padding: '0.5rem', borderRadius: 4, border: '1px solid #ccc' }}
                />
                <button type="button" onClick={handleAddKeyword} style={{ padding: '0.5rem 1rem' }}>Add</button>
              </div>
              <div style={{ padding: '0.75rem', background: 'white', border: '1px solid #eee', borderRadius: 4, minHeight: '2.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {form.keywords.length === 0 ? <span style={{ color: '#999', fontSize: '0.9rem' }}>No keywords added</span> : (
                  form.keywords.map(kw => (
                    <span key={kw} style={{ background: '#e0e7ff', color: '#4338ca', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {kw}
                      <button type="button" onClick={() => handleRemoveKeyword(kw)} style={{ background: 'none', border: 'none', color: '#4338ca', cursor: 'pointer', padding: 0, fontWeight: 'bold' }}>×</button>
                    </span>
                  ))
                )}
              </div>
              <input readOnly value={form.keywords.join(', ')} style={{ marginTop: '0.5rem', padding: '0.5rem', background: '#f3f4f6', border: '1px solid #ddd', color: '#666', fontSize: '0.85rem' }} />
              {keywordConflict && (
                <div style={{ color: '#b91c1c', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                  {keywordConflict}
                </div>
              )}
            </div>

            <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontWeight: 500 }}>Tags to apply</span>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <select
                  value={tempTagId}
                  onChange={(e) => setTempTagId(e.target.value)}
                  style={{ flex: 1, padding: '0.5rem', borderRadius: 4, border: '1px solid #ccc' }}
                >
                  <option value="">Select a tag</option>
                  {filteredTags.map(t => (
                    <option key={t.tag_id} value={t.tag_id}>{t.tag_name}</option>
                  ))}
                </select>
                <button type="button" onClick={handleAddTag} style={{ padding: '0.5rem 1rem' }}>Add</button>
              </div>
              <div style={{ padding: '0.75rem', background: 'white', border: '1px solid #eee', borderRadius: 4, minHeight: '2.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {form.tag_ids.length === 0 ? <span style={{ color: '#999', fontSize: '0.9rem' }}>No tags selected</span> : (
                  form.tag_ids.map(tid => {
                    const tag = tags.find(t => t.tag_id === tid);
                    return (
                      <span key={tid} style={{ background: '#dcfce7', color: '#166534', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {tag ? tag.tag_name : tid}
                        <button type="button" onClick={() => handleRemoveTag(tid)} style={{ background: 'none', border: 'none', color: '#166534', cursor: 'pointer', padding: 0, fontWeight: 'bold' }}>×</button>
                      </span>
                    );
                  })
                )}
              </div>
            </div>

            <label style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontWeight: 500 }}>Notes (optional)</span>
              <input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} style={{ width: '100%', padding: '0.5rem', borderRadius: 4, border: '1px solid #ccc' }} />
            </label>

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', gridColumn: 'span 2', marginTop: '0.5rem' }}>
              <button type="submit" disabled={loading} style={{ padding: '0.75rem 2rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: 4, fontWeight: 600, cursor: 'pointer' }}>
                {isEditing ? 'Update Rule' : 'Create Rule'}
              </button>
              {isEditing && (
                <button type="button" onClick={resetForm} style={{ padding: '0.75rem 2rem', background: '#e5e7eb', border: 'none', borderRadius: 4, fontWeight: 600, cursor: 'pointer' }}>
                  Cancel
                </button>
              )}
            </div>
          </div>
        </form>
      )}

      {error && <div style={{ color: 'red', marginBottom: '1rem', fontWeight: 500 }}>{error}</div>}

      <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h3 style={{ margin: 0 }}>Existing rules</h3>
          <div style={{ color: '#666', fontSize: '0.9rem' }}>{loading ? 'Loading…' : `${rules.length} rules total`}</div>
        </div>
        {rules.length === 0 ? (
          <div style={{ color: '#666' }}>No rules found.</div>
        ) : (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {rules.map((r) => {
              const ruleTagIds = r.rule_implement?.tag_ids || (r.rule_implement?.tag_id ? [r.rule_implement?.tag_id] : []);
              const tagNames = ruleTagIds.map(tid => {
                const tag = tags.find(t => t.tag_id === tid);
                return tag ? tag.tag_name : tid;
              });

              return (
                <div key={r.uid} style={{ border: '1px solid #eee', padding: '1rem', borderRadius: 6, background: '#fff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
                    <div style={{ fontWeight: 650, fontSize: '1.05rem' }}>{r.rule_name}</div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button type="button" onClick={() => handleEdit(r)} style={{ padding: '0.25rem 0.75rem', cursor: 'pointer' }}>
                        Edit
                      </button>
                      {r.created_by != null && (
                        <button type="button" onClick={() => handleDelete(r.uid)} style={{ padding: '0.25rem 0.75rem', background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca', cursor: 'pointer' }}>
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                  <div style={{ color: '#666', fontSize: '0.9rem', marginTop: '0.5rem', lineHeight: '1.5' }}>
                    <span style={{ fontWeight: 500 }}>Pattern:</span> {r.rule_condition?.pattern} <br />
                    <span style={{ fontWeight: 500 }}>Tags:</span> {tagNames.join(', ')}
                  </div>
                  {r.notes && <div style={{ marginTop: '0.5rem', fontSize: '0.9rem', fontStyle: 'italic', color: '#444' }}>"{r.notes}"</div>}
                  <div style={{ color: '#999', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                    Created by: {r.created_by == null ? 'System' : `User ${r.created_by}`}
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
