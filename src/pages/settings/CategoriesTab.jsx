import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../utils/apiClient.js';

function flattenTags(nodes, out = []) {
  for (const n of nodes || []) {
    out.push({ tag_id: n.tag_id, name: n.name, parent: n.parent, created_by: n.created_by });
    flattenTags(n.children, out);
  }
  return out;
}

function TagTree({ tags }) {
  if (!tags || tags.length === 0) return <p style={{ color: '#666' }}>No tags.</p>;
  return (
    <ul style={{ listStyle: 'none', paddingLeft: 0 }}>
      {tags.map((t) => (
        <li key={t.tag_id} style={{ marginBottom: '0.25rem' }}>
          <span style={{ fontWeight: t.parent == null ? 600 : 400 }}>
            {t.name}
            {t.created_by == null && <span style={{ color: '#999', fontSize: '0.85em', marginLeft: 6 }}>(system)</span>}
          </span>
          {t.children && t.children.length > 0 && (
            <ul style={{ listStyle: 'none', paddingLeft: '1.5rem', marginTop: '0.25rem' }}>
              <TagTree tags={t.children} />
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}

export function CategoriesTab() {
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', parent: '' });
  const [error, setError] = useState(null);
  const [flatTags, setFlatTags] = useState([]);

  const loadTags = () => {
    setLoading(true);
    apiFetch('/api/tags')
      .then((d) => {
        setTags(d.tags || []);
        setFlatTags(flattenTags(d.tags || []));
      })
      .catch(() => setTags([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadTags();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) return;
    try {
      await apiFetch('/api/tags', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name.trim(),
          parent: form.parent ? parseInt(form.parent, 10) : null
        })
      });
      setForm({ name: '', parent: '' });
      loadTags();
    } catch (err) {
      setError(err.error || 'Failed to create tag');
    }
  };

  return (
    <div>
      <h2 style={{ marginBottom: '1rem' }}>Categories & tags</h2>
      <p style={{ color: '#666', marginBottom: '1rem' }}>
        System tags (seeded defaults) are read-only. You can add your own categories or subcategories below.
      </p>

      <form
        onSubmit={handleSubmit}
        style={{ marginBottom: '2rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'flex-end' }}
      >
        <label>
          New tag name
          <input
            value={form.name}
            onChange={(e) => {
              setForm((f) => ({ ...f, name: e.target.value }));
              setError(null);
            }}
            placeholder="e.g. Subscriptions"
            style={{ padding: '0.5rem', marginLeft: 8, minWidth: 160 }}
          />
        </label>
        <label>
          Parent (optional)
          <select
            value={form.parent}
            onChange={(e) => setForm((f) => ({ ...f, parent: e.target.value }))}
            style={{ padding: '0.5rem', marginLeft: 8 }}
          >
            <option value="">— None (top-level) —</option>
            {flatTags.map((t) => (
              <option key={t.tag_id} value={t.tag_id}>{t.name}</option>
            ))}
          </select>
        </label>
        <button type="submit" style={{ padding: '0.5rem 1rem' }}>Add tag</button>
      </form>
      {error && <div style={{ color: 'red', marginBottom: '0.5rem' }}>{error}</div>}

      <h3 style={{ marginBottom: '0.5rem' }}>All tags</h3>
      {loading ? <p>Loading...</p> : <TagTree tags={tags} />}
    </div>
  );
}

