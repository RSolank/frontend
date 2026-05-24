import React from 'react';

import { validatePassword } from '../utils/validation';

export function PasswordRequirements({ password }) {
  if (!password) return null;

  const { length, uppercase, lowercase, digit, special } =
    validatePassword(password);

  const Requirement = ({ met, text }) => (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        fontSize: '0.85rem',
        color: met ? '#059669' : '#6b7280',
        transition: 'color 0.2s',
      }}
    >
      <span style={{ fontSize: '1rem' }}>{met ? '✓' : '○'}</span>
      <span>{text}</span>
    </div>
  );

  return (
    <div
      style={{
        marginTop: '0.5rem',
        padding: '0.75rem',
        background: '#f9fafb',
        borderRadius: 6,
        border: '1px solid #e5e7eb',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.25rem',
      }}
    >
      <p
        style={{
          margin: '0 0 0.25rem 0',
          fontSize: '0.8rem',
          fontWeight: 'bold',
          color: '#374151',
        }}
      >
        Password must have:
      </p>
      <Requirement met={length} text="8-64 characters" />
      <Requirement met={uppercase} text="At least one uppercase letter" />
      <Requirement met={lowercase} text="At least one lowercase letter" />
      <Requirement met={digit} text="At least one number" />
      <Requirement met={special} text="At least one special character" />
    </div>
  );
}
