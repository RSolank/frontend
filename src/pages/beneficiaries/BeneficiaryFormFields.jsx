import React from 'react';

import { apiFetch } from '../../shared/api/apiClient';

import { AliasChipsInput } from './AliasChipsInput.jsx';

const fieldStyle = {
  width: '100%',
  padding: '0.6rem',
  borderRadius: '8px',
  border: '1px solid #e2e8f0',
};
const labelStyle = {
  display: 'block',
  marginBottom: '4px',
  fontWeight: 600,
  fontSize: '0.85rem',
};

export function emptyBeneficiaryForm(type = 'merchant') {
  return {
    uid: null,
    name: '',
    aliases: [],
    beneficiary_type: type,
    category: '',
    contact: '',
    merchant_upi_id: '',
    relationship_type: '',
    phone: '',
    person_upi_id: '',
  };
}

export function beneficiaryToForm(b) {
  return {
    uid: b.uid,
    name: b.name || '',
    aliases: [...(b.aliases || [])],
    beneficiary_type: b.beneficiary_type || 'merchant',
    category: b.merchant?.category || '',
    contact: b.merchant?.contact || '',
    merchant_upi_id: b.merchant?.upi_id || '',
    relationship_type: b.person?.relationship_type || '',
    phone: b.person?.phone || '',
    person_upi_id: b.person?.upi_id || '',
  };
}

export function switchBeneficiaryType(form, nextType) {
  if (!form || form.beneficiary_type === nextType) return form;

  if (nextType === 'merchant') {
    return {
      ...form,
      beneficiary_type: 'merchant',
      contact: form.contact || form.phone || '',
      merchant_upi_id: form.merchant_upi_id || form.person_upi_id || '',
    };
  }

  return {
    ...form,
    beneficiary_type: 'person',
    phone: form.phone || form.contact || '',
    person_upi_id: form.person_upi_id || form.merchant_upi_id || '',
  };
}

export function formToPayload(form) {
  const payload = {
    name: form.name.trim(),
    aliases: form.aliases,
    beneficiary_type: form.beneficiary_type,
  };
  if (form.beneficiary_type === 'merchant') {
    payload.merchant = {
      category: form.category ? String(form.category).trim() || null : null,
      contact: form.contact.trim() || null,
      upi_id: form.merchant_upi_id.trim() || null,
    };
  } else {
    payload.person = {
      relationship_type: form.relationship_type.trim() || null,
      phone: form.phone.trim() || null,
      upi_id: form.person_upi_id.trim() || null,
    };
  }
  return payload;
}

function Field({ label, children, style }) {
  const inputId = `beneficiary-field-${label.replace(/\W+/g, '-').toLowerCase()}`;
  const child = React.Children.only(children);
  return (
    <div style={style}>
      <label htmlFor={inputId} style={labelStyle}>
        {label}
      </label>
      {React.cloneElement(child, { id: child.props.id || inputId })}
    </div>
  );
}

function flattenTags(nodes, out = []) {
  for (const n of nodes || []) {
    out.push({
      tag_id: n.tag_id,
      tag_name: n.tag_name,
      parent: n.parent ?? null,
    });
    flattenTags(n.children, out);
  }
  return out;
}

function formatTagAssignment(tagId, flatTags) {
  const tag = flatTags.find((t) => t.tag_id === tagId);
  if (!tag) return String(tagId);
  const parent = tag.parent
    ? flatTags.find((t) => t.tag_id === tag.parent)
    : null;
  if (parent) return `${parent.tag_name} (${tag.tag_name})`;
  return tag.tag_name;
}

const SYSTEM_ONLY_TAG_IDS = [1, 2];

export function BeneficiaryFormFields({
  form,
  setForm,
  readOnly = false,
  excludeUid = null,
  onAliasValidityChange,
  onTypeChange,
}) {
  const disabled = readOnly;
  const isMerchant = form.beneficiary_type === 'merchant';
  const handleAliasValidity = (invalid) => {
    onAliasValidityChange?.(invalid);
  };

  const [relationships, setRelationships] = React.useState([]);
  const [tags, setTags] = React.useState([]);
  const [ruleTags, setRuleTags] = React.useState([]);
  const [hoveredTagId, setHoveredTagId] = React.useState(null);

  const handleRemoveRuleTag = async (tid) => {
    const nextTags = ruleTags.filter((id) => id !== tid);
    setRuleTags(nextTags);
    if (parseInt(form.category, 10) === tid) {
      const newPrimary = nextTags.length > 0 ? String(nextTags[0]) : '';
      setForm((f) => ({ ...f, category: newPrimary }));
    }
    if (form.uid) {
      try {
        const res = await apiFetch('/api/categorization-rules');
        const rule = (res.rules || []).find(
          (r) => r.beneficiary_id === form.uid
        );
        if (rule) {
          if (nextTags.length === 0) {
            await apiFetch(`/api/categorization-rules/${rule.uid}`, {
              method: 'DELETE',
            });
          } else {
            await apiFetch(`/api/categorization-rules/${rule.uid}`, {
              method: 'PUT',
              body: JSON.stringify({ tag_ids: nextTags }),
            });
          }
        }
      } catch (err) {
        console.error('Failed to update rule tags', err);
      }
    }
  };

  const handleSetPrimary = async (tid) => {
    const nextTags = [tid, ...ruleTags.filter((id) => id !== tid)];
    setRuleTags(nextTags);
    setForm((f) => ({ ...f, category: String(tid) }));
    if (form.uid) {
      try {
        const res = await apiFetch('/api/categorization-rules');
        const rule = (res.rules || []).find(
          (r) => r.beneficiary_id === form.uid
        );
        if (rule) {
          await apiFetch(`/api/categorization-rules/${rule.uid}`, {
            method: 'PUT',
            body: JSON.stringify({ tag_ids: nextTags }),
          });
        }
      } catch (err) {
        console.error('Failed to update rule tags', err);
      }
    }
  };

  React.useEffect(() => {
    apiFetch('/api/beneficiaries/relationships')
      .then((res) => setRelationships(Array.isArray(res) ? res : []))
      .catch((err) => console.error('Failed to load relationships', err));

    apiFetch('/api/tags')
      .then((res) => {
        setTags(flattenTags(res.tags));
      })
      .catch((err) => console.error('Failed to load tags', err));
  }, []);

  React.useEffect(() => {
    if (form.uid) {
      apiFetch('/api/categorization-rules')
        .then((res) => {
          const rule = (res.rules || []).find(
            (r) => r.beneficiary_id === form.uid
          );
          if (rule && rule.tag_ids) {
            setRuleTags(rule.tag_ids);
          } else {
            setRuleTags([]);
          }
        })
        .catch((err) => console.error('Failed to load rules', err));
    } else {
      setRuleTags([]);
    }
  }, [form.uid]);

  React.useEffect(() => {
    if (form.category && ruleTags.length === 0) {
      setRuleTags([parseInt(form.category, 10)]);
    }
  }, [form.category]);

  return (
    <>
      <Field label="Name" style={{ marginBottom: '1rem' }}>
        <input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
          readOnly={readOnly}
          disabled={disabled}
          style={fieldStyle}
        />
      </Field>

      <Field label="Type" style={{ marginBottom: '1rem' }}>
        <select
          value={form.beneficiary_type}
          onChange={(e) => {
            const nextType = e.target.value;
            const nextForm = switchBeneficiaryType(form, nextType);
            setForm(nextForm);
            onTypeChange?.(nextType, nextForm);
          }}
          disabled={disabled}
          style={{
            ...fieldStyle,
            background: disabled ? '#f1f5f9' : 'white',
            color: '#0f172a',
            textTransform: 'capitalize',
          }}
        >
          <option value="merchant">Merchant</option>
          <option value="person">Person</option>
        </select>
      </Field>

      <AliasChipsInput
        aliases={form.aliases}
        onChange={(aliases) => setForm({ ...form, aliases })}
        readOnly={readOnly}
        excludeUid={excludeUid}
        onValidityChange={handleAliasValidity}
      />

      {isMerchant ? (
        <>
          <Field label="Category" style={{ marginBottom: '1rem' }}>
            <select
              value={form.category}
              onChange={(e) => {
                const newCat = e.target.value;
                setForm({ ...form, category: newCat });
                if (newCat) {
                  const tagId = parseInt(newCat, 10);
                  setRuleTags((prev) => {
                    if (prev.includes(tagId)) {
                      return [tagId, ...prev.filter((id) => id !== tagId)];
                    } else {
                      return [tagId, ...prev];
                    }
                  });
                } else {
                  setRuleTags([]);
                }
              }}
              disabled={disabled}
              style={{
                ...fieldStyle,
                background: disabled ? '#f1f5f9' : 'white',
                color: '#0f172a',
              }}
            >
              <option value="">-- None --</option>
              {tags
                .filter((t) => !SYSTEM_ONLY_TAG_IDS.includes(t.tag_id))
                .map((t) => (
                  <option key={t.tag_id} value={t.tag_id}>
                    {formatTagAssignment(t.tag_id, tags)}
                  </option>
                ))}
            </select>
          </Field>

          {isMerchant && ruleTags.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <label style={labelStyle}>Assigned Tags</label>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                  marginTop: '4px',
                }}
              >
                {ruleTags.map((tid, idx) => {
                  const tagLabel = formatTagAssignment(tid, tags);
                  const isPrimary = idx === 0;
                  const isHovered = hoveredTagId === tid;
                  return (
                    <span
                      key={tid}
                      onMouseEnter={() => setHoveredTagId(tid)}
                      onMouseLeave={() => setHoveredTagId(null)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '0.3rem 0.6rem',
                        borderRadius: '16px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        background: isPrimary ? '#dcfce7' : '#f1f5f9',
                        color: isPrimary ? '#15803d' : '#475569',
                        border: isPrimary
                          ? '1px solid #bbf7d0'
                          : '1px solid #e2e8f0',
                        transition: 'all 0.2s',
                      }}
                    >
                      {tagLabel}
                      {isPrimary && (
                        <span
                          style={{
                            marginLeft: '4px',
                            fontSize: '0.7rem',
                            background: '#15803d',
                            color: 'white',
                            padding: '1px 4px',
                            borderRadius: '4px',
                            textTransform: 'uppercase',
                          }}
                        >
                          Primary
                        </span>
                      )}
                      {!isPrimary && isHovered && (
                        <button
                          type="button"
                          onClick={() => handleSetPrimary(tid)}
                          style={{
                            marginLeft: '6px',
                            fontSize: '0.7rem',
                            background: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                          }}
                        >
                          Set Primary
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoveRuleTag(tid)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: isPrimary ? '#15803d' : '#64748b',
                          cursor: 'pointer',
                          padding: 0,
                          fontWeight: 'bold',
                          fontSize: '1rem',
                          marginLeft: '6px',
                        }}
                      >
                        ×
                      </button>
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          <Field
            label="Contact (phone or website)"
            style={{ marginBottom: '1rem' }}
          >
            <input
              value={form.contact}
              onChange={(e) => setForm({ ...form, contact: e.target.value })}
              readOnly={readOnly}
              disabled={disabled}
              style={fieldStyle}
            />
          </Field>
          <Field label="UPI ID" style={{ marginBottom: '1rem' }}>
            <input
              value={form.merchant_upi_id}
              onChange={(e) =>
                setForm({ ...form, merchant_upi_id: e.target.value })
              }
              readOnly={readOnly}
              disabled={disabled}
              style={fieldStyle}
            />
          </Field>
        </>
      ) : (
        <>
          <Field label="Relationship" style={{ marginBottom: '1rem' }}>
            <select
              value={form.relationship_type}
              onChange={(e) =>
                setForm({ ...form, relationship_type: e.target.value })
              }
              disabled={disabled}
              style={{
                ...fieldStyle,
                background: disabled ? '#f1f5f9' : 'white',
                color: '#0f172a',
                textTransform: 'capitalize',
              }}
            >
              <option value="">-- Select Relationship --</option>
              {(relationships || []).map((r) => (
                <option
                  key={r}
                  value={r}
                  style={{ textTransform: 'capitalize' }}
                >
                  {r}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Phone" style={{ marginBottom: '1rem' }}>
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              readOnly={readOnly}
              disabled={disabled}
              style={fieldStyle}
            />
          </Field>
          <Field label="UPI ID" style={{ marginBottom: '1rem' }}>
            <input
              value={form.person_upi_id}
              onChange={(e) =>
                setForm({ ...form, person_upi_id: e.target.value })
              }
              readOnly={readOnly}
              disabled={disabled}
              style={fieldStyle}
            />
          </Field>
        </>
      )}
    </>
  );
}
