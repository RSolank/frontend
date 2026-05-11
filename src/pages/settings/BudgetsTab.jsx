import React, { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../utils/apiClient.js';

function flattenTags(nodes, out = []) {
  for (const n of nodes || []) {
    out.push({ tag_id: n.tag_id, name: n.name });
    flattenTags(n.children, out);
  }
  return out;
}

export function BudgetsTab() {
  const [tags, setTags] = useState([]);
  const [budgetsByTagId, setBudgetsByTagId] = useState({});
  const [totalBudgetLimit, setTotalBudgetLimit] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const allTags = useMemo(() => tags || [], [tags]);

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [tagRes, budgetsRes] = await Promise.all([
        apiFetch('/api/tags'),
        apiFetch('/api/budget-limits?period=monthly')
      ]);

      const flat = flattenTags(tagRes.tags || []);
      setTags(flat);

      const map = {};
      for (const b of budgetsRes.budgets || []) {
        map[b.tag_id] = b.limit;
      }
      setBudgetsByTagId(map);
      setTotalBudgetLimit(
        map[48] !== undefined ? String(map[48]) : ''
      );
    } catch (err) {
      setError(err.detail || err.error || 'Failed to load budgets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSaveBudget = async (tagId, limitStr) => {
    const nextErr = limitStr === '' ? 'Limit is required' : null;
    if (nextErr) {
      setError(nextErr);
      return;
    }
    const limit = Number(limitStr);
    if (Number.isNaN(limit) || limit < 0) {
      setError('Limit must be a non-negative number');
      return;
    }

    try {
      setError(null);
      await apiFetch('/api/budget-limits', {
        method: 'POST',
        body: JSON.stringify({ tag_id: tagId, period: 'monthly', limit })
      });
      await loadAll();
    } catch (err) {
      setError(err.detail || err.error || 'Failed to save budget');
    }
  };

  return (
    <div>
      <h2 style={{ marginBottom: '1rem' }}>Budgets</h2>
      <p style={{ color: '#666', marginBottom: '1rem' }}>
        Set monthly spend limits per category. Budgets are used later to compute consumption-tax penalties.
      </p>

      {error && <div style={{ color: 'red', marginBottom: '0.75rem' }}>{error}</div>}
      {loading ? <div>Loading...</div> : null}

      <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: '1rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontWeight: 650, marginBottom: 4 }}>Total Monthly Budget</div>
            <div style={{ color: '#666', fontSize: '0.9rem' }}>
              Stored for system use (tag_id=48).
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input
              value={totalBudgetLimit}
              onChange={(e) => setTotalBudgetLimit(e.target.value)}
              placeholder="0"
              style={{ padding: '0.5rem', width: 160 }}
            />
            <button
              type="button"
              onClick={() => handleSaveBudget(48, totalBudgetLimit)}
              style={{ padding: '0.5rem 1rem' }}
            >
              Save
            </button>
          </div>
        </div>
      </div>

      <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: '1rem' }}>
        <h3 style={{ marginTop: 0, marginBottom: '0.75rem' }}>Category Monthly Limits</h3>
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {allTags.map((t) => {
            const value = budgetsByTagId[t.tag_id] !== undefined ? String(budgetsByTagId[t.tag_id]) : '';
            return (
              <div key={t.tag_id} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ minWidth: 220, fontWeight: 600 }}>{t.name}</div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input
                    value={value}
                    onChange={(e) => {
                      const next = e.target.value;
                      if (next === '') {
                        setBudgetsByTagId((prev) => ({ ...prev, [t.tag_id]: '' }));
                        return;
                      }
                      const num = Number(next);
                      setBudgetsByTagId((prev) => ({ ...prev, [t.tag_id]: Number.isNaN(num) ? '' : num }));
                    }}
                    placeholder="Set limit"
                    style={{ padding: '0.5rem', width: 200 }}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      handleSaveBudget(
                        t.tag_id,
                        budgetsByTagId[t.tag_id] === '' || budgetsByTagId[t.tag_id] === null
                          ? ''
                          : String(budgetsByTagId[t.tag_id])
                      )
                    }
                    style={{ padding: '0.5rem 1rem' }}
                  >
                    Save
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

