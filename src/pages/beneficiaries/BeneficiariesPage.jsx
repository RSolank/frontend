import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../../utils/apiClient.js';
import {
  BeneficiaryFormFields,
  emptyBeneficiaryForm,
  formToPayload,
} from './BeneficiaryFormFields.jsx';
import { formatAliasesDisplay } from './aliasUtils.js';

export function BeneficiariesPage() {
  const [beneficiaries, setBeneficiaries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newForm, setNewForm] = useState(emptyBeneficiaryForm('merchant'));
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [aliasInvalid, setAliasInvalid] = useState(false);

  const loadData = () => {
    setLoading(true);
    apiFetch('/api/beneficiaries')
      .then(setBeneficiaries)
      .catch((err) => setError(err.detail || 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return beneficiaries.filter((b) => {
      if (typeFilter !== 'all' && b.beneficiary_type !== typeFilter) return false;
      if (!q) return true;
      const inName = b.name?.toLowerCase().includes(q);
      const inAliases = (b.aliases || []).some((a) => a.toLowerCase().includes(q));
      return inName || inAliases;
    });
  }, [beneficiaries, search, typeFilter]);

  const handleAddNew = () => {
    setNewForm(emptyBeneficiaryForm('merchant'));
    setShowAdd(true);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (aliasInvalid) return;

    if (newForm.beneficiary_type === 'merchant' && newForm.category) {
      const proceed = window.confirm(
        "Assigning a category to this new merchant will automatically create a categorization rule for it. This will automatically categorize any matching statement transactions in the future. Do you want to proceed?"
      );
      if (!proceed) return;
    }

    try {
      await apiFetch('/api/beneficiaries', {
        method: 'POST',
        body: JSON.stringify(formToPayload(newForm)),
      });
      setShowAdd(false);
      setNewForm(emptyBeneficiaryForm('merchant'));
      loadData();
    } catch (err) {
      alert(err.detail || 'Failed to create');
    }
  };

  return (
    <div style={{ maxWidth: '900px', margin: '2rem auto', padding: '1rem', fontFamily: 'Inter, sans-serif' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ margin: 0 }}>Beneficiaries</h1>
          <Link to="/dashboard" style={{ color: '#2563eb', textDecoration: 'none', fontSize: '0.9rem' }}>
            ← Back to Dashboard
          </Link>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {showAdd && (
            <button
              type="button"
              onClick={() => { setShowAdd(false); setNewForm(emptyBeneficiaryForm('merchant')); }}
              style={{ padding: '0.6rem 1rem', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
              >
              Cancel
            </button>
          )}
          {!showAdd && (
            <button
              type="button"
              onClick={handleAddNew}
              style={{
                padding: '0.6rem 1rem',
                background: '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 700,
              }}
            >
              + Add New
            </button>
          )}
        </div>
      </header>

      {showAdd && (
        <form onSubmit={handleCreate} style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '12px', marginBottom: '2rem' }}>
          <BeneficiaryFormFields
            form={newForm}
            setForm={setNewForm}
            onAliasValidityChange={setAliasInvalid}
          />
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
            Create
          </button>
        </form>
      )}

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <input
          type="search"
          placeholder="Search by name or alias..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: '200px', padding: '0.6rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          style={{ padding: '0.6rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white' }}
        >
          <option value="all">All types</option>
          <option value="merchant">Merchant</option>
          <option value="person">Person</option>
        </select>
      </div>

      <div style={{ background: 'white', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: '#f8fafc' }}>
            <tr style={{ textAlign: 'left' }}>
              <th style={{ padding: '1rem' }}>Name</th>
              <th style={{ padding: '1rem' }} />
              <th style={{ padding: '1rem' }}>Type</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={3} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={3} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>No beneficiaries found.</td></tr>
            ) : (
              filtered.map((b) => (
                <tr key={b.uid} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '1rem', fontWeight: 600 }}>
                    <Link to={`/beneficiaries/${b.uid}`} style={{ color: '#2563eb', textDecoration: 'none' }}>
                      {b.name}
                    </Link>
                  </td>
                  <td style={{ padding: '1rem', color: '#94a3b8', fontSize: '0.85rem' }}>
                    {formatAliasesDisplay(b.aliases)}
                  </td>
                  <td style={{ padding: '1rem', textTransform: 'capitalize' }}>{b.beneficiary_type || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {error && <div style={{ color: '#ef4444', marginTop: '1rem' }}>{error}</div>}
    </div>
  );
}
