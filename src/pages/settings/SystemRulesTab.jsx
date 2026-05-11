import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../utils/apiClient.js';

function flattenTags(nodes, out = []) {
  for (const n of nodes || []) {
    out.push({ tag_id: n.tag_id, name: n.name });
    flattenTags(n.children, out);
  }
  return out;
}

export function SystemRulesTab() {
  const [rules, setRules] = useState([]);
  const [tags, setTags] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    uid: null,
    name: '',
    field: 'merchant',
    match: 'icontains',
    pattern: '',
    tag_id: '',
    notes: ''
  });

  const isEditing = form.uid != null;

  const loadAll = () => {
    setLoading(true);
    setError(null);
    Promise.all([
      apiFetch('/api/system-rules?type=Categorization').then((d) => d.rules || []),
      apiFetch('/api/tags').then((d) => flattenTags(d.tags || []))
    ])
      .then(([r, t]) => {
        setRules(r);
        setTags(t);
      })
      .catch((err) => setError(err.detail || err.error || 'Failed to load rules'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetForm = () => {
    setForm({
      uid: null,
      name: '',
      field: 'merchant',
      match: 'icontains',
      pattern: '',
      tag_id: '',
      notes: ''
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) return setError('Rule name is required');
    if (!form.pattern.trim()) return setError('Pattern is required');
    if (!form.tag_id) return setError('Tag is required');

    const payload = {
      name: form.name.trim(),
      field: form.field,
      match: form.match,
      pattern: form.pattern,
      tag_id: parseInt(form.tag_id, 10),
      notes: form.notes || null
    };

    try {
      if (isEditing) {
        await apiFetch(`/api/system-rules/${form.uid}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
      } else {
        await apiFetch('/api/system-rules', {
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
    setForm({
      uid: r.uid,
      name: r.name || '',
      field: r.rule_condition?.field || 'merchant',
      match: r.rule_condition?.match || 'icontains',
      pattern: r.rule_condition?.pattern || '',
      tag_id: r.rule_implement?.tag_id || '',
      notes: r.notes || ''
    });
  };

  const handleReRun = async () => {
    setError(null);
    setLoading(true);
    try {
      await apiFetch('/api/system-rules/re-run', {
        method: 'POST',
        body: JSON.stringify({})
      });
      loadAll();
    } catch (err) {
      setError(err.detail || err.error || 'Re-run failed');
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 style={{ marginBottom: '1rem' }}>System Rules</h2>
      <p style={{ color: '#666', marginBottom: '1rem' }}>
        Categorization rules apply to <b>statement</b> transactions. Manual tags are not overridden.
      </p>

      {error && <div style={{ color: 'red', marginBottom: '0.75rem' }}>{error}</div>}

      <div style={{ marginBottom: '1rem' }}>
        <button type="button" onClick={handleReRun} disabled={loading} style={{ padding: '0.5rem 1rem' }}>
          Re-run categorization
        </button>
      </div>

      <form onSubmit={handleSubmit} style={{ border: '1px solid #ddd', borderRadius: 8, padding: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: '1fr 1fr' }}>
          <label style={{ gridColumn: 'span 2' }}>
            Rule name
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} style={{ width: '100%', padding: '0.5rem', marginTop: 4 }} />
          </label>

          <label>
            Field
            <select value={form.field} onChange={(e) => setForm((f) => ({ ...f, field: e.target.value }))} style={{ width: '100%', padding: '0.5rem', marginTop: 4 }}>
              <option value="merchant">merchant</option>
              <option value="notes">notes</option>
            </select>
          </label>

          <label>
            Match
            <select value={form.match} onChange={(e) => setForm((f) => ({ ...f, match: e.target.value }))} style={{ width: '100%', padding: '0.5rem', marginTop: 4 }}>
              <option value="icontains">icontains</option>
              <option value="equals">equals</option>
              <option value="regex">regex</option>
            </select>
          </label>

          <label style={{ gridColumn: 'span 2' }}>
            Pattern
            <input value={form.pattern} onChange={(e) => setForm((f) => ({ ...f, pattern: e.target.value }))} placeholder="e.g. BLINKIT or SALARY|PENSION" style={{ width: '100%', padding: '0.5rem', marginTop: 4 }} />
          </label>

          <label>
            Tag to apply
            <select value={form.tag_id} onChange={(e) => setForm((f) => ({ ...f, tag_id: e.target.value }))} style={{ width: '100%', padding: '0.5rem', marginTop: 4 }}>
              <option value="">— Select tag —</option>
              {tags.map((t) => (
                <option key={t.tag_id} value={t.tag_id}>{t.name}</option>
              ))}
            </select>
          </label>

          <label>
            Notes (optional)
            <input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} style={{ width: '100%', padding: '0.5rem', marginTop: 4 }} />
          </label>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', gridColumn: 'span 2', marginTop: '0.25rem' }}>
            <button type="submit" disabled={loading} style={{ padding: '0.6rem 1rem' }}>
              {isEditing ? 'Update rule' : 'Add rule'}
            </button>
            {isEditing && (
              <button type="button" onClick={resetForm} style={{ padding: '0.6rem 1rem' }}>
                Cancel
              </button>
            )}
          </div>
        </div>
      </form>

      <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h3 style={{ margin: 0 }}>Existing rules</h3>
          <div style={{ color: '#666', fontSize: '0.9rem' }}>{loading ? 'Loading…' : `${rules.length} rules`}</div>
        </div>
        {rules.length === 0 ? (
          <div style={{ color: '#666' }}>No rules found.</div>
        ) : (
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {rules.map((r) => (
              <div key={r.uid} style={{ border: '1px solid #eee', padding: '0.75rem', borderRadius: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
                  <div style={{ fontWeight: 650 }}>{r.name}</div>
                  <button type="button" onClick={() => handleEdit(r)} style={{ padding: '0.25rem 0.5rem' }}>
                    Edit
                  </button>
                </div>
                <div style={{ color: '#666', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                  Field: {r.rule_condition?.field} • Match: {r.rule_condition?.match} • Pattern: {r.rule_condition?.pattern} • Tag: {r.rule_implement?.tag_id}
                </div>
                {r.notes && <div style={{ marginTop: '0.25rem', fontSize: '0.9rem' }}>{r.notes}</div>}
                <div style={{ color: '#999', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                  created_by: {r.created_by == null ? 'system' : r.created_by}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

