import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '../state/AuthContext.jsx';

export function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  if (user) return null; // Prevent flicker before redirect
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        background:
          'radial-gradient(circle at top left, #e0f2fe 0, #f5f5f5 45%, #eef2ff 100%)',
        color: '#111827',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, system-ui, -system-ui, sans-serif',
      }}
    >
      <div
        style={{
          maxWidth: '960px',
          width: '100%',
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)',
          gap: '3rem',
          alignItems: 'center',
        }}
      >
        <div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '0.25rem 0.75rem',
              borderRadius: '999px',
              backgroundColor: 'rgba(15,118,110,0.08)',
              color: '#0f766e',
              fontSize: '0.75rem',
              fontWeight: 600,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              marginBottom: '0.75rem',
            }}
          >
            Smart budgeting for future you
          </div>

          <h1
            style={{
              fontSize: 'clamp(2.25rem, 3vw + 1.5rem, 3.25rem)',
              lineHeight: 1.05,
              marginBottom: '0.75rem',
              color: '#020617',
            }}
          >
            See every dollar with
            <span style={{ color: '#0f766e' }}> clarity</span>.
          </h1>

          <p
            style={{
              fontSize: '1rem',
              lineHeight: 1.6,
              color: '#4b5563',
              maxWidth: '34rem',
              marginBottom: '1.75rem',
            }}
          >
            Personal Budget keeps your spending, tags, and future tax in one
            clean dashboard. Log in to pick up where you left off, or create a
            free account to get started in minutes.
          </p>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.75rem',
              marginBottom: '1rem',
            }}
          >
            <Link
              to="/login"
              className="inline-flex items-center justify-center rounded-full border border-teal-700/90 bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white no-underline shadow-md transition-colors hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500"
            >
              Log in
            </Link>

            <Link
              to="/register"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0.7rem 1.4rem',
                borderRadius: '999px',
                backgroundColor: 'white',
                color: '#0f172a',
                fontWeight: 600,
                fontSize: '0.95rem',
                textDecoration: 'none',
                border: '1px solid rgba(148,163,184,0.8)',
              }}
            >
              Register
            </Link>
          </div>

          <p
            style={{
              fontSize: '0.8rem',
              color: '#6b7280',
            }}
          >
            No credit card required. You can switch plans or export your data
            any time.
          </p>
        </div>

        <div
          style={{
            position: 'relative',
            padding: '1.25rem',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: '10%',
              borderRadius: '1.5rem',
              background:
                'conic-gradient(from 160deg, rgba(59,130,246,0.08), rgba(34,197,94,0.08), rgba(14,116,144,0.16))',
              filter: 'blur(18px)',
              zIndex: 0,
            }}
          />
          <div
            style={{
              position: 'relative',
              zIndex: 1,
              borderRadius: '1.25rem',
              backgroundColor: 'rgba(255,255,255,0.95)',
              border: '1px solid rgba(226,232,240,0.9)',
              boxShadow:
                '0 22px 45px rgba(15,23,42,0.16), 0 4px 14px rgba(15,23,42,0.12)',
              padding: '1.25rem',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1rem',
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: '0.75rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: '#6b7280',
                    marginBottom: '0.2rem',
                    fontWeight: 600,
                  }}
                >
                  Monthly overview
                </div>
                <div
                  style={{
                    fontSize: '1.5rem',
                    fontWeight: 700,
                    color: '#0f172a',
                  }}
                >
                  ₹82,450
                </div>
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: '#16a34a',
                    marginTop: '0.15rem',
                  }}
                >
                  +12.4% vs last month
                </div>
              </div>
              <div
                style={{
                  padding: '0.4rem 0.7rem',
                  borderRadius: '999px',
                  backgroundColor: 'rgba(22,163,74,0.08)',
                  color: '#166534',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                }}
              >
                On track
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                gap: '0.75rem',
                marginBottom: '1.25rem',
              }}
            >
              {[
                { label: 'Essentials', value: '42%', color: '#0f766e' },
                { label: 'Goals & tax', value: '28%', color: '#2563eb' },
                { label: 'Lifestyle', value: '30%', color: '#9333ea' },
              ].map((item) => (
                <div
                  key={item.label}
                  style={{
                    padding: '0.65rem 0.7rem',
                    borderRadius: '0.9rem',
                    backgroundColor: 'rgba(248,250,252,1)',
                    border: '1px solid rgba(226,232,240,0.9)',
                  }}
                >
                  <div
                    style={{
                      fontSize: '0.7rem',
                      color: '#6b7280',
                      marginBottom: '0.15rem',
                    }}
                  >
                    {item.label}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.95rem',
                        fontWeight: 600,
                        color: '#0f172a',
                      }}
                    >
                      {item.value}
                    </span>
                    <span
                      style={{
                        width: '0.6rem',
                        height: '0.6rem',
                        borderRadius: '999px',
                        backgroundColor: item.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div
              style={{
                paddingTop: '0.75rem',
                borderTop: '1px dashed rgba(203,213,225,0.9)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '0.75rem',
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: '#64748b',
                  }}
                >
                  Next tax set-aside
                </div>
                <div
                  style={{
                    fontSize: '1rem',
                    fontWeight: 600,
                    color: '#0f172a',
                  }}
                >
                  ₹14,300
                </div>
              </div>
              <div
                style={{
                  fontSize: '0.7rem',
                  color: '#6b7280',
                  textAlign: 'right',
                  maxWidth: '11rem',
                }}
              >
                Automatically tagged so you do not have to think about it.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
