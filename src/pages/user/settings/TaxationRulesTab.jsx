import React, { useEffect, useState } from 'react';

import { useAuth } from '../../../state/AuthContext.jsx';
import { apiFetch } from '../../../utils/apiClient.js';

export function TaxationRulesTab() {
  const { constants } = useAuth();
  const TXN_TYPES = constants?.TAXABLE_TXN_TYPES || [
    'committed',
    'essential',
    'discretionary',
    'uncategorized',
  ];
  const [rules, setRules] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [taxRateDraft, setTaxRateDraft] = useState({});
  const [defaultPenaltyDraft, setDefaultPenaltyDraft] = useState({});

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const rulesRes = await apiFetch('/api/taxation-rules');

      const map = {};
      for (const r of rulesRes.rules || []) {
        map[r.txn_type] = r;
      }
      setRules(map);

      const trDraft = {};
      const defPDraft = {};
      for (const t of TXN_TYPES) {
        const rr = map[t] || {};
        trDraft[t] = rr.tax_rate !== undefined ? String(rr.tax_rate) : '0';
        defPDraft[t] =
          rr.default_penalty_rate !== undefined
            ? String(rr.default_penalty_rate)
            : '0.5';
      }

      setTaxRateDraft(trDraft);
      setDefaultPenaltyDraft(defPDraft);
    } catch (err) {
      setError(err.detail || err.error || 'Failed to load taxation rules');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async (txn_type) => {
    const tax = Number(taxRateDraft[txn_type]);
    if (Number.isNaN(tax) || tax < 0) {
      setError('tax_rate must be a non-negative number');
      return;
    }

    const defPenalty = Number(defaultPenaltyDraft[txn_type]);
    if (Number.isNaN(defPenalty) || defPenalty < 0) {
      setError('default_penalty_rate must be a non-negative number');
      return;
    }

    try {
      setError(null);
      await apiFetch(`/api/taxation-rules/${txn_type}`, {
        method: 'PUT',
        body: JSON.stringify({
          // txn_type,
          tax_rate: tax,
          default_penalty_rate: defPenalty,
        }),
      });
      await loadAll();
    } catch (err) {
      setError(err.detail || err.error || 'Failed to save taxation rule');
    }
  };

  return (
    <div>
      <h2 style={{ marginBottom: '1rem' }}>Taxation Rules</h2>
      <p style={{ color: '#666', marginBottom: '1rem' }}>
        Configure the base tax rate and the default penalty rate for each
        transaction type. Individual budgets can override this default penalty
        rate in the Budgets tab. Note: Exempted transactions are hardcoded to
        skip taxation entirely.
      </p>

      {error && (
        <div style={{ color: 'red', marginBottom: '0.75rem' }}>{error}</div>
      )}
      {loading ? <div>Loading...</div> : null}

      <div style={{ display: 'grid', gap: '1rem' }}>
        {TXN_TYPES.map((t) => {
          return (
            <div
              key={t}
              style={{
                border: '1px solid #ddd',
                borderRadius: 8,
                padding: '1rem',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, textTransform: 'capitalize' }}>
                    {t} rule
                  </div>
                </div>
                <div
                  style={{
                    display: 'flex',
                    gap: '1rem',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      gap: '0.5rem',
                      alignItems: 'center',
                    }}
                  >
                    <label style={{ color: '#666', fontSize: '0.9rem' }}>
                      Tax Rate:
                    </label>
                    <input
                      value={taxRateDraft[t] ?? '0'}
                      onChange={(e) =>
                        setTaxRateDraft((prev) => ({
                          ...prev,
                          [t]: e.target.value,
                        }))
                      }
                      style={{ padding: '0.5rem', width: 80 }}
                    />
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      gap: '0.5rem',
                      alignItems: 'center',
                    }}
                  >
                    <label style={{ color: '#666', fontSize: '0.9rem' }}>
                      Default Penalty:
                    </label>
                    <input
                      value={defaultPenaltyDraft[t] ?? '0.05'}
                      onChange={(e) =>
                        setDefaultPenaltyDraft((prev) => ({
                          ...prev,
                          [t]: e.target.value,
                        }))
                      }
                      style={{ padding: '0.5rem', width: 80 }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSave(t)}
                    style={{ padding: '0.5rem 1rem' }}
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
