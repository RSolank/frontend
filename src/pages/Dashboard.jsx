import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../state/AuthContext.jsx';
import { apiFetch } from '../utils/apiClient.js';

export function DashboardPage() {
  const { user, logout } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [tagMap, setTagMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const PAGE_SIZE = 25;
  const [page, setPage] = useState(0);
  const [yearFilter, setYearFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState(''); // YYYY-MM
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    apiFetch('/api/tags')
      .then((d) => {
        const map = {};
        const flatten = (nodes) => {
          for (const n of nodes || []) {
            map[n.tag_id] = n.tag_name;
            if (n.children) flatten(n.children);
          }
        };
        flatten(d.tags || []);
        setTagMap(map);
      })
      .catch(() => setTagMap({}));
  }, []);

  const miscName = tagMap[2] || 'Miscellaneous';
  const showLoading = loading || !user;

  const years = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    // Past 6 years + current
    return Array.from({ length: 7 }, (_, i) => String(y - i));
  }, []);

  const months = useMemo(() => {
    return [
      { v: '01', l: 'Jan' },
      { v: '02', l: 'Feb' },
      { v: '03', l: 'Mar' },
      { v: '04', l: 'Apr' },
      { v: '05', l: 'May' },
      { v: '06', l: 'Jun' },
      { v: '07', l: 'Jul' },
      { v: '08', l: 'Aug' },
      { v: '09', l: 'Sep' },
      { v: '10', l: 'Oct' },
      { v: '11', l: 'Nov' },
      { v: '12', l: 'Dec' }
    ];
  }, []);

  const fetchTransactions = async (opts = {}) => {
    const offset = opts.offset ?? page * PAGE_SIZE;
    const params = new URLSearchParams();
    params.set('limit', String(PAGE_SIZE));
    params.set('offset', String(offset));

    if (monthFilter) params.set('month', monthFilter);
    if (!monthFilter && yearFilter) params.set('year', yearFilter);

    const d = await apiFetch(`/api/transactions?${params.toString()}`);
    return d.transactions || [];
  };

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    fetchTransactions()
      .then((txns) => {
        setTransactions(txns);
        setHasMore(txns.length === PAGE_SIZE);
      })
      .catch((err) => {
        setError(err.detail || err.error || 'Failed to load transactions');
        setTransactions([]);
        setHasMore(false);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, yearFilter, monthFilter, page]);

  const handleDelete = async (txn) => {
    if (txn.source !== 'manual') return;
    if (!window.confirm('Delete this transaction? This cannot be undone.')) return;
    try {
      await apiFetch(`/api/transactions/${txn.txn_id}`, {
        method: 'DELETE'
      });
      setTransactions((prev) => prev.filter((t) => t.txn_id !== txn.txn_id));
    } catch (err) {
      setError(err.detail || err.error || 'Failed to delete transaction');
    }
  };

  return (
    <div style={{ maxWidth: 900, margin: '2rem auto', padding: '1.5rem' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h1>Dashboard</h1>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <Link to="/settings?tab=profile" style={{ padding: '0.5rem 1rem' }}>Settings</Link>
          <button onClick={logout}>Logout</button>
        </div>
      </header>
      <p style={{ marginTop: '1rem' }}>
        Welcome, {user?.first_name || 'user'} {user?.last_name || ''}!
      </p>
      <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem' }}>
        <Link to="/upload-statement" style={{ padding: '0.75rem 1rem', display: 'inline-block', border: '1px solid #ccc', borderRadius: 4, textDecoration: 'none', color: 'inherit' }}>
          Upload statement
        </Link>
        <Link to="/add-transaction" style={{ padding: '0.75rem 1rem', display: 'inline-block', border: '1px solid #ccc', borderRadius: 4, textDecoration: 'none', color: 'inherit' }}>
          Add transaction
        </Link>
      </div>
      <h2 style={{ marginTop: '2rem' }}>Recent transactions</h2>

      <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.9rem', color: '#666', marginBottom: 4 }}>Year</label>
          <select
            value={yearFilter}
            onChange={(e) => {
              setYearFilter(e.target.value);
              setMonthFilter('');
              setPage(0);
            }}
            style={{ padding: '0.5rem' }}
          >
            <option value="">All years</option>
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.9rem', color: '#666', marginBottom: 4 }}>Month</label>
          <select
            value={monthFilter ? monthFilter.slice(5) : ''}
            onChange={(e) => {
              const m = e.target.value;
              if (!m) {
                setMonthFilter('');
              } else if (yearFilter) {
                setMonthFilter(`${yearFilter}-${m}`);
              }
              setPage(0);
            }}
            disabled={!yearFilter}
            style={{ padding: '0.5rem' }}
          >
            <option value="">All months</option>
            {months.map((m) => (
              <option key={m.v} value={m.v}>{m.l}</option>
            ))}
          </select>
        </div>
      </div>

      {error && <div style={{ color: 'red', marginBottom: '0.5rem' }}>{error}</div>}
      {showLoading ? (
        <p>Loading...</p>
      ) : transactions.length === 0 ? (
        <p style={{ color: '#666' }}>No transactions yet. Add one or upload a statement.</p>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem' }}>
            <div style={{ color: '#666', fontSize: '0.9rem' }}>
              Page {page + 1}
              {monthFilter ? ` • ${monthFilter}` : yearFilter ? ` • ${yearFilter}` : ''}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="button" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} style={{ padding: '0.4rem 0.75rem' }}>
                Prev
              </button>
              <button type="button" onClick={() => setPage((p) => p + 1)} disabled={!hasMore} style={{ padding: '0.4rem 0.75rem' }}>
                Next
              </button>
            </div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '0.5rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #ddd', textAlign: 'left' }}>
              <th style={{ padding: '0.5rem' }}>Date</th>
              <th style={{ padding: '0.5rem' }}>Merchant</th>
              <th style={{ padding: '0.5rem' }}>Amount</th>
              <th style={{ padding: '0.5rem' }}>Type</th>
              <th style={{ padding: '0.5rem' }}>Source</th>
              <th style={{ padding: '0.5rem' }}>Tags</th>
              <th style={{ padding: '0.5rem' }}></th>
              <th style={{ padding: '0.5rem' }}></th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => (
              <tr key={t.txn_id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '0.5rem' }}>{t.txn_date}</td>
                <td style={{ padding: '0.5rem' }}>{t.merchant || '—'}</td>
                <td style={{ padding: '0.5rem' }}>{t.amount}</td>
                <td style={{ padding: '0.5rem' }}>{t.debit_credit}</td>
                <td style={{ padding: '0.5rem' }}>{t.source}</td>
                <td style={{ padding: '0.5rem', fontSize: '0.85rem', color: '#374151' }}>
                  {(t.tag_ids || []).length === 0
                    ? miscName
                    : (t.tag_ids || [])
                        .map((id) => tagMap[id])
                        .filter(Boolean)
                        .join(', ')}
                </td>
                <td style={{ padding: '0.5rem' }}>
                  <Link to={`/transactions/${t.txn_id}/edit`}>Edit</Link>
                </td>
                <td style={{ padding: '0.5rem' }}>
                  {t.source === 'manual' && (
                    <button
                      type="button"
                      onClick={() => handleDelete(t)}
                      style={{ padding: '0.25rem 0.5rem' }}
                    >
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          </table>
        </>
      )}
    </div>
  );
}
