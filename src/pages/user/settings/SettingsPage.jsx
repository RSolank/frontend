import React, { useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { TaxationRulesTab } from './TaxationRulesTab.jsx';

// Categorization rules moved to /categorization-rules in Batch 6 under
// features/categorization/. Tags already split to /categories in Batch 4.
// Settings now hosts only the taxation rules tab until Batch 7 extracts
// that surface as well.
const TABS = {
  taxation_rules: 'Taxation Rules',
};

export function SettingsPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const activeTab = useMemo(() => {
    const tab = new URLSearchParams(location.search).get('tab');
    if (TABS[tab]) return tab;
    return 'taxation_rules';
  }, [location.search]);

  return (
    <div
      style={{
        maxWidth: 1000,
        margin: '2rem auto',
        padding: '1.5rem',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem',
        }}
      >
        <h1 style={{ fontWeight: 800 }}>Settings</h1>
        <Link
          to="/dashboard"
          style={{
            textDecoration: 'none',
            color: '#2563eb',
            fontWeight: 600,
            fontSize: '0.9rem',
          }}
        >
          ← Back to dashboard
        </Link>
      </header>

      <nav
        style={{
          display: 'flex',
          gap: '0.5rem',
          borderBottom: '1px solid #f1f5f9',
          marginBottom: '2rem',
          overflowX: 'auto',
          paddingBottom: '2px',
        }}
      >
        {Object.entries(TABS).map(([key, label]) => (
          <button
            key={key}
            onClick={() => navigate(`/settings?tab=${key}`)}
            style={{
              padding: '0.75rem 1.25rem',
              border: 'none',
              borderBottom:
                activeTab === key
                  ? '3px solid #2563eb'
                  : '3px solid transparent',
              background: 'transparent',
              cursor: 'pointer',
              fontWeight: activeTab === key ? 700 : 500,
              color: activeTab === key ? '#2563eb' : '#64748b',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s',
              fontSize: '0.9rem',
            }}
          >
            {label}
          </button>
        ))}
      </nav>

      <div style={{ background: 'white', borderRadius: '12px' }}>
        {activeTab === 'taxation_rules' && <TaxationRulesTab />}
      </div>
    </div>
  );
}
