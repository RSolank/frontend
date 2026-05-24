import React, { useEffect, useState } from 'react';

import { apiFetch } from '../../../shared/api/apiClient';

function sortTagsById(nodes) {
  if (!nodes) return [];
  const sorted = [...nodes].sort((a, b) => a.tag_id - b.tag_id);
  for (const node of sorted) {
    if (node.children) {
      node.children = sortTagsById(node.children);
    }
  }
  return sorted;
}

function flattenTags(nodes, out = []) {
  for (const n of nodes || []) {
    out.push({
      tag_id: n.tag_id,
      tag_name: n.tag_name,
      parent: n.parent,
      created_by: n.created_by,
      tag_type: n.tag_type,
      aliases: n.aliases || [],
    });
    flattenTags(n.children, out);
  }
  return out;
}

function TagRow({ t, onEdit, onDelete, constants, level }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasChildren = t.children && t.children.length > 0;

  const isSystem =
    t.created_by === null || t.created_by === constants?.SYSTEM_USER_ID;
  const isRestricted =
    t.tag_id === constants?.TOTAL_TAG_ID ||
    t.tag_id === constants?.MISCELLANEOUS_TAG_ID ||
    t.tag_id === constants?.CONSUMPTION_TAX_TAG_ID;

  return (
    <>
      <li
        style={{
          marginBottom: '0.25rem',
          padding: '0.5rem',
          borderBottom: '1px solid #eee',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: level % 2 === 0 ? 'transparent' : '#fcfcfc',
        }}
      >
        <div
          style={{
            paddingLeft: `${level * 1.5}rem`,
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexWrap: 'wrap',
          }}
        >
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              visibility: hasChildren ? 'visible' : 'hidden',
              transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
              transition: 'transform 0.2s',
            }}
          >
            ▼
          </button>
          <span style={{ fontWeight: t.parent == null ? 600 : 400 }}>
            {t.tag_name}
          </span>
          <span
            style={{ color: '#666', fontSize: '0.8em', whiteSpace: 'nowrap' }}
          >
            [{t.tag_type}]
          </span>
          {t.aliases && t.aliases.length > 0 && (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '4px',
                marginLeft: '4px',
              }}
            >
              {t.aliases.map((a, i) => (
                <span
                  key={i}
                  style={{
                    fontSize: '0.7rem',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    background: '#f1f5f9',
                    color: '#64748b',
                    fontWeight: 600,
                  }}
                >
                  {a}
                </span>
              ))}
            </div>
          )}
          {isSystem && (
            <span style={{ color: '#999', fontSize: '0.85em' }}>(system)</span>
          )}
        </div>
        <div
          style={{
            display: 'flex',
            gap: '0.5rem',
            marginLeft: '1rem',
            flexShrink: 0,
          }}
        >
          {!isRestricted && (
            <button
              onClick={() => onEdit(t)}
              style={{
                padding: '0.25rem 0.75rem',
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              Update
            </button>
          )}
          {!isSystem && (
            <button
              onClick={() => onDelete(t.tag_id)}
              style={{
                padding: '0.25rem 0.75rem',
                fontSize: '0.85rem',
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
      </li>
      {hasChildren && isExpanded && (
        <TagTree
          tags={t.children}
          onEdit={onEdit}
          onDelete={onDelete}
          constants={constants}
          level={level + 1}
        />
      )}
    </>
  );
}

function TagTree({ tags, onEdit, onDelete, constants, level = 0 }) {
  if (!tags || tags.length === 0) return null;

  return (
    <ul style={{ listStyle: 'none', paddingLeft: 0, margin: 0 }}>
      {tags.map((t) => (
        <TagRow
          key={t.tag_id}
          t={t}
          onEdit={onEdit}
          onDelete={onDelete}
          constants={constants}
          level={level}
        />
      ))}
    </ul>
  );
}

export function CategoriesTab() {
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [editingTagId, setEditingTagId] = useState(null);
  const [form, setForm] = useState({
    tag_name: '',
    parent: '',
    tag_type: 'discretionary',
    aliases: [],
  });
  const [aliasTemp, setAliasTemp] = useState('');
  const [error, setError] = useState(null);
  const [flatTags, setFlatTags] = useState([]);
  const [constants, setConstants] = useState(null);

  const loadTags = () => {
    setLoading(true);
    apiFetch('/api/tags')
      .then((d) => {
        const sorted = sortTagsById(d.tags || []);
        setTags(sorted);
        setFlatTags(flattenTags(sorted));
      })
      .catch(() => setTags([]))
      .finally(() => setLoading(false));
  };

  const loadConstants = () => {
    apiFetch('/api/metadata/constants')
      .then(setConstants)
      .catch((err) => console.error('Failed to load constants', err));
  };

  useEffect(() => {
    loadTags();
    loadConstants();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetForm = () => {
    setForm({
      tag_name: '',
      parent: '',
      tag_type: 'discretionary',
      aliases: [],
    });
    setAliasTemp('');
    setEditingTagId(null);
    setIsFormVisible(false);
    setError(null);
  };

  const handleEdit = (tag) => {
    setEditingTagId(tag.tag_id);
    setForm({
      tag_name: tag.tag_name,
      parent: tag.parent || '',
      tag_type: tag.tag_type,
      aliases: tag.aliases || [],
    });
    setAliasTemp('');
    setIsFormVisible(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (tagId) => {
    if (!window.confirm('Are you sure you want to delete this tag?')) return;
    try {
      await apiFetch(`/api/tags/${tagId}`, { method: 'DELETE' });
      loadTags();
    } catch (err) {
      setError(err.detail || err.error || 'Failed to delete tag');
    }
  };

  const handleAddAlias = () => {
    const val = aliasTemp.trim();
    if (!val) return;
    if (form.aliases.includes(val)) {
      setAliasTemp('');
      return;
    }
    setForm((f) => ({ ...f, aliases: [...f.aliases, val] }));
    setAliasTemp('');
  };

  const handleRemoveAlias = (val) => {
    setForm((f) => ({ ...f, aliases: f.aliases.filter((a) => a !== val) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!form.tag_name.trim()) return;

    const payload = {
      tag_name: form.tag_name.trim(),
      parent: form.parent ? parseInt(form.parent, 10) : null,
      tag_type: form.tag_type,
      aliases: form.aliases,
    };

    try {
      if (editingTagId) {
        await apiFetch(`/api/tags/${editingTagId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch('/api/tags', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      resetForm();
      loadTags();
    } catch (err) {
      setError(err.detail || err.error || 'Failed to save tag');
    }
  };

  const isSystemTag =
    editingTagId &&
    (() => {
      const tag = flatTags.find((t) => t.tag_id === editingTagId);
      return (
        tag?.created_by === null ||
        tag?.created_by === constants?.SYSTEM_USER_ID
      );
    })();

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1rem',
        }}
      >
        <h2 style={{ margin: 0 }}>Categories & tags</h2>
        <button
          onClick={() => {
            if (isFormVisible) resetForm();
            else setIsFormVisible(true);
          }}
          style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}
        >
          {isFormVisible ? 'Cancel' : 'Add Tag'}
        </button>
      </div>

      <p style={{ color: '#666', marginBottom: '1.5rem', lineHeight: '1.4' }}>
        System tags (seeded defaults) can only be partially edited (you can add
        aliases and change tag types).
        <br />
        You can add your own custom categories or subcategories below.
        <br />
        <strong>
          Aliases help the auto-categorization engine to tag your transactions
          correctly.
        </strong>
      </p>

      {isFormVisible && (
        <form
          onSubmit={handleSubmit}
          style={{
            marginBottom: '2rem',
            padding: '1.5rem',
            border: '1px solid #ddd',
            borderRadius: '12px',
            background: '#ffffff',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1.25rem',
            }}
          >
            <label
              style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}
            >
              <span
                style={{
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: '#475569',
                }}
              >
                Tag name
              </span>
              <input
                value={form.tag_name}
                disabled={isSystemTag}
                onChange={(e) =>
                  setForm((f) => ({ ...f, tag_name: e.target.value }))
                }
                placeholder="e.g. Subscriptions"
                style={{
                  padding: '0.6rem',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                }}
              />
            </label>
            <label
              style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}
            >
              <span
                style={{
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: '#475569',
                }}
              >
                Tag Type
              </span>
              <select
                value={form.tag_type}
                onChange={(e) =>
                  setForm((f) => ({ ...f, tag_type: e.target.value }))
                }
                style={{
                  padding: '0.6rem',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                }}
              >
                <option value="essential">Essential</option>
                <option value="discretionary">Discretionary</option>
                <option value="committed">Committed</option>
                <option value="exempted">Exempted</option>
                <option value="income">Income</option>
              </select>
            </label>
            <label
              style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}
            >
              <span
                style={{
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: '#475569',
                }}
              >
                Parent (optional)
              </span>
              <select
                value={form.parent}
                disabled={isSystemTag}
                onChange={(e) =>
                  setForm((f) => ({ ...f, parent: e.target.value }))
                }
                style={{
                  padding: '0.6rem',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                }}
              >
                <option value="">— None (top-level) —</option>
                {flatTags
                  .filter((t) => t.tag_id !== editingTagId)
                  .map((t) => (
                    <option key={t.tag_id} value={t.tag_id}>
                      {t.tag_name}
                    </option>
                  ))}
              </select>
            </label>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span
              style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}
            >
              Aliases
            </span>
            <div
              style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}
            >
              <input
                value={aliasTemp}
                onChange={(e) => setAliasTemp(e.target.value)}
                onKeyPress={(e) =>
                  e.key === 'Enter' && (e.preventDefault(), handleAddAlias())
                }
                placeholder="Enter alias (e.g. Netflix, Spotify)"
                style={{
                  flex: 1,
                  padding: '0.6rem',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                }}
              />
              <button
                type="button"
                onClick={handleAddAlias}
                style={{
                  padding: '0.6rem 1.2rem',
                  background: '#f1f5f9',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Add
              </button>
            </div>
            <div
              style={{
                padding: '0.75rem',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                minHeight: '3rem',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.5rem',
              }}
            >
              {form.aliases.length === 0 ? (
                <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                  No aliases added
                </span>
              ) : (
                form.aliases.map((a) => (
                  <span
                    key={a}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      background: '#eff6ff',
                      color: '#2563eb',
                      padding: '4px 10px',
                      borderRadius: '20px',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      border: '1px solid #dbeafe',
                    }}
                  >
                    {a}
                    <button
                      type="button"
                      onClick={() => handleRemoveAlias(a)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#2563eb',
                        cursor: 'pointer',
                        padding: 0,
                        fontWeight: 700,
                        fontSize: '1rem',
                      }}
                    >
                      ×
                    </button>
                  </span>
                ))
              )}
            </div>
            <input
              readOnly
              value={form.aliases.join(', ')}
              style={{
                marginTop: '0.5rem',
                padding: '0.5rem',
                background: '#f3f4f6',
                border: '1px solid #e2e8f0',
                color: '#64748b',
                fontSize: '0.85rem',
                borderRadius: '4px',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
            <button
              type="submit"
              style={{
                flex: 1,
                padding: '0.75rem',
                background: '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'background 0.2s',
              }}
            >
              {editingTagId ? 'Update Tag' : 'Create Tag'}
            </button>
            {editingTagId && (
              <button
                type="button"
                onClick={resetForm}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  background: '#f1f5f9',
                  color: '#475569',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      )}

      {error && (
        <div
          style={{
            color: '#ef4444',
            marginBottom: '1rem',
            fontWeight: 600,
            background: '#fef2f2',
            padding: '0.75rem',
            borderRadius: '8px',
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1rem',
        }}
      >
        <h3 style={{ margin: 0 }}>All tags</h3>
        <span style={{ color: '#666', fontSize: '0.9rem' }}>
          {flatTags.length} tags total
        </span>
      </div>

      <div
        style={{
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          overflow: 'hidden',
          background: 'white',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        {loading ? (
          <p style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
            Loading tags...
          </p>
        ) : (
          <TagTree
            tags={tags}
            onEdit={handleEdit}
            onDelete={handleDelete}
            constants={constants}
          />
        )}
      </div>
    </div>
  );
}
