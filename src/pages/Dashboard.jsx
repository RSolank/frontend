import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../state/AuthContext.jsx';
import { apiFetch } from '../utils/apiClient.js';
import { formatDisplayDate } from '../utils/dateUtils.js';

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

const ProgressBar = ({ current, limit, color = '#2563eb' }) => {
  if (!limit || limit <= 0) return null;
  const percent = Math.min(((current || 0) / limit) * 100, 100);
  const isOver = (current || 0) > limit;
  return (
    <div style={{ width: '100%', height: '6px', background: '#f1f5f9', borderRadius: '10px', overflow: 'hidden', marginTop: '8px' }}>
      <div style={{ 
        width: `${percent}%`, 
        height: '100%', 
        background: isOver ? '#ef4444' : color,
        transition: 'width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)' 
      }} />
    </div>
  );
};

export function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [budgetData, setBudgetData] = useState(null);
  const [taxSummary, setTaxSummary] = useState(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    // Load data
    apiFetch('/api/budget-limits/status').then(setBudgetData).catch(() => {});
    apiFetch('/api/consumption-tax/bills').then(d => {
      const currentMonth = new Date().toISOString().slice(0, 7);
      const total = (d.bills || []).filter(b => b.period_start?.startsWith(currentMonth))
        .reduce((acc, b) => acc + (b.total_amount || 0), 0);
      setTaxSummary(total);
    }).catch(() => {});
    
    setLoading(true);
    apiFetch('/api/transactions?limit=10')
      .then(d => setTransactions(d.transactions || []))
      .catch(err => setError(err.detail))
      .finally(() => setLoading(false));

    // Handle clicks outside menu
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this transaction?')) return;
    try {
      await apiFetch(`/api/transactions/${id}`, { method: 'DELETE' });
      setTransactions(prev => prev.filter(t => t.txn_id !== id));
    } catch (err) { alert(err.detail); }
  };

  const currency = user?.currency || '$';

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1rem', fontFamily: 'Inter, sans-serif', color: '#1e293b' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: 0, letterSpacing: '-0.025em' }}>Dashboard</h1>
          <p style={{ color: '#64748b', marginTop: '0.25rem' }}>Welcome back, <span style={{ color: '#1e293b', fontWeight: 600 }}>{user?.first_name || 'User'}</span></p>
        </div>
        
        <div style={{ position: 'relative' }} ref={menuRef}>
          <button 
            onClick={() => setShowUserMenu(!showUserMenu)}
            style={{ 
              display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 1rem', 
              background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)', fontWeight: 600
            }}
          >
            <div style={{ width: '32px', height: '32px', background: '#2563eb', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem' }}>
              {(user?.first_name?.[0] || 'U').toUpperCase()}
            </div>
            <span>{user?.first_name || 'Profile'}</span>
            <span style={{ fontSize: '0.7rem' }}>▼</span>
          </button>
          
          {showUserMenu && (
            <div style={{ 
              position: 'absolute', right: 0, top: 'calc(100% + 8px)', width: '200px', 
              background: 'white', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', 
              border: '1px solid #f1f5f9', zIndex: 10, overflow: 'hidden'
            }}>
              <Link to="/profile" style={{ display: 'block', padding: '0.75rem 1rem', textDecoration: 'none', color: '#1e293b', fontSize: '0.9rem', borderBottom: '1px solid #f1f5f9' }}>User Profile</Link>
              <Link to="/settings" style={{ display: 'block', padding: '0.75rem 1rem', textDecoration: 'none', color: '#1e293b', fontSize: '0.9rem', borderBottom: '1px solid #f1f5f9' }}>Settings</Link>
              <button onClick={logout} style={{ width: '100%', textAlign: 'left', padding: '0.75rem 1rem', background: 'none', border: 'none', color: '#ef4444', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem' }}>Logout</button>
            </div>
          )}
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '2rem', alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <Card style={{ background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', color: 'white', border: 'none', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, opacity: 0.9 }}>TOTAL BUDGET</span>
                {taxSummary > 0 && <span style={{ fontSize: '0.75rem', background: 'rgba(255, 255, 255, 0.2)', padding: '4px 10px', borderRadius: '20px' }}>Tax: {currency}{taxSummary.toFixed(2)}</span>}
              </div>
              <h2 style={{ fontSize: '2.5rem', fontWeight: 800, margin: '0.5rem 0' }}>{currency}{(budgetData?.total_budget?.current_expense || 0).toLocaleString()}</h2>
              <div style={{ opacity: 0.8, fontSize: '0.95rem' }}>spent of {currency}{(budgetData?.total_budget?.limit_amt || 0).toLocaleString()} limit</div>
              <div style={{ marginTop: '1.5rem' }}><ProgressBar current={budgetData?.total_budget?.current_expense || 0} limit={budgetData?.total_budget?.limit_amt} color="#ffffff" /></div>
              <div style={{ marginTop: '1.5rem' }}><Link to="/budgets" style={{ color: 'white', fontSize: '0.85rem', fontWeight: 600, textDecoration: 'none' }}>Detailed Budget View →</Link></div>
            </div>
          </Card>

          <Card>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', fontWeight: 700 }}>Top Categories</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {(budgetData?.categories || []).slice(0, 4).map(cat => (
                <div key={cat.tag_id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 600 }}>{cat.tag_name}</span>
                    <span style={{ color: '#64748b' }}>{currency}{(cat.current_expense || 0).toLocaleString()}</span>
                  </div>
                  <ProgressBar current={cat.current_expense || 0} limit={cat.limit_amt} />
                </div>
              ))}
            </div>
            <Link to="/budgets" style={{ display: 'block', textAlign: 'center', marginTop: '1.5rem', color: '#2563eb', fontSize: '0.85rem', fontWeight: 600, textDecoration: 'none' }}>View All Budgets →</Link>
          </Card>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <Link to="/add-transaction" style={{ textDecoration: 'none' }}><Card style={{ padding: '1.25rem', textAlign: 'center', background: '#f8fafc', border: '1px dashed #cbd5e1' }}><div>➕</div><div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Add Expense</div></Card></Link>
            <Link to="/upload-statement" style={{ textDecoration: 'none' }}><Card style={{ padding: '1.25rem', textAlign: 'center', background: '#f8fafc', border: '1px dashed #cbd5e1' }}><div>📄</div><div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Upload CSV</div></Card></Link>
          </div>
        </div>

        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Recent Activity</h3>
            <Link to="/transactions" style={{ color: '#2563eb', fontSize: '0.85rem', fontWeight: 600, textDecoration: 'none' }}>View All →</Link>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ textAlign: 'left', background: '#f8fafc' }}><th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>DATE</th><th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>BENEFICIARY</th><th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textAlign: 'right' }}>AMOUNT</th><th style={{ padding: '1rem 1.5rem', textAlign: 'center' }}></th></tr></thead>
              <tbody>
                {transactions.map(t => (
                  <tr key={t.txn_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '1rem 1.5rem', fontSize: '0.9rem' }}>{formatDisplayDate(t.txn_date)}</td>
                    <td style={{ padding: '1rem 1.5rem', fontSize: '0.9rem', fontWeight: 500 }}>{t.beneficiary || '—'}</td>
                    <td style={{ padding: '1rem 1.5rem', fontSize: '0.9rem', fontWeight: 700, textAlign: 'right', color: t.debit_credit === 'debit' ? '#ef4444' : '#10b981' }}>{currency}{(t.amount || 0).toLocaleString()}</td>
                    <td style={{ padding: '1rem 1.5rem', textAlign: 'right', fontSize: '0.9rem' }}>
                      {/* Delete removed as per user request (Recent Activity is view-only) */}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '1rem', textAlign: 'right' }}>
             <Link to="/consumption-tax" style={{ color: '#64748b', fontSize: '0.8rem', textDecoration: 'none' }}>Detailed Tax Insights →</Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
