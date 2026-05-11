import React, { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { ProfileTab } from './settings/ProfileTab.jsx';
import { CategoriesTab } from './settings/CategoriesTab.jsx';
import { SystemRulesTab } from './settings/SystemRulesTab.jsx';
import { BudgetsTab } from './settings/BudgetsTab.jsx';
import { TaxationRulesTab } from './settings/TaxationRulesTab.jsx';
import { ConsumptionTaxTab } from './settings/ConsumptionTaxTab.jsx';

const TABS = {
  profile: 'Profile',
  categories: 'Categories',
  system_rules: 'System Rules',
  budgets: 'Budgets',
  taxation_rules: 'Taxation Rules',
  consumption_tax: 'Consumption Tax'
};

export function SettingsPage() {
  const location = useLocation();
  const initialTab = useMemo(() => {
    const tab = new URLSearchParams(location.search).get('tab');
    if (tab === 'profile') return 'profile';
    return 'categories';
  }, [location.search]);

  const [activeTab, setActiveTab] = useState(initialTab);
  return (
    <div style={{ maxWidth: 800, margin: '2rem auto', padding: '1.5rem' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1>Settings</h1>
        <Link to="/dashboard">Back to dashboard</Link>
      </header>
      <nav style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid #ddd', marginBottom: '1rem' }}>
        {Object.entries(TABS).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            style={{
              padding: '0.5rem 1rem',
              border: 'none',
              background: activeTab === key ? '#eee' : 'transparent',
              cursor: 'pointer'
            }}
          >
            {label}
          </button>
        ))}
      </nav>
      {activeTab === 'profile' && <ProfileTab />}
      {activeTab === 'categories' && <CategoriesTab />}
      {activeTab === 'system_rules' && <SystemRulesTab />}
      {activeTab === 'budgets' && <BudgetsTab />}
      {activeTab === 'taxation_rules' && <TaxationRulesTab />}
      {activeTab === 'consumption_tax' && <ConsumptionTaxTab />}
    </div>
  );
}
