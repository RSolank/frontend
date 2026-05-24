import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { PasswordRequirements } from '../../../shared/components/PasswordRequirements';
import { apiFetch } from '../../../shared/api/apiClient';
import {
  getBrowserRegion,
  getBrowserTimezone,
  getCountryNameFromRegion,
  getTimezonesForCountryName,
} from '../../../shared/utils/countryTimezones';
import { validatePassword } from '../../../shared/utils/validation';
import { TimezoneSelect } from '../../metadata/components/TimezoneSelect';
import { useAuth } from '../state/useAuth';

interface CountryOption {
  name: string;
  country_code?: string | null;
  default_currency?: string | null;
  timezone?: string | null;
}

interface CurrencyOption {
  code: string;
  label: string;
  symbol?: string | null;
}

const PREFER_NOT_SAY = '__PREFER_NOT_SAY__';

const SECURITY_QUESTIONS = [
  'What was the name of your first school?',
  'What is the name of your favorite childhood friend?',
  'What is your mother’s maiden name?',
  'What was the name of your first pet?',
  'What city were you born in?',
  'What is your favorite teacher’s name?',
];

interface FormState {
  email_id: string;
  password: string;
  security_question: string;
  security_answer: string;
  first_name: string;
  last_name: string;
  dob: string;
  contact_local: string;
  country: string;
  currency: string;
  timezone: string;
}

const INITIAL_FORM: FormState = {
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
  timezone: '',
};

export function RegisterPage() {
  const { register, error, setError } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [currencies, setCurrencies] = useState<CurrencyOption[]>([]);
  const [dialCode, setDialCode] = useState('+91');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [countriesResp, currenciesResp] = await Promise.all([
          apiFetch<{ countries?: CountryOption[] }>('/api/metadata/countries'),
          apiFetch<{ currencies?: CurrencyOption[] }>('/api/metadata/currencies'),
        ]);
        if (cancelled) return;

        const allCountries = countriesResp.countries ?? [];
        setCountries(allCountries);
        setCurrencies(currenciesResp.currencies ?? []);

        // Locale-driven default — replaces the legacy 6-country hardcoded
        // switch with Intl.DisplayNames covering all ~250 regions.
        const region = getBrowserRegion();
        const regionName = region ? getCountryNameFromRegion(region) : null;
        const matched =
          (regionName &&
            allCountries.find(
              (c) => c.name.toLowerCase() === regionName.toLowerCase()
            )) ||
          allCountries.find((c) => c.name === 'India') ||
          allCountries[0];

        if (matched) {
          setDialCode(matched.country_code || '+91');
          const fallbackTz =
            matched.timezone ||
            getTimezonesForCountryName(matched.name)[0] ||
            getBrowserTimezone();
          setForm((f) => ({
            ...f,
            country: matched.name,
            currency: matched.default_currency || f.currency || 'INR',
            timezone: fallbackTz,
          }));
        } else {
          setForm((f) => ({
            ...f,
            timezone: getBrowserTimezone(),
          }));
        }
      } catch {
        // Best-effort: leave the form blank and let the user fill it.
        if (!cancelled) {
          setForm((f) => ({
            ...f,
            timezone: f.timezone || getBrowserTimezone(),
          }));
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const currentCountry =
    form.country && form.country !== PREFER_NOT_SAY
      ? countries.find((c) => c.name === form.country) || null
      : null;

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    const { name, value } = e.target;

    if (name === 'country') {
      if (value === PREFER_NOT_SAY) {
        setForm((f) => ({
          ...f,
          country: PREFER_NOT_SAY,
          timezone: f.timezone || getBrowserTimezone(),
        }));
      } else {
        const found = countries.find((c) => c.name === value);
        if (found) {
          setDialCode(found.country_code || '+00');
          const tz =
            found.timezone ||
            getTimezonesForCountryName(found.name)[0] ||
            getBrowserTimezone();
          setForm((f) => ({
            ...f,
            country: found.name,
            currency: found.default_currency || f.currency,
            timezone: tz,
          }));
        } else {
          setForm((f) => ({ ...f, country: value }));
        }
      }
    } else if (name === 'dialCode') {
      if (!form.country || form.country === PREFER_NOT_SAY) {
        setDialCode(value);
      }
    } else {
      setForm((f) => ({ ...f, [name]: value }));
    }

    if (error) setError(null);
  }

  function handleTimezoneChange(timezone: string) {
    setForm((f) => ({ ...f, timezone }));
    if (error) setError(null);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
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

    if (!form.timezone) {
      setError('Please select a timezone.');
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
        !form.country || form.country === PREFER_NOT_SAY ? null : form.country,
      currency: form.currency || 'INR',
      timezone: form.timezone,
    };

    setSubmitting(true);
    try {
      await register(payload);
    } catch {
      // Error pushed into the store by useAuth.register
    } finally {
      setSubmitting(false);
    }
  }

  const countryLocked = !!form.country && form.country !== PREFER_NOT_SAY;

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
                  readOnly={countryLocked}
                  style={{
                    width: '4rem',
                    padding: '0.5rem',
                    background: countryLocked ? '#f5f5f5' : 'white',
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
                <option value={PREFER_NOT_SAY}>Rather not say</option>
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
        <div style={{ marginTop: '0.75rem' }}>
          <label htmlFor="register-timezone">
            Timezone <span style={{ color: 'red' }}>*</span>
          </label>
          <TimezoneSelect
            id="register-timezone"
            countryName={
              currentCountry ? currentCountry.name : null
            }
            countryDefaultTimezone={currentCountry?.timezone ?? null}
            value={form.timezone}
            onChange={handleTimezoneChange}
            required
          />
        </div>
        <button
          type="submit"
          disabled={
            submitting ||
            (form.password.length > 0 && !validatePassword(form.password).isValid)
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
