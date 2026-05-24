import React, { useState, useEffect } from 'react';

import { apiFetch } from '../../utils/apiClient.js';

import { buildAliasCheckUrl } from './aliasUtils.js';

const chipStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  background: '#eff6ff',
  color: '#2563eb',
  padding: '4px 10px',
  borderRadius: '20px',
  fontSize: '0.85rem',
  fontWeight: 600,
  border: '1px solid #dbeafe',
};

export function AliasChipsInput({
  aliases = [],
  onChange,
  readOnly = false,
  excludeUid = null,
  onValidityChange,
}) {
  const [aliasTemp, setAliasTemp] = useState('');
  const [checkStatus, setCheckStatus] = useState(null); // null | checking | unique | taken | duplicate | empty

  useEffect(() => {
    if (readOnly) return;
    const val = aliasTemp.trim();
    if (!val) {
      setCheckStatus(null);
      onValidityChange?.(false);
      return;
    }
    if (aliases.some((a) => a.toLowerCase() === val.toLowerCase())) {
      setCheckStatus('duplicate');
      onValidityChange?.(true);
      return;
    }

    setCheckStatus('checking');
    const timer = setTimeout(async () => {
      try {
        const result = await apiFetch(buildAliasCheckUrl(val, excludeUid));
        const status = result.unique ? 'unique' : 'taken';
        setCheckStatus(status);
        onValidityChange?.(status === 'taken');
      } catch {
        setCheckStatus(null);
        onValidityChange?.(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [aliasTemp, aliases, excludeUid, readOnly, onValidityChange]);

  const handleAdd = async () => {
    const val = aliasTemp.trim();
    if (!val) return;
    if (aliases.some((a) => a.toLowerCase() === val.toLowerCase())) {
      setCheckStatus('duplicate');
      onValidityChange?.(true);
      return;
    }
    if (checkStatus !== 'unique') {
      try {
        const result = await apiFetch(buildAliasCheckUrl(val, excludeUid));
        if (!result.unique) {
          setCheckStatus('taken');
          onValidityChange?.(true);
          return;
        }
      } catch {
        alert('Could not verify alias uniqueness');
        return;
      }
    }
    onChange([...aliases, val]);
    setAliasTemp('');
    setCheckStatus(null);
    onValidityChange?.(false);
  };

  const handleRemove = (val) => {
    onChange(aliases.filter((a) => a !== val));
    onValidityChange?.(false);
  };

  const statusMessage = () => {
    if (readOnly || !aliasTemp.trim()) return null;
    if (checkStatus === 'checking')
      return (
        <span style={{ color: '#64748b', fontSize: '0.8rem' }}>
          Checking availability…
        </span>
      );
    if (checkStatus === 'unique')
      return (
        <span style={{ color: '#10b981', fontSize: '0.8rem' }}>
          Alias is available
        </span>
      );
    if (checkStatus === 'taken')
      return (
        <span style={{ color: '#ef4444', fontSize: '0.8rem' }}>
          Alias already in use
        </span>
      );
    if (checkStatus === 'duplicate')
      return (
        <span style={{ color: '#ef4444', fontSize: '0.8rem' }}>
          Alias already added
        </span>
      );
    return null;
  };

  const canAdd = !readOnly && aliasTemp.trim() && checkStatus === 'unique';

  return (
    <div style={{ marginBottom: '1rem' }}>
      <span
        style={{
          display: 'block',
          marginBottom: '4px',
          fontWeight: 600,
          fontSize: '0.85rem',
        }}
      >
        Aliases
      </span>

      {!readOnly && (
        <>
          <div
            style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}
          >
            <input
              value={aliasTemp}
              onChange={(e) => setAliasTemp(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (canAdd) handleAdd();
                }
              }}
              placeholder="Enter alias (e.g. Jio, Airtel)"
              style={{
                flex: 1,
                padding: '0.6rem',
                borderRadius: '8px',
                border: `1px solid ${checkStatus === 'taken' || checkStatus === 'duplicate' ? '#fca5a5' : '#e2e8f0'}`,
              }}
            />
            <button
              type="button"
              onClick={handleAdd}
              disabled={!canAdd}
              style={{
                padding: '0.6rem 1.2rem',
                background: canAdd ? '#f1f5f9' : '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                fontWeight: 600,
                cursor: canAdd ? 'pointer' : 'not-allowed',
                color: canAdd ? '#475569' : '#94a3b8',
              }}
            >
              Add alias
            </button>
          </div>
          <div style={{ marginBottom: '0.5rem', minHeight: '1.2rem' }}>
            {statusMessage()}
          </div>
        </>
      )}

      <div
        style={{
          padding: '0.75rem',
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          minHeight: '3rem',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}
      >
        {aliases.length === 0 ? (
          <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
            No aliases added
          </span>
        ) : (
          aliases.map((a) => (
            <span key={a} style={chipStyle}>
              {a}
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => handleRemove(a)}
                  aria-label={`Remove alias ${a}`}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#2563eb',
                    cursor: 'pointer',
                    padding: 0,
                    fontWeight: 700,
                    fontSize: '1rem',
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              )}
            </span>
          ))
        )}
      </div>
    </div>
  );
}
