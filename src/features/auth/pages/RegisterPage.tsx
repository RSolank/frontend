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
        <div className="form-error" style={{ marginBottom: '0.5rem' }}>
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <div style={{ flex: 1 }}>
            <label htmlFor="register-first-name" className="form-label">
              First name <span style={{ color: 'red' }}>*</span>
            </label>
            <input
              id="register-first-name"
              name="first_name"
              value={form.first_name}
              onChange={handleChange}
              required
              className="form-input"
            />
          </div>
          <div style={{ flex: 1 }}>
            <label htmlFor="register-last-name" className="form-label">
              Last name <span style={{ color: 'red' }}>*</span>
            </label>
            <input
              id="register-last-name"
              name="last_name"
              value={form.last_name}
              onChange={handleChange}
              required
              className="form-input"
            />
          </div>
        </div>
        <div style={{ marginTop: '0.75rem' }}>
          <label htmlFor="register-email" className="form-label">
            Email <span style={{ color: 'red' }}>*</span>
          </label>
          <input
            id="register-email"
            type="email"
            name="email_id"
            value={form.email_id}
            onChange={handleChange}
            required
            className="form-input"
          />
        </div>
        <div style={{ marginTop: '0.75rem' }}>
          <label htmlFor="register-password" className="form-label">
            Password <span style={{ color: 'red' }}>*</span>
          </label>
          <input
            id="register-password"
            type="password"
            name="password"
            value={form.password}
            onChange={handleChange}
            required
            className="form-input"
          />
          <PasswordRequirements password={form.password} />
        </div>
        <div style={{ marginTop: '0.75rem' }}>
          <label htmlFor="register-security-question" className="form-label">
            Security question
          </label>
          <select
            id="register-security-question"
            name="security_question"
            value={form.security_question}
            onChange={handleChange}
            className="form-input"
          >
            <option value="">— Select a question (optional) —</option>
            {SECURITY_QUESTIONS.map((q) => (
              <option key={q} value={q}>
                {q}
              </option>
            ))}
          </select>
        </div>
        <div style={{ marginTop: '0.75rem' }}>
          <label htmlFor="register-security-answer" className="form-label">
            Answer to security question
          </label>
          <input
            id="register-security-answer"
            name="security_answer"
            value={form.security_answer}
            onChange={handleChange}
            className="form-input"
          />
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
          <div style={{ flex: 1 }}>
            <label htmlFor="register-dob" className="form-label">
              Date of birth
            </label>
            <input
              id="register-dob"
              type="date"
              name="dob"
              value={form.dob}
              onChange={handleChange}
              className="form-input"
            />
          </div>
          <div style={{ flex: 1 }}>
            <label htmlFor="register-contact" className="form-label">
              Contact (phone)
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                name="dialCode"
                aria-label="Dial code"
                value={dialCode}
                onChange={handleChange}
                readOnly={countryLocked}
                className="form-input"
                style={{ width: '4.5rem' }}
              />
              <input
                id="register-contact"
                type="tel"
                name="contact_local"
                value={form.contact_local}
                onChange={handleChange}
                placeholder="Phone number (optional)"
                className="form-input"
                style={{ flex: 1 }}
              />
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
          <div style={{ flex: 1 }}>
            <label htmlFor="register-country" className="form-label">
              Country
            </label>
            <select
              id="register-country"
              name="country"
              value={form.country}
              onChange={handleChange}
              className="form-input"
            >
              <option value="">— Select country —</option>
              <option value={PREFER_NOT_SAY}>Rather not say</option>
              {countries.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label htmlFor="register-currency" className="form-label">
              Currency
            </label>
            <select
              id="register-currency"
              name="currency"
              value={form.currency}
              onChange={handleChange}
              className="form-input"
            >
              <option value="">— Select currency —</option>
              {currencies.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div style={{ marginTop: '0.75rem' }}>
          <label htmlFor="register-timezone" className="form-label">
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
