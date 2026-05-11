import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../utils/apiClient.js';

function flattenTags(nodes, out = []) {
  for (const n of nodes || []) {
    out.push({ tag_id: n.tag_id, tag_name: n.tag_name, parent: n.parent, created_by: n.created_by });
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
            {t.tag_name} <span style={{ color: '#666', fontSize: '0.8em' }}>[{t.tag_type}]</span>
            {t.aliases && t.aliases.length > 0 && <span style={{ color: '#888', fontSize: '0.8em', marginLeft: 4 }}>(Aliases: {t.aliases.join(', ')})</span>}
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
  const [form, setForm] = useState({ tag_name: '', parent: '', tag_type: 'essential', aliases: '' });
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
    if (!form.tag_name.trim()) return;
    
    const aliasesArray = form.aliases ? form.aliases.split(',').map(a => a.trim()).filter(a => a) : [];

    try {
      await apiFetch('/api/tags', {
        method: 'POST',
        body: JSON.stringify({
          tag_name: form.tag_name.trim(),
          parent: form.parent ? parseInt(form.parent, 10) : null,
          tag_type: form.tag_type,
          aliases: aliasesArray
        })
      });
      setForm({ tag_name: '', parent: '', tag_type: 'essential', aliases: '' });
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
            value={form.tag_name}
            onChange={(e) => {
              setForm((f) => ({ ...f, tag_name: e.target.value }));
              setError(null);
            }}
            placeholder="e.g. Subscriptions"
            style={{ padding: '0.5rem', marginLeft: 8, minWidth: 160 }}
          />
        </label>
        <label>
          Tag Type
          <select
            value={form.tag_type}
            onChange={(e) => setForm((f) => ({ ...f, tag_type: e.target.value }))}
            style={{ padding: '0.5rem', marginLeft: 8 }}
          >
            <option value="essential">Essential</option>
            <option value="discretionary">Discretionary</option>
            <option value="committed">Committed</option>
            <option value="exempted">Exempted</option>
          </select>
        </label>
        <label>
          Aliases (csv)
          <input
            value={form.aliases}
            onChange={(e) => setForm((f) => ({ ...f, aliases: e.target.value }))}
            placeholder="e.g. Subs, Renewals"
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
              <option key={t.tag_id} value={t.tag_id}>{t.tag_name}</option>
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


