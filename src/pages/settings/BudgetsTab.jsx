import React, { useEffect, useState } from 'react';
import { useAuth } from '../../state/AuthContext.jsx';
import { apiFetch } from '../../utils/apiClient.js';

/**
 * BudgetsTab component.
 * Displays real-time expense data from expense_tracker and allows setting monthly limits.
 */
export function BudgetsTab() {
  const { user } = useAuth();
  const [categories, setCategories] = useState([]);
  const [totalBudget, setTotalBudget] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedTagId, setExpandedTagId] = useState(null);
  const [displayMonth, setDisplayMonth] = useState('');
  const [availableMonths, setAvailableMonths] = useState([]);
  
  // Local state for editing values before saving
  const [editLimit, setEditLimit] = useState('');
  const [editPenalty, setEditPenalty] = useState('');

  const currencySymbol = user?.currency || '$';

  const loadStatus = async (monthOverride = null) => {
    setLoading(true);
    setError(null);
    try {
      const url = monthOverride ? `/api/budget-limits/status?month=${monthOverride}` : '/api/budget-limits/status';
      const res = await apiFetch(url);
      
      // Filter out categories with zero expense for the selected month
      const activeCategories = (res.categories || []).filter(cat => (cat.current_expense || 0) > 0);
      setCategories(activeCategories);
      setTotalBudget(res.total_budget || null);
      setDisplayMonth(res.month || '');
      setAvailableMonths(res.available_months || []);
    } catch (err) {
      setError(err.detail || err.error || 'Failed to load budget status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMonthChange = (e) => {
    const val = e.target.value;
    loadStatus(val);
  };

  const formatMonthLabel = (ym) => {
    if (!ym) return '';
    const [year, month] = ym.split('-');
    const date = new Date(year, parseInt(month) - 1);
    return date.toLocaleString('default', { month: 'long', year: 'numeric' });
  };

  const handleStartEdit = (cat) => {
    setExpandedTagId(cat.tag_id);
    setEditLimit(cat.limit_amt !== null ? cat.limit_amt : ((cat.avg_expense || 0) * 1.2).toFixed(2));
    setEditPenalty((cat.penalty_rate || cat.default_penalty_rate || 0.05).toString());
  };

  const handleSave = async (tagId) => {
    const limit = parseFloat(editLimit);
    const penalty = parseFloat(editPenalty);
    
    if (isNaN(limit) || limit < 0) {
      setError('Limit must be a non-negative number');
      return;
    }
    if (isNaN(penalty) || penalty < 0) {
      setError('Penalty rate must be a non-negative number');
      return;
    }

    try {
      setError(null);
      await apiFetch('/api/budget-limits', {
        method: 'POST',
        body: JSON.stringify({ 
          tag_id: tagId, 
          budget_period: 'monthly', 
          limit_amt: limit,
          penalty_rate: penalty
        })
      });
      setExpandedTagId(null);
      await loadStatus(displayMonth);
    } catch (err) {
      setError(err.detail || err.error || 'Failed to save budget');
    }
  };

  const renderProgressBar = (current, limit) => {
    if (!limit || limit <= 0) return null;
    const percent = Math.min((current / limit) * 100, 100);
    const isOver = current > limit;
    
    return (
      <div style={{ width: '100%', height: 8, background: '#eee', borderRadius: 4, overflow: 'hidden', marginTop: 8 }}>
        <div style={{ 
          width: `${percent}%`, 
          height: '100%', 
          background: isOver ? 'linear-gradient(90deg, #ff4d4d, #ff0000)' : 'linear-gradient(90deg, #4d94ff, #0066ff)',
          transition: 'width 0.5s ease-out'
        }} />
      </div>
    );
  };

  return (
    <div style={{ maxWidth: 900 }}>
      {/* Header section with Dropdown */}
      <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0, color: '#333' }}>Budget Planning</h2>
          <p style={{ color: '#666', marginTop: '0.25rem', marginBottom: 0 }}>
            Monitor spending and configure monthly limits.
          </p>
        </div>
        
        {availableMonths.length > 0 ? (
          <div style={{ position: 'relative' }}>
            <select
              value={displayMonth}
              onChange={handleMonthChange}
              style={{
                appearance: 'none',
                padding: '0.6rem 2.5rem 0.6rem 1rem',
                fontSize: '1rem',
                fontWeight: 600,
                color: '#1d4ed8',
                backgroundColor: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: 12,
                cursor: 'pointer',
                outline: 'none',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                transition: 'all 0.2s'
              }}
            >
              {availableMonths.map(m => (
                <option key={m} value={m}>
                  {formatMonthLabel(m)}
                </option>
              ))}
            </select>
            {/* Custom arrow icon placeholder */}
            <div style={{ pointerEvents: 'none', position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#1d4ed8' }}>
              ▼
            </div>
          </div>
        ) : displayMonth ? (
          <div style={{ padding: '0.6rem 1rem', fontSize: '1rem', fontWeight: 600, color: '#1d4ed8', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12 }}>
            {formatMonthLabel(displayMonth)}
          </div>
        ) : null}
      </div>

      {error && (
        <div style={{ background: '#fff5f5', border: '1px solid #feb2b2', color: '#c53030', padding: '1rem', borderRadius: 8, marginBottom: '1.5rem' }}>
          {error}
        </div>
      )}

      {loading && <div style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>Refreshing budget status...</div>}

      {/* Global Total Section */}
      <div style={{ background: 'linear-gradient(135deg, #f0f7ff 0%, #e0efff 100%)', padding: '1.5rem', borderRadius: 12, marginBottom: '2rem', border: '1px solid #b3d7ff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#004a99' }}>Total Monthly Budget</h3>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#4d88ff' }}>Overall soft-limit for the month</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.75rem', color: '#4d88ff', textTransform: 'uppercase' }}>Total Spent</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0052cc' }}>
              {currencySymbol}{(totalBudget?.current_expense || 0).toLocaleString()}
              {totalBudget?.limit_amt ? <span style={{ fontSize: '0.9rem', color: '#a0aec0', fontWeight: 400, marginLeft: 4 }}>/ {currencySymbol}{totalBudget.limit_amt.toLocaleString()}</span> : null}
            </div>
          </div>
        </div>
        
        {totalBudget && (
          <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div style={{ flex: 1, marginRight: '2rem' }}>
              {renderProgressBar(totalBudget.current_expense || 0, totalBudget.limit_amt)}
            </div>
            <div style={{ display: 'flex', gap: '1rem', textAlign: 'right' }}>
              <div>
                <div style={{ fontSize: '0.65rem', color: '#4d88ff' }}>AVG</div>
                <div style={{ fontWeight: 600, color: '#004a99' }}>{currencySymbol}{(totalBudget?.avg_expense || 0).toFixed(0)}</div>
              </div>
              <button 
                onClick={() => handleStartEdit({ ...totalBudget, tag_id: 1, tag_name: 'Total Budget', tag_type: 'total' })}
                style={{ padding: '0.4rem 0.8rem', background: '#fff', border: '1px solid #b3d7ff', borderRadius: 6, cursor: 'pointer', fontSize: '0.8rem', color: '#0052cc' }}
              >
                Configure
              </button>
            </div>
          </div>
        )}
      </div>

      {expandedTagId === 1 && (
        <div style={{ marginTop: '-1.5rem', marginBottom: '2rem', padding: '1.5rem', background: '#f0f7ff', borderRadius: 12, border: '1px solid #b3d7ff' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <label style={{ fontWeight: 600, color: '#004a99' }}>Global Monthly Limit</label>
              <span style={{ color: '#0066ff', fontWeight: 700 }}>{currencySymbol}{Number(editLimit).toLocaleString()}</span>
            </div>
            <input 
              type="range"
              min={0}
              max={Math.max((totalBudget?.max_expense || 0) * 1.5, 5000)}
              step={100}
              value={editLimit}
              onChange={(e) => setEditLimit(e.target.value)}
              style={{ width: '100%', cursor: 'pointer' }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button 
              onClick={() => setExpandedTagId(null)}
              style={{ padding: '0.5rem 1rem', background: '#fff', border: '1px solid #b3d7ff', borderRadius: 8, cursor: 'pointer', color: '#0052cc' }}
            >
              Cancel
            </button>
            <button 
              onClick={() => handleSave(1)}
              style={{ padding: '0.5rem 1.5rem', background: '#0066ff', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
            >
              Save Global Total
            </button>
          </div>
        </div>
      )}

      {categories.length === 0 && !loading && (
        <div style={{ textAlign: 'center', padding: '3rem', background: '#f9fafb', borderRadius: 12, color: '#666' }}>
          No categorized spending found for {formatMonthLabel(displayMonth)}.
        </div>
      )}

      <div style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', display: 'grid', gap: '1rem' }}>
        {categories.map((cat) => {
          const isExpanded = expandedTagId === cat.tag_id;
          const statusColor = cat.limit_amt && cat.current_expense > cat.limit_amt ? '#e53e3e' : '#2d3748';
          
          return (
            <div key={cat.tag_id} style={{ border: '1px solid #edf2f7', borderRadius: 12, padding: '1.25rem', background: '#fff', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>{cat.tag_name}</span>
                    <span style={{ fontSize: '0.75rem', background: '#f7fafc', padding: '2px 8px', borderRadius: 4, color: '#a0aec0', textTransform: 'uppercase' }}>{cat.tag_type}</span>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '1.5rem', marginTop: '1rem' }}>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: '#a0aec0', textTransform: 'uppercase', letterSpacing: 0.5 }}>Spent This Month</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: statusColor }}>
                        {currencySymbol}{(cat.current_expense || 0).toLocaleString()}
                        {cat.limit_amt ? <span style={{ fontSize: '0.9rem', color: '#cbd5e0', fontWeight: 400, marginLeft: 4 }}>/ {currencySymbol}{cat.limit_amt.toLocaleString()}</span> : null}
                      </div>
                    </div>
                    
                    <div style={{ flex: 1, display: 'flex', gap: '1rem', justifyContent: 'flex-end', textAlign: 'right' }}>
                      <div>
                        <div style={{ fontSize: '0.65rem', color: '#a0aec0' }}>AVG</div>
                        <div style={{ fontWeight: 600 }}>{currencySymbol}{(cat.avg_expense || 0).toFixed(0)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.65rem', color: '#a0aec0' }}>MIN/MAX</div>
                        <div style={{ fontWeight: 600 }}>{currencySymbol}{(cat.min_expense || 0).toFixed(0)} - {currencySymbol}{(cat.max_expense || 0).toFixed(0)}</div>
                      </div>
                    </div>
                  </div>

                  {renderProgressBar(cat.current_expense || 0, cat.limit_amt)}
                </div>

                {!isExpanded && (
                  <button 
                    onClick={() => handleStartEdit(cat)}
                    style={{ marginLeft: '1.5rem', padding: '0.5rem 1rem', background: '#f7fafc', border: '1px solid #e2e8f0', borderRadius: 8, cursor: 'pointer', fontSize: '0.85rem' }}
                  >
                    {cat.limit_amt ? 'Edit Budget' : 'Set Budget'}
                  </button>
                )}
              </div>

              {isExpanded && (
                <div style={{ marginTop: '1.5rem', padding: '1.5rem', background: '#f8fafc', borderRadius: 12, border: '1px dotted #cbd5e0' }}>
                  <div style={{ marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <label style={{ fontWeight: 600 }}>Monthly Limit</label>
                      <span style={{ color: '#0066ff', fontWeight: 700 }}>{currencySymbol}{Number(editLimit).toLocaleString()}</span>
                    </div>
                    <input 
                      type="range"
                      min={Math.min(cat.min_expense || 0, 0)}
                      max={Math.max((cat.max_expense || 0) * 1.5, 1000)}
                      step={10}
                      value={editLimit}
                      onChange={(e) => setEditLimit(e.target.value)}
                      style={{ width: '100%', cursor: 'pointer' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#a0aec0' }}>
                      <span>Min: {currencySymbol}{(cat.min_expense || 0).toFixed(0)}</span>
                      <span>Avg: {currencySymbol}{(cat.avg_expense || 0).toFixed(0)}</span>
                      <span>Max: {currencySymbol}{(cat.max_expense || 0).toFixed(0)}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem' }}>Penalty Rate (as decimal)</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <input 
                          type="number"
                          step={0.05}
                          value={editPenalty}
                          onChange={(e) => setEditPenalty(e.target.value)}
                          style={{ padding: '0.5rem', borderRadius: 8, border: '1px solid #cbd5e0', width: 100 }}
                        />
                        <span style={{ fontSize: '0.85rem', color: '#666' }}>
                          (~ {((parseFloat(editPenalty) || 0) * 100).toFixed(0)}% surcharge on tax)
                        </span>
                      </div>
                      <p style={{ fontSize: '0.75rem', color: '#a0aec0', marginTop: '0.5rem' }}>
                        Default for {cat.tag_type} is {((cat.default_penalty_rate || 0.05) * 100).toFixed(0)}%.
                      </p>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button 
                        onClick={() => setExpandedTagId(null)}
                        style={{ padding: '0.5rem 1rem', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, cursor: 'pointer' }}
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={() => handleSave(cat.tag_id)}
                        style={{ padding: '0.5rem 1.5rem', background: '#0066ff', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
                      >
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
