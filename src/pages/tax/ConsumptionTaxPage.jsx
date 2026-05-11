import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../state/AuthContext.jsx';
import { apiFetch } from '../../utils/apiClient.js';


function toISODate(d) {
  const dd = new Date(d);
  const y = dd.getFullYear();
  const m = String(dd.getMonth() + 1).padStart(2, '0');
  const day = String(dd.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function weekStartSun(dateObj) {
  // JS: getDay() => Sun=0..Sat=6
  const day = dateObj.getDay();
  const diff = day; // subtract 0 for Sun, 1 for Mon... 6 for Sat
  const d = new Date(dateObj);
  d.setDate(d.getDate() - diff);
  return d;
}

function weekEndSat(dateObj) {
  const ws = weekStartSun(dateObj);
  const d = new Date(ws);
  d.setDate(d.getDate() + 6);
  return d;
}

export function ConsumptionTaxPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const [error, setError] = useState(null);

  const [bills, setBills] = useState([]);
  const [selectedBill, setSelectedBill] = useState(null);
  const [expandedBillId, setExpandedBillId] = useState(null);

  const [mode, setMode] = useState('week'); // 'week' | 'range'
  const [weekPickDate, setWeekPickDate] = useState('');
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');

  const precedingWeekStart = useMemo(() => {
    const now = new Date();
    const currentWeekStart = weekStartSun(now);
    const prev = new Date(currentWeekStart);
    prev.setDate(prev.getDate() - 7);
    return prev;
  }, []);

  const canGenerateForRange = (ps, pe) => {
    if (!ps || !pe) return { ok: false, reason: 'Choose period_start and period_end' };
    const endDate = new Date(pe);
    // allowed only if week_end < precedingWeekStart
    if (endDate >= precedingWeekStart) return { ok: false, reason: 'Can only generate for periods prior to the preceding week' };
    return { ok: true };
  };

  const loadBills = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/consumption-tax/bills');
      setBills(res.bills || []);
    } catch (err) {
      setError(err.detail || err.error || 'Failed to load bills');
    } finally {
      setLoading(false);
    }
  };

  const loadBillDetails = async (billId) => {
    setError(null);

    try {
      const res = await apiFetch(`/api/consumption-tax/bills/${billId}`);

      setSelectedBill(res);
    } catch (err) {
      setError(err.detail || err.error || 'Failed to load bill details');
    }
  };

  const handleToggleBillDetails = async (billId) => {
    if (expandedBillId === billId) {
      setExpandedBillId(null);
      return;
    }
    setExpandedBillId(billId);
    await loadBillDetails(billId);
  };

  useEffect(() => {
    loadBills();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGenerate = async () => {
    setError(null);
    try {
      let ps = '';
      let pe = '';

      if (mode === 'week') {
        if (!weekPickDate) {
          setError('Pick a week date first');
          return;
        }
        const d = new Date(weekPickDate);
        const ws = weekStartSun(d);
        const we = weekEndSat(d);
        ps = toISODate(ws);
        pe = toISODate(we);
      } else {
        ps = rangeStart;
        pe = rangeEnd;
      }

      const check = canGenerateForRange(ps, pe);
      if (!check.ok) {
        setError(check.reason);
        return;
      }

      await apiFetch('/api/consumption-tax/bills/generate', {
        method: 'POST',
        body: JSON.stringify({ period_start: ps, period_end: pe })
      });
      setSelectedBill(null);
      await loadBills();
    } catch (err) {
      setError(err.detail || err.error || 'Failed to generate bills');
    }
  };

  const handlePay = async (billId) => {
    setError(null);
    try {
      await apiFetch(`/api/consumption-tax/bills/${billId}/pay`, { method: 'POST' });
      await loadBills();
      setSelectedBill(null);
      setExpandedBillId(null);
    } catch (err) {
      setError(err.detail || err.error || 'Failed to pay bill');
    }
  };

  return (
    <div style={{ maxWidth: 1000, margin: '2rem auto', padding: '1.5rem', fontFamily: 'Inter, sans-serif' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0 }}>Consumption Tax</h1>
          <p style={{ color: '#64748b' }}>Generate and track your taxation insights</p>
        </div>
        <Link to="/dashboard" style={{ textDecoration: 'none', color: '#2563eb', fontWeight: 600, fontSize: '0.9rem' }}>
          ← Back to dashboard
        </Link>
      </header>

      {error && <div style={{ color: 'red', marginBottom: '0.75rem' }}>{error}</div>}
      {loading ? <div>Loading...</div> : null}

      <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: '1rem', marginBottom: '1.25rem' }}>
        <h3 style={{ marginTop: 0 }}>Generate Bills</h3>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.75rem' }}>
          <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input type="radio" checked={mode === 'week'} onChange={() => setMode('week')} />
            Week picker
          </label>
          <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input type="radio" checked={mode === 'range'} onChange={() => setMode('range')} />
            Date range
          </label>
          <div style={{ color: '#666', fontSize: '0.9rem' }}>
            Allowed only for weeks prior to the preceding week (ending before {toISODate(precedingWeekStart)}).
          </div>
        </div>

        {mode === 'week' ? (
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <label>
              Pick any date inside the week:
              <input
                type="date"
                value={weekPickDate}
                onChange={(e) => setWeekPickDate(e.target.value)}
                style={{ display: 'block', padding: '0.5rem', marginTop: 4 }}
              />
            </label>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <label>
              period_start
              <input
                type="date"
                value={rangeStart}
                onChange={(e) => setRangeStart(e.target.value)}
                style={{ display: 'block', padding: '0.5rem', marginTop: 4 }}
              />
            </label>
            <label>
              period_end
              <input
                type="date"
                value={rangeEnd}
                onChange={(e) => setRangeEnd(e.target.value)}
                style={{ display: 'block', padding: '0.5rem', marginTop: 4 }}
              />
            </label>
          </div>
        )}

        <div style={{ marginTop: '0.75rem' }}>
          <button type="button" onClick={handleGenerate} style={{ padding: '0.6rem 1rem' }} disabled={loading}>
            Generate / Refresh Bills
          </button>
        </div>
      </div>

      <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: '1rem', marginBottom: '1.25rem' }}>
        <h3 style={{ marginTop: 0 }}>Bills</h3>
        {bills.length === 0 ? (
          <div style={{ color: '#666' }}>No bills yet.</div>
        ) : (
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {bills.map((b) => (
              <div key={b.bill_id} style={{ border: '1px solid #eee', padding: '0.75rem', borderRadius: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>
                      {b.period_start} to {b.period_end}
                    </div>
                    <div style={{ color: '#666', fontSize: '0.9rem' }}>
                      Status: {b.status} • Amount: {user?.currency || '$'}
{Number(b.amount || 0).toFixed(2)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => handleToggleBillDetails(b.bill_id)}
                      style={{ padding: '0.4rem 0.75rem' }}
                    >
                      {expandedBillId === b.bill_id ? 'Hide' : 'View'}
                    </button>
                    {b.status === 'pending' ? (
                      <button
                        type="button"
                        onClick={() => handlePay(b.bill_id)}
                        style={{ padding: '0.4rem 0.75rem' }}
                      >
                        Pay
                      </button>
                    ) : null}
                  </div>
                </div>

                {expandedBillId === b.bill_id && selectedBill && selectedBill.bill_id === b.bill_id ? (
                  <div style={{ marginTop: '0.75rem', borderTop: '1px dashed rgba(203,213,225,0.9)', paddingTop: '0.75rem' }}>
                    <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                      <div><b>Tax total</b>: {user?.currency || '$'}
{Number(selectedBill.totals?.tax_total || 0).toFixed(2)}</div>
                      <div><b>Penalty total</b>: {user?.currency || '$'}
{Number(selectedBill.totals?.penalty_total || 0).toFixed(2)}</div>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid #eee' }}>
                            <th style={{ textAlign: 'left', padding: '0.5rem' }}>Date</th>
                            <th style={{ textAlign: 'left', padding: '0.5rem' }}>Beneficiary</th>
                            <th style={{ textAlign: 'left', padding: '0.5rem' }}>Txn Type</th>
                            <th style={{ textAlign: 'left', padding: '0.5rem' }}>Tax</th>
                            <th style={{ textAlign: 'left', padding: '0.5rem' }}>Penalty</th>
                            <th style={{ textAlign: 'left', padding: '0.5rem' }}>Penalty Tag</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedBill.items && selectedBill.items.length > 0 ? (
                            selectedBill.items.map((it) => (
                              <tr key={it.txn_id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                <td style={{ padding: '0.5rem' }}>{it.date}</td>
                                <td style={{ padding: '0.5rem' }}>{it.beneficiary || '—'}</td>
                                <td style={{ padding: '0.5rem' }}>{it.txn_type}</td>
                                <td style={{ padding: '0.5rem' }}>{user?.currency || '$'}
{Number(it.tax_amount || 0).toFixed(2)}</td>
                                <td style={{ padding: '0.5rem' }}>{user?.currency || '$'}
{Number(it.penalty || 0).toFixed(2)}</td>
                                <td style={{ padding: '0.5rem', color: '#666' }}>
                                  {it.penalty_tag_name || (it.penalty_tag_id ? `#${it.penalty_tag_id}` : '—')}
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={6} style={{ padding: '0.75rem', color: '#666' }}>
                                No tax items on this bill.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

