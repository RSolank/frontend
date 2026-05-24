import React from 'react';

export function MergeBeneficiariesForm({
  beneficiaries,
  mergeSource,
  mergeTarget,
  onSourceChange,
  onTargetChange,
  onSwap,
  onMerge,
}) {
  const source = beneficiaries.find(
    (b) => String(b.uid) === String(mergeSource)
  );
  const target = beneficiaries.find(
    (b) => String(b.uid) === String(mergeTarget)
  );
  const sourceType = source?.beneficiary_type || '—';
  const targetType = target?.beneficiary_type || '—';
  const typeMismatch = Boolean(
    source &&
    target &&
    source.beneficiary_type &&
    target.beneficiary_type &&
    source.beneficiary_type !== target.beneficiary_type
  );
  const sourceSelectId = 'merge-source-select';
  const targetSelectId = 'merge-target-select';

  return (
    <div
      style={{
        background: '#fefce8',
        padding: '1.5rem',
        borderRadius: '12px',
        marginTop: '2rem',
        border: '1px solid #fef08a',
      }}
    >
      <h3 style={{ marginTop: 0 }}>Consolidate Beneficiaries</h3>
      <div
        style={{
          marginBottom: '1rem',
          padding: '0.9rem 1rem',
          borderRadius: '10px',
          background: '#fff',
          border: '1px solid #fde68a',
        }}
      >
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <span>
            <b>Source:</b> {source?.name || 'Select a source'} ({sourceType})
          </span>
          <span>
            <b>Target:</b> {target?.name || 'Select a target'} ({targetType})
          </span>
        </div>
        {typeMismatch ? (
          <p
            style={{ margin: '0.75rem 0 0', color: '#92400e', fontWeight: 600 }}
          >
            Type mismatch detected. The source detail row will be merged into
            the matching target side first: merchant fields map to merchant
            fields, person fields map to person fields, and any missing values
            on the target are filled in before the source row is removed.
          </p>
        ) : (
          source &&
          target && (
            <p style={{ margin: '0.75rem 0 0', color: '#64748b' }}>
              Types match. The selected beneficiary record will be consolidated
              into the target.
            </p>
          )
        )}
      </div>
      <div
        style={{
          display: 'flex',
          gap: '1rem',
          alignItems: 'flex-end',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ flex: 1, minWidth: '180px' }}>
          <label
            htmlFor={sourceSelectId}
            style={{
              fontSize: '0.8rem',
              display: 'block',
              marginBottom: '4px',
            }}
          >
            Merge Source (will be deleted)
          </label>
          <select
            id={sourceSelectId}
            value={mergeSource}
            onChange={(e) => onSourceChange(e.target.value)}
            style={{
              width: '100%',
              padding: '0.6rem',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
            }}
          >
            <option value="">Select source...</option>
            {beneficiaries.map((b) => (
              <option key={b.uid} value={b.uid}>
                {b.name} ({b.beneficiary_type || 'unknown'})
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={onSwap}
          title="Swap source and target"
          aria-label="Swap source and target"
          style={{
            padding: '0.6rem 0.75rem',
            background: '#f1f5f9',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '1.1rem',
            lineHeight: 1,
          }}
        >
          ⇄
        </button>

        <div style={{ flex: 1, minWidth: '180px' }}>
          <label
            htmlFor={targetSelectId}
            style={{
              fontSize: '0.8rem',
              display: 'block',
              marginBottom: '4px',
            }}
          >
            Into Target (will keep)
          </label>
          <select
            id={targetSelectId}
            value={mergeTarget}
            onChange={(e) => onTargetChange(e.target.value)}
            style={{
              width: '100%',
              padding: '0.6rem',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
            }}
          >
            <option value="">Select target...</option>
            {beneficiaries.map((b) => (
              <option key={b.uid} value={b.uid}>
                {b.name} ({b.beneficiary_type || 'unknown'})
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={onMerge}
          style={{
            padding: '0.6rem 1.2rem',
            background: '#854d0e',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
          }}
        >
          Merge
        </button>
      </div>
    </div>
  );
}
