import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { apiFetch } from '../../utils/apiClient.js';

import {
  BeneficiaryFormFields,
  beneficiaryToForm,
  formToPayload,
} from './BeneficiaryFormFields.jsx';
import { MergeBeneficiariesForm } from './MergeBeneficiariesForm.jsx';

const ActionDropdown = ({ editing, onEdit, onCancel, onDelete }) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (ref.current && !ref.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          background: '#f1f5f9',
          borderRadius: '8px',
          overflow: 'hidden',
        }}
      >
        <button
          type="button"
          onClick={editing ? onCancel : onEdit}
          style={{
            padding: '0.5rem 1rem',
            background: 'none',
            border: 'none',
            color: '#2563eb',
            fontWeight: 700,
            cursor: 'pointer',
            borderRight: '1px solid #e2e8f0',
          }}
        >
          {editing ? 'Cancel' : 'Edit'}
        </button>
        {!editing && (
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            aria-label="More actions"
            style={{
              padding: '0.5rem 0.6rem',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#64748b',
              fontSize: '0.7rem',
            }}
          >
            ▼
          </button>
        )}
      </div>

      {isOpen && !editing && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: '100%',
            marginTop: '4px',
            background: 'white',
            borderRadius: '8px',
            boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
            border: '1px solid #f1f5f9',
            zIndex: 10,
            minWidth: '100px',
          }}
        >
          <button
            type="button"
            onClick={() => {
              onDelete();
              setIsOpen(false);
            }}
            style={{
              width: '100%',
              textAlign: 'left',
              padding: '0.6rem 0.75rem',
              background: 'none',
              border: 'none',
              color: '#ef4444',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
};

export function BeneficiaryDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [beneficiary, setBeneficiary] = useState(null);
  const [allBeneficiaries, setAllBeneficiaries] = useState([]);
  const [form, setForm] = useState(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mergeSource, setMergeSource] = useState('');
  const [mergeTarget, setMergeTarget] = useState('');
  const [aliasInvalid, setAliasInvalid] = useState(false);

  const loadBeneficiary = () => {
    setLoading(true);
    Promise.all([
      apiFetch(`/api/beneficiaries/${id}`),
      apiFetch('/api/beneficiaries'),
    ])
      .then(([b, list]) => {
        setBeneficiary(b);
        setForm(beneficiaryToForm(b));
        setAllBeneficiaries(list);
        setMergeSource(String(b.uid));
      })
      .catch((err) => setError(err.detail || 'Failed to load beneficiary'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadBeneficiary();
  }, [id]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (aliasInvalid) return;

    // 1. Check type switch from Merchant to Person
    if (
      beneficiary.beneficiary_type === 'merchant' &&
      form.beneficiary_type === 'person'
    ) {
      const proceed = window.confirm(
        'Changing this beneficiary from Merchant to Person will delete its merchant details. The categorization rule mapping will be preserved. Do you want to proceed?'
      );
      if (!proceed) return;
    }

    // 2. Check category change to a completely new tag
    if (form.beneficiary_type === 'merchant') {
      const originalCategory = beneficiary.merchant?.category || '';
      const newCategory = form.category || '';
      if (originalCategory !== newCategory && newCategory !== '') {
        try {
          const res = await apiFetch('/api/categorization-rules');
          const rule = (res.rules || []).find(
            (r) => r.beneficiary_id === beneficiary.uid
          );
          const isNewTag =
            !rule ||
            !rule.tag_ids ||
            !rule.tag_ids.includes(parseInt(newCategory, 10));
          if (isNewTag) {
            const proceed = window.confirm(
              'Changing the merchant category will automatically create or update the corresponding categorization rule. This will re-categorize all related statement transactions and update your budgets. Do you want to proceed?'
            );
            if (!proceed) return;
          }
        } catch (err) {
          console.error('Failed to verify categorization rule tags', err);
        }
      }
    }

    try {
      const updated = await apiFetch(`/api/beneficiaries/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(formToPayload(form)),
      });
      setBeneficiary(updated);
      setForm(beneficiaryToForm(updated));
      setEditing(false);
    } catch (err) {
      alert(err.detail || 'Update failed');
    }
  };

  const handleDelete = async () => {
    if (
      !window.confirm(
        `Delete beneficiary "${beneficiary?.name}"? This cannot be undone.`
      )
    )
      return;
    try {
      await apiFetch(`/api/beneficiaries/${id}`, { method: 'DELETE' });
      navigate('/beneficiaries');
    } catch (err) {
      alert(err.detail || 'Delete failed');
    }
  };

  const handleMerge = async () => {
    if (!mergeSource || !mergeTarget) return;
    if (mergeSource === mergeTarget) return;
    if (
      !window.confirm(
        'Merging will consolidate all aliases and update all transaction links. This cannot be undone. Proceed?'
      )
    )
      return;
    try {
      await apiFetch('/api/beneficiaries/merge', {
        method: 'POST',
        body: JSON.stringify({
          source_uid: parseInt(mergeSource, 10),
          target_uid: parseInt(mergeTarget, 10),
        }),
      });
      if (mergeSource === String(id)) {
        navigate(`/beneficiaries/${mergeTarget}`);
      } else {
        loadBeneficiary();
        setMergeTarget('');
      }
    } catch (err) {
      alert(err.detail || 'Merge failed');
    }
  };

  const handleSwap = () => {
    setMergeSource(mergeTarget);
    setMergeTarget(mergeSource);
  };

  const handleCancelEdit = () => {
    setForm(beneficiaryToForm(beneficiary));
    setEditing(false);
  };

  if (loading) {
    return (
      <div
        style={{
          maxWidth: '800px',
          margin: '2rem auto',
          padding: '1rem',
          color: '#94a3b8',
        }}
      >
        Loading...
      </div>
    );
  }

  if (error || !beneficiary || !form) {
    return (
      <div style={{ maxWidth: '800px', margin: '2rem auto', padding: '1rem' }}>
        <p style={{ color: '#ef4444' }}>{error || 'Beneficiary not found'}</p>
        <Link to="/beneficiaries">← Back to All Beneficiaries</Link>
      </div>
    );
  }

  return (
    <div
      style={{
        maxWidth: '800px',
        margin: '2rem auto',
        padding: '1rem',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '1.5rem',
          gap: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <Link
            to="/beneficiaries"
            style={{
              color: '#2563eb',
              textDecoration: 'none',
              fontSize: '0.9rem',
            }}
          >
            ← Back to All Beneficiaries
          </Link>
          <h1 style={{ margin: '0.5rem 0 0' }}>{beneficiary.name}</h1>
        </div>
        <ActionDropdown
          editing={editing}
          onEdit={() => setEditing(true)}
          onCancel={handleCancelEdit}
          onDelete={handleDelete}
        />
      </header>

      <form
        onSubmit={handleSave}
        style={{
          background: '#f8fafc',
          padding: '1.5rem',
          borderRadius: '12px',
        }}
      >
        <BeneficiaryFormFields
          form={form}
          setForm={setForm}
          readOnly={!editing}
          excludeUid={parseInt(id, 10)}
          onAliasValidityChange={setAliasInvalid}
        />
        {editing && (
          <button
            type="submit"
            disabled={aliasInvalid}
            style={{
              padding: '0.6rem 1.2rem',
              background: aliasInvalid ? '#94a3b8' : '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: aliasInvalid ? 'not-allowed' : 'pointer',
            }}
          >
            Save Changes
          </button>
        )}
      </form>

      {editing && (
        <MergeBeneficiariesForm
          beneficiaries={allBeneficiaries}
          mergeSource={mergeSource}
          mergeTarget={mergeTarget}
          onSourceChange={setMergeSource}
          onTargetChange={setMergeTarget}
          onSwap={handleSwap}
          onMerge={handleMerge}
        />
      )}
    </div>
  );
}
