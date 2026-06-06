import { useEffect, useState } from 'react';

import {
  fetchCountries,
  type CountryOption,
} from '../../../shared/api/referenceData';
import {
  COUNTRY_PREFER_NOT_SAY,
  CountrySelect,
} from '../../../shared/components/CountrySelect';
import { DateField } from '../../../shared/components/DateField';
import { PasswordRequirements } from '../../../shared/components/PasswordRequirements';
import { TimezoneSelect } from '../../../shared/components/TimezoneSelect';
import { SECURITY_QUESTIONS } from '../../../shared/constants/securityQuestions';
import { useAuthStore } from '../../../shared/state/auth.store';
import {
  getBrowserRegion,
  getBrowserTimezone,
  getCountryNameFromRegion,
} from '../../../shared/utils/countryTimezones';
import { validatePassword } from '../../../shared/utils/validation';
import { useAuth } from '../state/useAuth';

import { AuthErrorNotice } from './AuthErrorNotice';

const PREFER_NOT_SAY = COUNTRY_PREFER_NOT_SAY;

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
  timezone: '',
};

interface RegisterFormProps {
  onSuccess?: () => void;
  onSwitchToLogin?: () => void;
  hideLoginPrompt?: boolean;
}

// Cross-field validation the inputs' own `required`/type attributes can't
// express. Returns an error message, or null when the form is submittable.
function validateRegistration(form: FormState): string | null {
  const phoneDigits = (form.contact_local || '').replace(/[^\d]/g, '');
  if (phoneDigits && (phoneDigits.length < 7 || phoneDigits.length > 15)) {
    return 'Please enter a valid phone number.';
  }
  if (form.security_question && !form.security_answer) {
    return 'Please provide an answer for the selected security question.';
  }
  if (!form.timezone) {
    return 'Please select a timezone.';
  }
  return null;
}

// Map the local form state to the register API payload — normalising
// optional fields to null and composing the E.164-ish contact number.
function buildRegisterPayload(form: FormState, dialCode: string) {
  const phoneDigits = (form.contact_local || '').replace(/[^\d]/g, '');
  return {
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
    timezone: form.timezone,
  };
}

// View-model: owns every piece of register-form state plus the
// country/currency/timezone inference effect and the change/submit
// handlers, so the component stays a flat field layout. Validation and
// payload-shaping live in the pure helpers above to keep handleSubmit
// under the complexity gate.
function useRegisterForm(onSuccess?: () => void) {
  const { register, error, setError } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [dialCode, setDialCode] = useState('+91');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const countriesResp = await fetchCountries();
        if (cancelled) return;

        const allCountries = countriesResp.countries ?? [];
        setCountries(allCountries);

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
          const fallbackTz = matched.timezones?.[0] || getBrowserTimezone();
          setForm((f) => ({
            ...f,
            country: matched.name,
            timezone: fallbackTz,
          }));
        } else {
          setForm((f) => ({ ...f, timezone: getBrowserTimezone() }));
        }
      } catch {
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
  const countryLocked = !!form.country && form.country !== PREFER_NOT_SAY;

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    const { name, value } = e.target;
    if (name === 'dialCode') {
      if (!form.country || form.country === PREFER_NOT_SAY) {
        setDialCode(value);
      }
    } else {
      setForm((f) => ({ ...f, [name]: value }));
    }
    if (error) setError(null);
  }

  function handleCountryChange(value: string, country: CountryOption | null) {
    if (country) {
      setDialCode(country.country_code || '+00');
      const tz = country.timezones?.[0] || getBrowserTimezone();
      setForm((f) => ({
        ...f,
        country: country.name,
        timezone: tz,
      }));
    } else {
      setForm((f) => ({
        ...f,
        country: value,
        timezone: f.timezone || getBrowserTimezone(),
      }));
    }
    if (error) setError(null);
  }

  function handleTimezoneChange(timezone: string) {
    setForm((f) => ({ ...f, timezone }));
    if (error) setError(null);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const validationError = validateRegistration(form);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    try {
      await register(buildRegisterPayload(form, dialCode));
      onSuccess?.();
    } catch {
      // Error pushed into the store by useAuth.register
    } finally {
      setSubmitting(false);
    }
  }

  return {
    error,
    form,
    dialCode,
    countries,
    submitting,
    currentCountry,
    countryLocked,
    handleChange,
    handleCountryChange,
    handleTimezoneChange,
    handleSubmit,
  };
}

interface RegisterFieldsProps {
  form: FormState;
  dialCode: string;
  countries: CountryOption[];
  currentCountry: CountryOption | null;
  countryLocked: boolean;
  onChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => void;
  onCountryChange: (value: string, country: CountryOption | null) => void;
  onTimezoneChange: (timezone: string) => void;
}

// The register form's field layout — purely presentational. Split out from
// RegisterForm so the form component stays a thin orchestration shell
// (error banner + <form> + submit + login prompt) under the max-lines gate.
function RegisterFields({
  form,
  dialCode,
  countries,
  currentCountry,
  countryLocked,
  onChange,
  onCountryChange,
  onTimezoneChange,
}: RegisterFieldsProps) {
  return (
    <>
      <div className="flex gap-2">
        <div className="flex-1">
          <label htmlFor="register-first-name" className="form-label">
            First name <span style={{ color: 'red' }}>*</span>
          </label>
          <input
            id="register-first-name"
            name="first_name"
            value={form.first_name}
            onChange={onChange}
            required
            className="form-input"
          />
        </div>
        <div className="flex-1">
          <label htmlFor="register-last-name" className="form-label">
            Last name <span style={{ color: 'red' }}>*</span>
          </label>
          <input
            id="register-last-name"
            name="last_name"
            value={form.last_name}
            onChange={onChange}
            required
            className="form-input"
          />
        </div>
      </div>
      <div className="mt-3">
        <label htmlFor="register-email" className="form-label">
          Email <span style={{ color: 'red' }}>*</span>
        </label>
        <input
          id="register-email"
          type="email"
          name="email_id"
          autoComplete="username"
          value={form.email_id}
          onChange={onChange}
          required
          className="form-input"
        />
      </div>
      <div className="mt-3">
        <label htmlFor="register-password" className="form-label">
          Password <span style={{ color: 'red' }}>*</span>
        </label>
        <input
          id="register-password"
          type="password"
          name="password"
          autoComplete="new-password"
          value={form.password}
          onChange={onChange}
          required
          className="form-input"
        />
        <PasswordRequirements password={form.password} />
      </div>
      <div className="mt-3">
        <label htmlFor="register-security-question" className="form-label">
          Security question
        </label>
        <select
          id="register-security-question"
          name="security_question"
          value={form.security_question}
          onChange={onChange}
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
      <div className="mt-3">
        <label htmlFor="register-security-answer" className="form-label">
          Answer to security question
        </label>
        <input
          id="register-security-answer"
          name="security_answer"
          value={form.security_answer}
          onChange={onChange}
          className="form-input"
        />
      </div>
      <div className="mt-3 flex gap-2">
        <div className="flex-1">
          <label htmlFor="register-dob" className="form-label">
            Date of birth
          </label>
          <DateField
            id="register-dob"
            name="dob"
            value={form.dob}
            onChange={(next) =>
              onChange({
                target: { name: 'dob', value: next },
              } as React.ChangeEvent<HTMLInputElement>)
            }
          />
        </div>
        <div className="flex-1">
          <label htmlFor="register-contact" className="form-label">
            Contact (phone)
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              name="dialCode"
              aria-label="Dial code"
              value={dialCode}
              onChange={onChange}
              readOnly={countryLocked}
              className="form-input w-[4.5rem]"
            />
            <input
              id="register-contact"
              type="tel"
              name="contact_local"
              value={form.contact_local}
              onChange={onChange}
              placeholder="Phone number (optional)"
              className="form-input flex-1"
            />
          </div>
        </div>
      </div>
      <div className="mt-3">
        <label htmlFor="register-country" className="form-label">
          Country
        </label>
        <CountrySelect
          id="register-country"
          value={form.country}
          onChange={onCountryChange}
          countries={countries}
        />
      </div>
      <div className="mt-3">
        <label htmlFor="register-timezone" className="form-label">
          Timezone <span style={{ color: 'red' }}>*</span>
        </label>
        <TimezoneSelect
          id="register-timezone"
          countryName={currentCountry ? currentCountry.name : null}
          countryDefaultTimezone={currentCountry?.timezones?.[0] ?? null}
          value={form.timezone}
          onChange={onTimezoneChange}
          required
        />
      </div>
    </>
  );
}

// Shared register form body. Mounted by both the RegisterPage route and
// the RegisterModal on Home — see CONTRIBUTING.md §6 "Modal pattern".
export function RegisterForm({
  onSuccess,
  onSwitchToLogin,
  hideLoginPrompt = false,
}: RegisterFormProps) {
  const {
    error,
    form,
    dialCode,
    countries,
    submitting,
    currentCountry,
    countryLocked,
    handleChange,
    handleCountryChange,
    handleTimezoneChange,
    handleSubmit,
  } = useRegisterForm(onSuccess);
  const retryAfterSeconds = useAuthStore((s) => s.retryAfterSeconds);

  return (
    <>
      <AuthErrorNotice
        error={error}
        retryAfterSeconds={retryAfterSeconds}
        action="registration"
      />
      <form onSubmit={handleSubmit}>
        <RegisterFields
          form={form}
          dialCode={dialCode}
          countries={countries}
          currentCountry={currentCountry}
          countryLocked={countryLocked}
          onChange={handleChange}
          onCountryChange={handleCountryChange}
          onTimezoneChange={handleTimezoneChange}
        />
        <button
          type="submit"
          disabled={
            submitting ||
            (form.password.length > 0 &&
              !validatePassword(form.password).isValid)
          }
          className="btn-primary mt-4"
        >
          {submitting ? 'Registering...' : 'Register'}
        </button>
      </form>
      {!hideLoginPrompt && onSwitchToLogin && (
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
          Already have an account?{' '}
          <button type="button" onClick={onSwitchToLogin} className="btn-link">
            Login
          </button>
        </p>
      )}
    </>
  );
}
