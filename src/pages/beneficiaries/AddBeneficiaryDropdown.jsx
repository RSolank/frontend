import React, { useState, useEffect, useRef } from 'react';

export function AddBeneficiaryDropdown({ onSelectType }) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (ref.current && !ref.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (type) => {
    onSelectType(type);
    setIsOpen(false);
  };

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          background: '#2563eb',
          borderRadius: '8px',
          overflow: 'hidden',
        }}
      >
        <span
          style={{
            padding: '0.6rem 1rem',
            color: 'white',
            fontWeight: 600,
            fontSize: '0.9rem',
          }}
        >
          Add New
        </span>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Choose beneficiary type"
          style={{
            padding: '0.6rem 0.65rem',
            background: 'rgba(255,255,255,0.15)',
            border: 'none',
            borderLeft: '1px solid rgba(255,255,255,0.25)',
            cursor: 'pointer',
            color: 'white',
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
            minWidth: '140px',
            overflow: 'hidden',
          }}
        >
          {['merchant', 'person'].map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => handleSelect(type)}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '0.6rem 0.75rem',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 600,
                textTransform: 'capitalize',
              }}
            >
              {type}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
