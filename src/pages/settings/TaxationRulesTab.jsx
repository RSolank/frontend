import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../utils/apiClient.js';

const TXN_TYPES = ['charged', 'essential', 'discretionary', 'exempted'];

export function TaxationRulesTab() {
  const [rules, setRules] = useState({});
  const [budgetTags, setBudgetTags] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [taxRateDraft, setTaxRateDraft] = useState({});
  const [penaltyDraft, setPenaltyDraft] = useState({}); // {txn_type: {tag_id: value}}

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [rulesRes, budgetsRes] = await Promise.all([
        apiFetch('/api/taxation-rules'),
        apiFetch('/api/budget-limits?period=monthly')
      ]);

      const map = {};
      for (const r of rulesRes.rules || []) {
        map[r.txn_type] = r;
      }
      setRules(map);

      // Only show tags that can produce penalties (require budget_limits).
      const tags = (budgetsRes.budgets || []).filter((b) => b.tag_id !== 48);
      setBudgetTags(tags);

      const trDraft = {};
      const pDraft = {};
      for (const t of TXN_TYPES) {
        const rr = map[t] || {};
        trDraft[t] = rr.tax_rate !== undefined ? String(rr.tax_rate) : '0';
        pDraft[t] = {};
        for (const bt of tags) {
          const tagId = bt.tag_id;
          const defaultPenalty = rr.default_penalty_rate !== undefined ? rr.default_penalty_rate : 0.05;
          const explicit = rr.penalty_rates && rr.penalty_rates[tagId] !== undefined ? rr.penalty_rates[tagId] : defaultPenalty;
          pDraft[t][tagId] = String(explicit);
        }
      }

      setTaxRateDraft(trDraft);
      setPenaltyDraft(pDraft);
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
    const rule = rules[txn_type] || {};
    const defaultPenaltyRate = rule.default_penalty_rate !== undefined ? Number(rule.default_penalty_rate) : 0.05;

    const tax = Number(taxRateDraft[txn_type]);
    if (Number.isNaN(tax) || tax < 0) {
      setError('tax_rate must be a non-negative number');
      return;
    }

    const penalty_rates = {};
    for (const bt of budgetTags) {
      const tagId = bt.tag_id;
      const v = Number(penaltyDraft?.[txn_type]?.[tagId]);
      if (Number.isNaN(v) || v < 0) {
        setError('penalty_rate must be a non-negative number');
        return;
      }
      penalty_rates[tagId] = v;
    }

    try {
      setError(null);
      await apiFetch(`/api/taxation-rules/${txn_type}`, {
        method: 'PUT',
        body: JSON.stringify({
          txn_type,
          tax_rate: tax,
          default_penalty_rate: defaultPenaltyRate,
          penalty_rates
        })
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
        Tax rates are per transaction-type. Penalties are computed per breached tag budget; penalty-rate is chosen as the highest applicable rate among breached tags.
      </p>

      {error && <div style={{ color: 'red', marginBottom: '0.75rem' }}>{error}</div>}
      {loading ? <div>Loading...</div> : null}

      <div style={{ display: 'grid', gap: '1rem' }}>
        {TXN_TYPES.map((t) => {
          const rule = rules[t] || {};
          return (
            <div key={t} style={{ border: '1px solid #ddd', borderRadius: 8, padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontWeight: 700, textTransform: 'capitalize' }}>{t} rule</div>
                  <div style={{ color: '#666', fontSize: '0.9rem' }}>
                    Default penalty rate: {rule.default_penalty_rate ?? 0.05}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <label style={{ color: '#666', fontSize: '0.9rem' }}>tax_rate</label>
                  <input
                    value={taxRateDraft[t] ?? '0'}
                    onChange={(e) => setTaxRateDraft((prev) => ({ ...prev, [t]: e.target.value }))}
                    style={{ padding: '0.5rem', width: 120 }}
                  />
                  <button type="button" onClick={() => handleSave(t)} style={{ padding: '0.5rem 1rem' }}>
                    Save
                  </button>
                </div>
              </div>

              <div style={{ marginTop: '1rem', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #eee' }}>
                      <th style={{ textAlign: 'left', padding: '0.5rem' }}>Tag</th>
                      <th style={{ textAlign: 'left', padding: '0.5rem' }}>penalty_rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {budgetTags.map((bt) => (
                      <tr key={bt.tag_id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '0.5rem' }}>{bt.tag_name || bt.tag_id}</td>
                        <td style={{ padding: '0.5rem' }}>
                          <input
                            value={penaltyDraft?.[t]?.[bt.tag_id] ?? '0'}
                            onChange={(e) => {
                              const v = e.target.value;
                              setPenaltyDraft((prev) => ({
                                ...prev,
                                [t]: {
                                  ...(prev[t] || {}),
                                  [bt.tag_id]: v
                                }
                              }));
                            }}
                            style={{ padding: '0.5rem', width: 140 }}
                          />
                        </td>
                      </tr>
                    ))}
                    {budgetTags.length === 0 ? (
                      <tr>
                        <td colSpan={2} style={{ padding: '0.75rem', color: '#666' }}>
                          No budgets found yet. Add budgets in the Budgets tab first.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

