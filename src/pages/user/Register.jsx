import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

import { PasswordRequirements } from '../../components/PasswordRequirements.jsx';
import { useAuth } from '../../state/AuthContext.jsx';
import { apiFetch } from '../../utils/apiClient.js';
import { validatePassword } from '../../utils/validation';

export function RegisterPage() {
  const { register, error, setError } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    email_id: '',
    password: '',
    security_question: '',
    security_answer: '',
    first_name: '',
    last_name: '',
    dob: '',
    contact_local: '',
    country: '',
    currency: '',
  });
  const [countries, setCountries] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [dialCode, setDialCode] = useState('+91');

  const SECURITY_QUESTIONS = [
    'What was the name of your first school?',
    'What is the name of your favorite childhood friend?',
    'What is your mother’s maiden name?',
    'What was the name of your first pet?',
    'What city were you born in?',
    'What is your favorite teacher’s name?',
  ];

  const resolveLocaleDefaults = () => {
    try {
      const locale = (
        navigator.language ||
        navigator.userLanguage ||
        ''
      ).toUpperCase();
      const parts = locale.split('-');
      const region = parts[1] || 'IN';
      // We will match region to a country name later using countries data.
      return region;
    } catch {
      return 'IN';
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === 'country') {
      if (value === '__PREFER_NOT_SAY__') {
        setForm((f) => ({ ...f, country: '__PREFER_NOT_SAY__' }));
        // User can freely edit dial code and currency when they prefer not to say.
      } else {
        const found = countries.find((c) => c.name === value);
        if (found) {
          setDialCode(found.country_code || '+00');
          setForm((f) => ({
            ...f,
            country: found.name,
            currency: found.default_currency || f.currency,
          }));
        }
      }
    } else if (name === 'dialCode') {
      // Only allow manual dial code editing when no concrete country is selected.
      if (!form.country || form.country === '__PREFER_NOT_SAY__') {
        setDialCode(value);
      }
    } else {
      setForm((f) => ({ ...f, [name]: value }));
    }

    if (error) setError(null);
  };

  useEffect(() => {
    apiFetch('/api/metadata/countries')
      .then((d) => setCountries(d.countries || []))
      .catch(() => {});
    apiFetch('/api/metadata/currencies')
      .then((d) => setCurrencies(d.currencies || []))
      .catch(() => {});

    const region = resolveLocaleDefaults();
    // When countries arrive, choose a sensible default based on locale.
    // Fallback to India / INR.
    apiFetch('/api/metadata/countries')
      .then((d) => {
        const all = d.countries || [];
        setCountries(all);
        let defaultCountry = all.find((c) => c.name === 'India');
        if (region === 'IN') {
          defaultCountry =
            all.find((c) => c.name === 'India') || defaultCountry;
        } else if (region === 'US') {
          defaultCountry =
            all.find((c) => c.name === 'United States') || defaultCountry;
        } else if (region === 'GB') {
          defaultCountry =
            all.find((c) => c.name === 'United Kingdom') || defaultCountry;
        } else if (region === 'CA') {
          defaultCountry =
            all.find((c) => c.name === 'Canada') || defaultCountry;
        } else if (region === 'AU') {
          defaultCountry =
            all.find((c) => c.name === 'Australia') || defaultCountry;
        } else if (region === 'SG') {
          defaultCountry =
            all.find((c) => c.name === 'Singapore') || defaultCountry;
        }

        if (defaultCountry) {
          setDialCode(defaultCountry.country_code || '+91');
          setForm((f) => ({
            ...f,
            country: defaultCountry.name,
            currency: defaultCountry.default_currency || 'INR',
          }));
        } else {
          setDialCode('+91');
          setForm((f) => ({
            ...f,
            country: 'India',
            currency: 'INR',
          }));
        }
      })
      .catch(() => {
        // Fallback if options call fails
        setDialCode('+91');
        setForm((f) => ({
          ...f,
          country: 'India',
          currency: 'INR',
        }));
      });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const phoneDigits = (form.contact_local || '').replace(/[^\d]/g, '');
    if (phoneDigits && (phoneDigits.length < 7 || phoneDigits.length > 15)) {
      setError('Please enter a valid phone number.');
      return;
    }

    if (form.security_question && !form.security_answer) {
      setError('Please provide an answer for the selected security question.');
      return;
    }

    const payload = {
      email_id: form.email_id,
      password: form.password,
      security_question: form.security_question || null,
      security_answer: form.security_answer || null,
      first_name: form.first_name,
      last_name: form.last_name,
      dob: form.dob || null,
      contact: phoneDigits ? `${dialCode}${phoneDigits}` : null,
      country:
        !form.country || form.country === '__PREFER_NOT_SAY__'
          ? null
          : form.country,
      currency: form.currency || 'INR',
    };

    setSubmitting(true);
    try {
      await register(payload);
    } catch (err) {
      const msg = Array.isArray(err.detail)
        ? err.detail.map((e) => e.msg || e.loc?.join('.')).join(', ')
        : err.detail || err.error || 'Registration failed';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        maxWidth: 500,
        margin: '2rem auto',
        padding: '2rem',
        border: '1px solid #ddd',
        borderRadius: 8,
      }}
    >
      <h1>Register</h1>
      {error && (
        <div style={{ color: 'red', marginBottom: '0.5rem' }}>{error}</div>
      )}
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <div style={{ flex: 1 }}>
            <label>
              First name <span style={{ color: 'red' }}>*</span>
              <input
                name="first_name"
                value={form.first_name}
                onChange={handleChange}
                required
                style={{ width: '100%', padding: '0.5rem', marginTop: 4 }}
              />
            </label>
          </div>
          <div style={{ flex: 1 }}>
            <label>
              Last name <span style={{ color: 'red' }}>*</span>
              <input
                name="last_name"
                value={form.last_name}
                onChange={handleChange}
                required
                style={{ width: '100%', padding: '0.5rem', marginTop: 4 }}
              />
            </label>
          </div>
        </div>
        <div style={{ marginTop: '0.75rem' }}>
          <label>
            Email <span style={{ color: 'red' }}>*</span>
            <input
              type="email"
              name="email_id"
              value={form.email_id}
              onChange={handleChange}
              required
              style={{ width: '100%', padding: '0.5rem', marginTop: 4 }}
            />
          </label>
        </div>
        <div style={{ marginTop: '0.75rem' }}>
          <label>
            Password <span style={{ color: 'red' }}>*</span>
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              required
              style={{ width: '100%', padding: '0.5rem', marginTop: 4 }}
            />
          </label>
          <PasswordRequirements password={form.password} />
        </div>
        <div style={{ marginTop: '0.75rem' }}>
          <label>
            Security question
            <select
              name="security_question"
              value={form.security_question}
              onChange={handleChange}
              style={{ width: '100%', padding: '0.5rem', marginTop: 4 }}
            >
              <option value="">— Select a question (optional) —</option>
              {SECURITY_QUESTIONS.map((q) => (
                <option key={q} value={q}>
                  {q}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div style={{ marginTop: '0.75rem' }}>
          <label>
            Answer to security question
            <input
              name="security_answer"
              value={form.security_answer}
              onChange={handleChange}
              style={{ width: '100%', padding: '0.5rem', marginTop: 4 }}
            />
          </label>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
          <div style={{ flex: 1 }}>
            <label>
              Date of birth
              <input
                type="date"
                name="dob"
                value={form.dob}
                onChange={handleChange}
                style={{ width: '100%', padding: '0.5rem', marginTop: 4 }}
              />
            </label>
          </div>
          <div style={{ flex: 1 }}>
            <label>
              Contact (phone)
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: 4 }}>
                <input
                  type="text"
                  name="dialCode"
                  value={dialCode}
                  onChange={handleChange}
                  readOnly={
                    !!form.country && form.country !== '__PREFER_NOT_SAY__'
                  }
                  style={{
                    width: '4rem',
                    padding: '0.5rem',
                    background:
                      form.country && form.country !== '__PREFER_NOT_SAY__'
                        ? '#f5f5f5'
                        : 'white',
                  }}
                />
                <input
                  type="tel"
                  name="contact_local"
                  value={form.contact_local}
                  onChange={handleChange}
                  placeholder="Phone number (optional)"
                  style={{ flex: 1, padding: '0.5rem' }}
                />
              </div>
            </label>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
          <div style={{ flex: 1 }}>
            <label>
              Country
              <select
                name="country"
                value={form.country}
                onChange={handleChange}
                style={{ width: '100%', padding: '0.5rem', marginTop: 4 }}
              >
                <option value="">— Select country —</option>
                <option value="__PREFER_NOT_SAY__">Rather not say</option>
                {countries.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div style={{ flex: 1 }}>
            <label>
              Currency
              <select
                name="currency"
                value={form.currency}
                onChange={handleChange}
                style={{ width: '100%', padding: '0.5rem', marginTop: 4 }}
              >
                <option value="">— Select currency —</option>
                {currencies.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <button
          type="submit"
          disabled={
            submitting ||
            (form.password && !validatePassword(form.password).isValid)
          }
          style={{ marginTop: '1rem', width: '100%', padding: '0.5rem' }}
        >
          {submitting ? 'Registering...' : 'Register'}
        </button>
      </form>
      <p style={{ marginTop: '1rem' }}>
        Already have an account? <Link to="/login">Login</Link>
      </p>
    </div>
  );
}
