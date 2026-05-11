import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../utils/apiClient.js';

export function ProfileTab() {
  const [user, setUser] = useState(null);
  const [form, setForm] = useState({});
  const [saved, setSaved] = useState(false);
  const [countries, setCountries] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [error, setError] = useState(null);
  const [dialCode, setDialCode] = useState('+91');
  const [passwordForm, setPasswordForm] = useState({ current_password: '', new_password: '' });
  const [passwordStatus, setPasswordStatus] = useState(null);
  const [recoveryQuestions, setRecoveryQuestions] = useState([]);
  const [newRecovery, setNewRecovery] = useState({ question: '', answer: '' });
  const [questionHover, setQuestionHover] = useState(false);

  const SECURITY_QUESTIONS = [
    'What was the name of your first school?',
    'What is the name of your favorite childhood friend?',
    'What is your mother’s maiden name?',
    'What was the name of your first pet?',
    'What city were you born in?',
    'What is your favorite teacher’s name?'
  ];

  useEffect(() => {
    apiFetch('/api/users/me')
      .then((d) => {
        setUser(d.user);
        const contact = d.user?.contact ?? '';
        const country = d.user?.country ?? '';
        const currency = d.user?.currency ?? '';
        const initialDial = '+91';

        let localContact = '';
        if (contact && contact.startsWith('+')) {
          if (contact.startsWith(initialDial)) {
            localContact = contact.slice(initialDial.length);
          } else {
            localContact = contact.replace(/^\+\d{1,4}/, '');
          }
        }

        setDialCode(initialDial);
        setForm({
          first_name: d.user?.first_name ?? '',
          last_name: d.user?.last_name ?? '',
          dob: d.user?.dob ?? '',
          email_id: d.user?.email_id ?? '',
          contact_local: localContact,
          country,
          currency
        });
      })
      .catch(() => {});

    apiFetch('/api/options/countries').then((d) => setCountries(d.countries || [])).catch(() => {});
    apiFetch('/api/options/currencies').then((d) => setCurrencies(d.currencies || [])).catch(() => {});
    apiFetch('/api/auth/recovery').then((d) => setRecoveryQuestions(d.questions || [])).catch(() => {});
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'country') {
      if (value === '__PREFER_NOT_SAY__') {
        setForm((f) => ({ ...f, country: '__PREFER_NOT_SAY__' }));
      } else {
        const found = countries.find((c) => c.name === value);
        if (found) {
          setDialCode(found.country_code || '+00');
          setForm((f) => ({ ...f, country: found.name }));
        }
      }
    } else if (name === 'dialCode') {
      if (!form.country || form.country === '__PREFER_NOT_SAY__') {
        setDialCode(value);
      }
    } else {
      setForm((f) => ({ ...f, [name]: value }));
    }
    setSaved(false);
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    const phoneDigits = (form.contact_local || '').replace(/[^\d]/g, '');
    if (phoneDigits && (phoneDigits.length < 7 || phoneDigits.length > 15)) {
      setError('Please enter a valid phone number.');
      return;
    }

    const contactValue = phoneDigits ? `${dialCode}${phoneDigits}` : null;
    try {
      await apiFetch('/api/users/me', {
        method: 'PATCH',
        body: JSON.stringify({
          first_name: form.first_name,
          last_name: form.last_name,
          dob: form.dob || null,
          contact: contactValue,
          country: !form.country || form.country === '__PREFER_NOT_SAY__' ? null : form.country,
          currency: form.currency || null
        })
      });
      setSaved(true);
    } catch (err) {
      setError(err.detail || err.error || 'Failed to save');
    }
  };

  if (!user) return <p>Loading...</p>;

  return (
    <>
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gap: '0.75rem', maxWidth: 400 }}>
          <label>
            First name <span style={{ color: 'red' }}>*</span>
            <input name="first_name" value={form.first_name} onChange={handleChange} required style={{ width: '100%', padding: '0.5rem', marginTop: 4 }} />
          </label>
          <label>
            Last name <span style={{ color: 'red' }}>*</span>
            <input name="last_name" value={form.last_name} onChange={handleChange} required style={{ width: '100%', padding: '0.5rem', marginTop: 4 }} />
          </label>
          <label>
            Date of birth
            <input type="date" name="dob" value={form.dob} onChange={handleChange} style={{ width: '100%', padding: '0.5rem', marginTop: 4 }} />
          </label>
          <label>
            Email (read-only)
            <input type="email" name="email_id" value={form.email_id} readOnly style={{ width: '100%', padding: '0.5rem', marginTop: 4, background: '#f5f5f5' }} />
          </label>
          <label>
            Contact (phone)
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: 4 }}>
              <input
                type="text"
                name="dialCode"
                value={dialCode}
                onChange={handleChange}
                readOnly={!!form.country && form.country !== '__PREFER_NOT_SAY__'}
                style={{ width: '4rem', padding: '0.5rem', background: form.country && form.country !== '__PREFER_NOT_SAY__' ? '#f5f5f5' : 'white' }}
              />
              <input type="tel" name="contact_local" value={form.contact_local || ''} onChange={handleChange} placeholder="Phone number (optional)" style={{ flex: 1, padding: '0.5rem' }} />
            </div>
          </label>
          <label>
            Country
            <select name="country" value={form.country} onChange={handleChange} style={{ width: '100%', padding: '0.5rem', marginTop: 4 }}>
              <option value="">— Select country —</option>
              <option value="__PREFER_NOT_SAY__">Rather not say</option>
              {countries.map((c) => (
                <option key={c.name} value={c.name}>{c.name}</option>
              ))}
            </select>
          </label>
          <label>
            Currency
            <select name="currency" value={form.currency} onChange={handleChange} style={{ width: '100%', padding: '0.5rem', marginTop: 4 }}>
              <option value="">— Select currency —</option>
              {currencies.map((c) => (
                <option key={c.code} value={c.code}>{c.label}</option>
              ))}
            </select>
          </label>
          {error && <div style={{ color: 'red' }}>{error}</div>}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button type="submit" style={{ padding: '0.5rem 1rem' }}>Save</button>
            {saved && <span style={{ color: 'green' }}>Saved</span>}
          </div>
        </div>
      </form>

      <div style={{ marginTop: '2rem', maxWidth: 400 }}>
        <h3>Change password</h3>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setPasswordStatus(null);
            try {
              await apiFetch('/api/auth/change-password', {
                method: 'POST',
                body: JSON.stringify(passwordForm)
              });
              setPasswordStatus('Password updated successfully.');
              setPasswordForm({ current_password: '', new_password: '' });
            } catch (err) {
              setPasswordStatus(err.detail || err.error || 'Failed to change password');
            }
          }}
        >
          <label>
            Current password <span style={{ color: 'red' }}>*</span>
            <input
              type="password"
              name="current_password"
              value={passwordForm.current_password}
              onChange={(e) => setPasswordForm((f) => ({ ...f, current_password: e.target.value }))}
              required
              style={{ width: '100%', padding: '0.5rem', marginTop: 4 }}
            />
          </label>
          <label>
            New password <span style={{ color: 'red' }}>*</span>
            <input
              type="password"
              name="new_password"
              value={passwordForm.new_password}
              onChange={(e) => setPasswordForm((f) => ({ ...f, new_password: e.target.value }))}
              required
              style={{ width: '100%', padding: '0.5rem', marginTop: 4 }}
            />
          </label>
          <button type="submit" style={{ marginTop: '0.75rem', padding: '0.5rem 1rem' }}>
            Update password
          </button>
          {passwordStatus && (
            <div style={{ marginTop: '0.5rem', color: passwordStatus.includes('successfully') ? 'green' : 'red' }}>
              {passwordStatus}
            </div>
          )}
        </form>
      </div>

      <div style={{ marginTop: '2rem', maxWidth: 500 }}>
        <h3>Security questions</h3>
        <p style={{ color: '#666', marginBottom: '0.5rem' }}>
          You can add multiple security questions for account recovery. Answers are stored securely and are not shown again.
        </p>
        {recoveryQuestions.length > 0 && (
          <ul style={{ paddingLeft: '1.25rem', marginBottom: '0.75rem' }}>
            {recoveryQuestions.map((q) => (
              <li key={q.uid} style={{ marginBottom: '0.25rem' }}>{q.question}</li>
            ))}
          </ul>
        )}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!newRecovery.question.trim() || !newRecovery.answer.trim()) {
              setPasswordStatus('Question and answer are required');
              return;
            }
            try {
              await apiFetch('/api/auth/recovery', {
                method: 'POST',
                body: JSON.stringify(newRecovery)
              });
              const refreshed = await apiFetch('/api/auth/recovery');
              setRecoveryQuestions(refreshed.questions || []);
              setNewRecovery({ question: '', answer: '' });
            } catch (err) {
              setPasswordStatus(err.detail || err.error || 'Failed to add security question');
            }
          }}
        >
          <label>
            New security question
            <div
              style={{
                marginTop: 4,
                border: '1px solid #ddd',
                borderRadius: 6,
                padding: '0.25rem',
                background: questionHover ? '#f9fafb' : 'white'
              }}
              onMouseEnter={() => setQuestionHover(true)}
              onMouseLeave={() => setQuestionHover(false)}
            >
              <select
                name="question"
                value={newRecovery.question}
                onChange={(e) => setNewRecovery((f) => ({ ...f, question: e.target.value }))}
                style={{ width: '100%', padding: '0.5rem', border: 'none', outline: 'none', background: 'transparent' }}
              >
                <option value="">— Select a question —</option>
                {SECURITY_QUESTIONS.map((q) => (
                  <option key={q} value={q}>
                    {q}
                  </option>
                ))}
              </select>
            </div>
          </label>
          <label>
            Answer
            <input
              name="answer"
              value={newRecovery.answer}
              onChange={(e) => setNewRecovery((f) => ({ ...f, answer: e.target.value }))}
              style={{ width: '100%', padding: '0.5rem', marginTop: 4 }}
            />
          </label>
          <button type="submit" style={{ marginTop: '0.75rem', padding: '0.5rem 1rem' }}>
            Add security question
          </button>
        </form>
      </div>
    </>
  );
}

