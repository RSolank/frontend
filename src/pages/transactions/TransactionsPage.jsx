import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '../../state/AuthContext.jsx';
import { apiFetch } from '../../shared/api/apiClient';
import { formatDisplayDate } from '../../shared/utils/dateUtils';

const Card = ({ children, style = {} }) => (
  <div
    style={{
      background: '#ffffff',
      borderRadius: '16px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
      padding: '1.5rem',
      border: '1px solid #f0f0f0',
      ...style,
    }}
  >
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
        style={{
          color: '#2563eb',
          textDecoration: 'none',
          fontSize: '0.85rem',
          fontWeight: 700,
        }}
      >
        Edit
      </Link>
    );
  }

  return (
    <div
      style={{ position: 'relative', display: 'inline-block' }}
      ref={dropdownRef}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          background: '#f1f5f9',
          borderRadius: '6px',
          overflow: 'hidden',
        }}
      >
        <Link
          to={`/transactions/${txn.txn_id}/edit`}
          style={{
            padding: '0.4rem 0.75rem',
            color: '#2563eb',
            textDecoration: 'none',
            fontSize: '0.85rem',
            fontWeight: 700,
            borderRight: '1px solid #e2e8f0',
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
            fontSize: '0.7rem',
          }}
        >
          ▼
        </button>
      </div>

      {isOpen && (
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
            overflow: 'hidden',
          }}
        >
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
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => (e.target.style.background = '#fef2f2')}
            onMouseLeave={(e) => (e.target.style.background = 'none')}
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
  const [transactions, setTransactions] = useState([]);
  const [groups, setGroups] = useState([]);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // View mode
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'merchant'

  // Pagination & Filtering
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const PAGE_SIZE = 25;

  // Filters
  const [filterType, setFilterType] = useState('all'); // 'all' | 'debit' | 'credit'
  const [sortBy, setSortBy] = useState('date');
  const [order, setOrder] = useState('desc');
  const [selectedTag, setSelectedTag] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [filterBeneficiaryId, setFilterBeneficiaryId] = useState('');

  const fetchTransactions = async (offsetNum = 0) => {
    const params = new URLSearchParams();
    params.set('limit', String(PAGE_SIZE));
    params.set('offset', String(offsetNum));

    if (filterType !== 'all') params.set('debit_credit', filterType);
    if (viewMode === 'merchant') params.set('group_by', 'merchant');

    params.set('sort_by', sortBy);
    params.set('order', order);

    if (selectedTag) params.set('tag_id', selectedTag);
    if (selectedMonth) params.set('month', selectedMonth);
    if (filterBeneficiaryId) params.set('beneficiary_id', filterBeneficiaryId);

    const d = await apiFetch(`/api/transactions?${params.toString()}`);
    return d;
  };

  const loadData = () => {
    setLoading(true);
    setError(null);
    Promise.all([
      fetchTransactions(page * PAGE_SIZE),
      apiFetch('/api/tags').then((d) => flattenTags(d.tags || [])),
    ])
      .then(([data, tagList]) => {
        if (viewMode === 'merchant') {
          setGroups(data.groups || []);
        } else {
          setTransactions(data.transactions || []);
        }
        setTags(tagList);
        setHasMore(data.returned_count === PAGE_SIZE);
      })
      .catch((err) => setError(err.detail || 'Failed to load data'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (user) loadData();
  }, [
    user,
    page,
    viewMode,
    filterType,
    sortBy,
    order,
    selectedTag,
    selectedMonth,
    filterBeneficiaryId,
  ]);

  const showMerchantTransactions = (beneficiaryId) => {
    setViewMode('list');
    setSortBy('date');
    setFilterBeneficiaryId(String(beneficiaryId));
    setPage(0);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this transaction?'))
      return;
    try {
      await apiFetch(`/api/transactions/${id}`, { method: 'DELETE' });
      loadData();
    } catch (err) {
      alert(err.detail || 'Delete failed');
    }
  };

  const handleSort = (field) => {
    if (sortBy === field) {
      setOrder(order === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setOrder('desc');
    }
    setPage(0);
  };

  const currency = user?.currency || '$';

  return (
    <div
      style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '2rem 1rem',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '2rem',
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0 }}>
            Transactions
          </h1>
          <p style={{ color: '#64748b' }}>
            View and manage your transaction history
          </p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <Link
            to="/add-transaction"
            style={{
              padding: '0.6rem 1.2rem',
              background: '#2563eb',
              color: 'white',
              borderRadius: '8px',
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            + Add Transaction
          </Link>
          <Link
            to="/beneficiaries"
            style={{
              padding: '0.6rem 1.2rem',
              background: '#f1f5f9',
              color: '#475569',
              borderRadius: '8px',
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            Beneficiaries
          </Link>
          <Link
            to="/dashboard"
            style={{
              padding: '0.6rem 1.2rem',
              background: '#f1f5f9',
              color: '#475569',
              borderRadius: '8px',
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            Dashboard
          </Link>
        </div>
      </header>

      {/* Filters Bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.5rem',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            display: 'flex',
            background: '#f1f5f9',
            borderRadius: '8px',
            padding: '4px',
          }}
        >
          <button
            onClick={() => {
              setViewMode('list');
              setSortBy('date');
              setPage(0);
            }}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              border: 'none',
              background: viewMode === 'list' ? 'white' : 'transparent',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow:
                viewMode === 'list' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}
          >
            List View
          </button>
          <button
            onClick={() => {
              setViewMode('merchant');
              setSortBy('total_amount');
              setPage(0);
            }}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              border: 'none',
              background: viewMode === 'merchant' ? 'white' : 'transparent',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow:
                viewMode === 'merchant' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}
          >
            Merchant View
          </button>
        </div>

        <select
          value={filterType}
          onChange={(e) => {
            setFilterType(e.target.value);
            setPage(0);
          }}
          style={{
            padding: '0.6rem',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            background: 'white',
          }}
        >
          <option value="all">All Types</option>
          <option value="debit">Debit Only</option>
          <option value="credit">Credit Only</option>
        </select>

        <select
          value={selectedTag}
          onChange={(e) => {
            setSelectedTag(e.target.value);
            setPage(0);
          }}
          style={{
            padding: '0.6rem',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            background: 'white',
          }}
        >
          <option value="">All Tags</option>
          {tags.map((t) => (
            <option key={t.tag_id} value={t.tag_id}>
              {t.tag_name}
            </option>
          ))}
        </select>

        <input
          type="month"
          value={selectedMonth}
          onChange={(e) => {
            setSelectedMonth(e.target.value);
            setPage(0);
          }}
          style={{
            padding: '0.6rem',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            background: 'white',
          }}
        />

        {filterBeneficiaryId && (
          <button
            type="button"
            onClick={() => {
              setFilterBeneficiaryId('');
              setPage(0);
            }}
            style={{
              padding: '0.6rem 1rem',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              background: 'white',
              cursor: 'pointer',
              fontWeight: 600,
              color: '#64748b',
            }}
          >
            Clear merchant filter
          </button>
        )}
      </div>

      <Card style={{ padding: 0 }}>
        <div
          style={{
            padding: '1rem 1.5rem',
            borderBottom: '1px solid #f1f5f9',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#f8fafc',
            borderTopLeftRadius: '16px',
            borderTopRightRadius: '16px',
          }}
        >
          <span style={{ fontWeight: 600, color: '#475569' }}>
            {viewMode === 'list'
              ? `Total Records: ${transactions.length}`
              : `Total Merchants: ${groups.length}`}
          </span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              style={{
                padding: '0.4rem 0.8rem',
                background: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              Prev
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={!hasMore}
              style={{
                padding: '0.4rem 0.8rem',
                background: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              Next
            </button>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr
                style={{
                  textAlign: 'left',
                  background: '#ffffff',
                  borderBottom: '1px solid #f1f5f9',
                }}
              >
                {viewMode === 'list' ? (
                  <>
                    <th
                      onClick={() => handleSort('date')}
                      style={{
                        padding: '1rem 1.5rem',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: '#64748b',
                        textTransform: 'uppercase',
                        cursor: 'pointer',
                      }}
                    >
                      Date {sortBy === 'date' && (order === 'asc' ? '▲' : '▼')}
                    </th>
                    <th
                      style={{
                        padding: '1rem 1.5rem',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: '#64748b',
                        textTransform: 'uppercase',
                      }}
                    >
                      Beneficiary
                    </th>
                    <th
                      onClick={() => handleSort('amount')}
                      style={{
                        padding: '1rem 1.5rem',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: '#64748b',
                        textTransform: 'uppercase',
                        textAlign: 'right',
                        cursor: 'pointer',
                      }}
                    >
                      Amount{' '}
                      {sortBy === 'amount' && (order === 'asc' ? '▲' : '▼')}
                    </th>
                    <th
                      style={{
                        padding: '1rem 1.5rem',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: '#64748b',
                        textTransform: 'uppercase',
                      }}
                    >
                      Tags
                    </th>
                    <th
                      style={{
                        padding: '1rem 1.5rem',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: '#64748b',
                        textTransform: 'uppercase',
                        textAlign: 'center',
                      }}
                    >
                      Actions
                    </th>
                  </>
                ) : (
                  <>
                    <th
                      style={{
                        padding: '1rem 1.5rem',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: '#64748b',
                        textTransform: 'uppercase',
                      }}
                    >
                      Merchant
                    </th>
                    <th
                      onClick={() => handleSort('frequency')}
                      style={{
                        padding: '1rem 1.5rem',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: '#64748b',
                        textTransform: 'uppercase',
                        textAlign: 'right',
                        cursor: 'pointer',
                      }}
                    >
                      Frequency{' '}
                      {sortBy === 'frequency' && (order === 'asc' ? '▲' : '▼')}
                    </th>
                    <th
                      onClick={() => handleSort('total_amount')}
                      style={{
                        padding: '1rem 1.5rem',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: '#64748b',
                        textTransform: 'uppercase',
                        textAlign: 'right',
                        cursor: 'pointer',
                      }}
                    >
                      Total Spend{' '}
                      {sortBy === 'total_amount' &&
                        (order === 'asc' ? '▲' : '▼')}
                    </th>
                    <th
                      style={{
                        padding: '1rem 1.5rem',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: '#64748b',
                        textTransform: 'uppercase',
                        textAlign: 'center',
                      }}
                    >
                      Actions
                    </th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan="5"
                    style={{
                      padding: '2rem',
                      textAlign: 'center',
                      color: '#94a3b8',
                    }}
                  >
                    Loading...
                  </td>
                </tr>
              ) : viewMode === 'list' ? (
                transactions.map((t) => (
                  <tr
                    key={t.txn_id}
                    style={{ borderBottom: '1px solid #f1f5f9' }}
                  >
                    <td style={{ padding: '1rem 1.5rem', fontSize: '0.9rem' }}>
                      {formatDisplayDate(t.txn_date)}
                    </td>
                    <td
                      style={{
                        padding: '1rem 1.5rem',
                        fontSize: '0.9rem',
                        fontWeight: 500,
                      }}
                    >
                      {t.beneficiary_id ? (
                        <Link
                          to={`/beneficiaries/${t.beneficiary_id}`}
                          style={{ color: '#2563eb', textDecoration: 'none' }}
                        >
                          {t.beneficiary_name || t.beneficiary || '—'}
                        </Link>
                      ) : (
                        t.beneficiary_name || t.beneficiary || '—'
                      )}
                    </td>
                    <td
                      style={{
                        padding: '1rem 1.5rem',
                        fontSize: '0.9rem',
                        fontWeight: 700,
                        textAlign: 'right',
                        color:
                          t.debit_credit === 'debit' ? '#ef4444' : '#10b981',
                      }}
                    >
                      {t.debit_credit === 'debit' ? '-' : '+'}
                      {currency}
                      {(t.amount || 0).toLocaleString()}
                    </td>
                    <td style={{ padding: '1rem 1.5rem' }}>
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '4px',
                        }}
                      >
                        {(t.tag_ids || []).map((tid) => {
                          const tag = tags.find((tg) => tg.tag_id === tid);
                          return (
                            <span
                              key={tid}
                              style={{
                                fontSize: '0.7rem',
                                padding: '2px 8px',
                                borderRadius: '12px',
                                background: '#f1f5f9',
                                color: '#475569',
                                fontWeight: 600,
                              }}
                            >
                              {tag ? tag.tag_name : `Tag ${tid}`}
                            </span>
                          );
                        })}
                        {(!t.tag_ids || t.tag_ids.length === 0) && (
                          <span
                            style={{ color: '#94a3b8', fontSize: '0.8rem' }}
                          >
                            Uncategorized
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '1rem 1.5rem', textAlign: 'center' }}>
                      <ActionDropdown txn={t} onDelete={handleDelete} />
                    </td>
                  </tr>
                ))
              ) : (
                groups.map((g) => (
                  <tr
                    key={g.beneficiary_id}
                    style={{ borderBottom: '1px solid #f1f5f9' }}
                  >
                    <td
                      style={{
                        padding: '1rem 1.5rem',
                        fontSize: '0.9rem',
                        fontWeight: 500,
                      }}
                    >
                      <Link
                        to={`/beneficiaries/${g.beneficiary_id}`}
                        style={{ color: '#2563eb', textDecoration: 'none' }}
                      >
                        {g.beneficiary_name}
                      </Link>
                    </td>
                    <td
                      style={{
                        padding: '1rem 1.5rem',
                        fontSize: '0.9rem',
                        textAlign: 'right',
                      }}
                    >
                      {g.frequency}
                    </td>
                    <td
                      style={{
                        padding: '1rem 1.5rem',
                        fontSize: '0.9rem',
                        fontWeight: 700,
                        textAlign: 'right',
                        color:
                          g.total_amount > 0
                            ? '#10b981'
                            : g.total_amount < 0
                              ? '#ef4444'
                              : '#1e293b',
                      }}
                    >
                      {g.total_amount > 0 ? '+' : g.total_amount < 0 ? '-' : ''}
                      {currency}
                      {Math.abs(g.total_amount || 0).toLocaleString()}
                    </td>
                    <td style={{ padding: '1rem 1.5rem', textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() =>
                          showMerchantTransactions(g.beneficiary_id)
                        }
                        style={{
                          color: '#2563eb',
                          background: 'none',
                          border: 'none',
                          fontSize: '0.85rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          textDecoration: 'underline',
                        }}
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
              {!loading &&
                (viewMode === 'list' ? transactions.length : groups.length) ===
                  0 && (
                  <tr>
                    <td
                      colSpan="5"
                      style={{
                        padding: '3rem',
                        textAlign: 'center',
                        color: '#94a3b8',
                      }}
                    >
                      No transactions found.
                    </td>
                  </tr>
                )}
            </tbody>
          </table>
        </div>
      </Card>
      {error && (
        <div
          style={{ color: '#ef4444', marginTop: '1rem', textAlign: 'center' }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
