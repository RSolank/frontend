import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../state/AuthContext.jsx';
import { apiFetch } from '../../utils/apiClient.js';
import { formatDisplayDate } from '../../utils/dateUtils.js';

const Card = ({ children, style = {} }) => (
  <div style={{
    background: '#ffffff',
    borderRadius: '16px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
    padding: '1.5rem',
    border: '1px solid #f0f0f0',
    ...style
  }}>
    {children}
  </div>
);

function flattenTags(nodes, out = []) {
  for (const n of nodes || []) {
    out.push({ tag_id: n.tag_id, tag_name: n.tag_name });
    flattenTags(n.children, out);
  }
  return out;
}

const ActionDropdown = ({ txn, onDelete }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const isManual = txn.source === 'manual';

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isManual) {
    return (
      <Link 
        to={`/transactions/${txn.txn_id}/edit`} 
        style={{ color: '#2563eb', textDecoration: 'none', fontSize: '0.85rem', fontWeight: 700 }}
      >
        Edit
      </Link>
    );
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }} ref={dropdownRef}>
      <div style={{ display: 'flex', alignItems: 'center', background: '#f1f5f9', borderRadius: '6px', overflow: 'hidden' }}>
        <Link 
          to={`/transactions/${txn.txn_id}/edit`} 
          style={{ 
            padding: '0.4rem 0.75rem', 
            color: '#2563eb', 
            textDecoration: 'none', 
            fontSize: '0.85rem', 
            fontWeight: 700,
            borderRight: '1px solid #e2e8f0'
          }}
        >
          Edit
        </Link>
        <button 
          onClick={() => setIsOpen(!isOpen)}
          style={{ 
            padding: '0.4rem 0.5rem', 
            background: 'none', 
            border: 'none', 
            cursor: 'pointer', 
            color: '#64748b',
            display: 'flex',
            alignItems: 'center',
            fontSize: '0.7rem'
          }}
        >
          ▼
        </button>
      </div>

      {isOpen && (
        <div style={{ 
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
          overflow: 'hidden'
        }}>
          <button 
            onClick={() => {
              onDelete(txn.txn_id);
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
              fontSize: '0.85rem',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => e.target.style.background = '#fef2f2'}
            onMouseLeave={(e) => e.target.style.background = 'none'}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
};

export function TransactionsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState([]);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Pagination & Filtering
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const PAGE_SIZE = 20;

  const fetchTransactions = async (offsetNum = 0) => {
    const params = new URLSearchParams();
    params.set('limit', String(PAGE_SIZE));
    params.set('offset', String(offsetNum));
    const d = await apiFetch(`/api/transactions?${params.toString()}`);
    return d.transactions || [];
  };

  const loadData = () => {
    setLoading(true);
    setError(null);
    Promise.all([
      fetchTransactions(page * PAGE_SIZE),
      apiFetch('/api/tags').then(d => flattenTags(d.tags || []))
    ])
      .then(([txns, tagList]) => {
        setTransactions(txns);
        setTags(tagList);
        setHasMore(txns.length === PAGE_SIZE);
      })
      .catch((err) => setError(err.detail || 'Failed to load data'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (user) loadData();
  }, [user, page]);

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this transaction?')) return;
    try {
      await apiFetch(`/api/transactions/${id}`, { method: 'DELETE' });
      loadData();
    } catch (err) {
      alert(err.detail || 'Delete failed');
    }
  };

  const currency = user?.currency || '$';

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1rem', fontFamily: 'Inter, sans-serif' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0 }}>Transactions</h1>
          <p style={{ color: '#64748b' }}>View and manage your transaction history</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <Link to="/add-transaction" style={{ padding: '0.6rem 1.2rem', background: '#2563eb', color: 'white', borderRadius: '8px', textDecoration: 'none', fontWeight: 600 }}>+ Add Transaction</Link>
          <Link to="/dashboard" style={{ padding: '0.6rem 1.2rem', background: '#f1f5f9', color: '#475569', borderRadius: '8px', textDecoration: 'none', fontWeight: 600 }}>Dashboard</Link>
        </div>
      </header>

      <Card style={{ padding: 0 }}>
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', borderTopLeftRadius: '16px', borderTopRightRadius: '16px' }}>
          <span style={{ fontWeight: 600, color: '#475569' }}>Total Records: {transactions.length + (page * PAGE_SIZE)}</span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} style={{ padding: '0.4rem 0.8rem', background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer' }}>Prev</button>
            <button onClick={() => setPage(p => p + 1)} disabled={!hasMore} style={{ padding: '0.4rem 0.8rem', background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer' }}>Next</button>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', background: '#ffffff', borderBottom: '1px solid #f1f5f9' }}>
                <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Date</th>
                <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Beneficiary</th>
                <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', textAlign: 'right' }}>Amount</th>
                <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Tags</th>
                <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="5" style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>Loading...</td></tr>
              ) : transactions.map(t => (
                <tr key={t.txn_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '1rem 1.5rem', fontSize: '0.9rem' }}>{formatDisplayDate(t.txn_date)}</td>
                  <td style={{ padding: '1rem 1.5rem', fontSize: '0.9rem', fontWeight: 500 }}>{t.beneficiary || '—'}</td>
                  <td style={{ padding: '1rem 1.5rem', fontSize: '0.9rem', fontWeight: 700, textAlign: 'right', color: t.debit_credit === 'debit' ? '#ef4444' : '#10b981' }}>
                    {t.debit_credit === 'debit' ? '-' : '+'}{currency}{(t.amount || 0).toLocaleString()}
                  </td>
                  <td style={{ padding: '1rem 1.5rem' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {(t.tag_ids || []).map(tid => {
                        const tag = tags.find(tg => tg.tag_id === tid);
                        return (
                          <span key={tid} style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '12px', background: '#f1f5f9', color: '#475569', fontWeight: 600 }}>
                            {tag ? tag.tag_name : `Tag ${tid}`}
                          </span>
                        );
                      })}
                      {(!t.tag_ids || t.tag_ids.length === 0) && <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Uncategorized</span>}
                    </div>
                  </td>
                  <td style={{ padding: '1rem 1.5rem', textAlign: 'center' }}>
                    <ActionDropdown txn={t} onDelete={handleDelete} />
                  </td>
                </tr>
              ))}
              {!loading && transactions.length === 0 && (
                <tr><td colSpan="5" style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>No transactions found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
      {error && <div style={{ color: '#ef4444', marginTop: '1rem', textAlign: 'center' }}>{error}</div>}
    </div>
  );
}
