import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { hydratePreferences } from '../../auth/state/useAuth';
import {
  CountrySelect,
  COUNTRY_PREFER_NOT_SAY,
} from '../../metadata/components/CountrySelect';
import { CurrencySelect } from '../../metadata/components/CurrencySelect';
import { TimezoneSelect } from '../../metadata/components/TimezoneSelect';
import { useCountriesQuery, type CountryOption } from '../../metadata/api/queries';
import { PasswordRequirements } from '../../../shared/components/PasswordRequirements';
import {
  getBrowserTimezone,
  getTimezonesForCountryName,
} from '../../../shared/utils/countryTimezones';
import { validatePassword } from '../../../shared/utils/validation';
import { userKeys } from '../api/keys';
import {
  changePasswordRequest,
  setRecoveryQuestionRequest,
  updateProfileRequest,
} from '../api/mutations';
import {
  fetchCurrentUser,
  fetchRecoveryQuestions,
  type UserProfile,
} from '../api/queries';

const SECURITY_QUESTIONS = [
  'What was the name of your first school?',
  'What is the name of your favorite childhood friend?',
  'What is your mother’s maiden name?',
  'What was the name of your first pet?',
  'What city were you born in?',
  'What is your favorite teacher’s name?',
];

interface FormState {
  first_name: string;
  last_name: string;
  dob: string;
  email_id: string;
  contact_local: string;
  country: string;
  currency: string;
  timezone: string;
}

const INITIAL_FORM: FormState = {
  first_name: '',
  last_name: '',
  dob: '',
  email_id: '',
  contact_local: '',
  country: '',
  currency: '',
  timezone: '',
};

interface ApiErrorShape {
  detail?: string;
  error?: string;
}

function extractLocalContact(contact: string | null | undefined): string {
  if (!contact) return '';
  // Strip the leading dial code (1–4 digits after `+`). We don't bother
  // matching against the country's `country_code` field because some
  // legacy rows have inconsistent prefixes; the dropdown picks the
  // country's code anyway after the user makes a selection.
  return contact.startsWith('+') ? contact.replace(/^\+\d{1,4}/, '') : contact;
}

export function ProfilePage() {
  const queryClient = useQueryClient();
  const { data: countries = [] } = useCountriesQuery();

  const [user, setUser] = useState<UserProfile | null>(null);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [dialCode, setDialCode] = useState('+91');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
  });
  const [passwordStatus, setPasswordStatus] = useState<string | null>(null);

  const [recoveryQuestions, setRecoveryQuestions] = useState<
    { question: string }[]
  >([]);
  const [newRecovery, setNewRecovery] = useState({ question: '', answer: '' });
  const [recoveryStatus, setRecoveryStatus] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const { user: u } = await fetchCurrentUser();
        setUser(u);
        setDialCode('+91');
        setForm({
          first_name: u.first_name ?? '',
          last_name: u.last_name ?? '',
          dob: u.dob ?? '',
          email_id: u.email_id,
          contact_local: extractLocalContact(u.contact),
          country: u.country ?? '',
          currency: u.currency ?? '',
          timezone: u.timezone ?? getBrowserTimezone(),
        });
      } catch {
        // Best-effort: leave loading state in place.
      }

      try {
        const r = await fetchRecoveryQuestions();
        setRecoveryQuestions(r.questions ?? []);
      } catch {
        // Recovery list is optional context.
      }
    })();
  }, []);

  // When the countries list arrives after `u.country` is set, line up
  // the dial code with the persisted country (no-op if user has none).
  useEffect(() => {
    if (!form.country || form.country === COUNTRY_PREFER_NOT_SAY) return;
    const match = countries.find((c) => c.name === form.country);
    if (match?.country_code) setDialCode(match.country_code);
  }, [countries, form.country]);

  const currentCountry: CountryOption | null = useMemo(() => {
    if (!form.country || form.country === COUNTRY_PREFER_NOT_SAY) return null;
    return countries.find((c) => c.name === form.country) ?? null;
  }, [countries, form.country]);

  function handleCountryChange(value: string, country: CountryOption | null) {
    if (country) {
      setDialCode(country.country_code || '+00');
      const tz =
        country.timezone ||
        getTimezonesForCountryName(country.name)[0] ||
        getBrowserTimezone();
      setForm((f) => ({
        ...f,
        country: country.name,
        currency: country.default_currency || f.currency,
        timezone: tz,
      }));
    } else {
      setForm((f) => ({
        ...f,
        country: value,
        // Empty / prefer-not-say: keep the existing timezone if any,
        // otherwise fall back to the browser.
        timezone: f.timezone || getBrowserTimezone(),
      }));
    }
    setSaved(false);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const phoneDigits = (form.contact_local || '').replace(/[^\d]/g, '');
    if (phoneDigits && (phoneDigits.length < 7 || phoneDigits.length > 15)) {
      setError('Please enter a valid phone number.');
      return;
    }

    if (!form.timezone) {
      setError('Please select a timezone.');
      return;
    }

    const payload = {
      first_name: form.first_name,
      last_name: form.last_name,
      dob: form.dob || null,
      contact: phoneDigits ? `${dialCode}${phoneDigits}` : null,
      country:
        !form.country || form.country === COUNTRY_PREFER_NOT_SAY
          ? null
          : form.country,
      currency: form.currency || null,
      timezone: form.timezone,
    };

    try {
      await updateProfileRequest(payload);
      // Refresh /me and /preferences so every open tab + the
      // usePreferencesStore see the new currency / tz immediately.
      await queryClient.invalidateQueries({ queryKey: userKeys.all });
      await hydratePreferences();
      setSaved(true);
    } catch (err) {
      const e = err as ApiErrorShape;
      setError(e.detail || e.error || 'Failed to save');
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPasswordStatus(null);
    try {
      await changePasswordRequest(passwordForm);
      setPasswordStatus('Password updated successfully.');
      setPasswordForm({ current_password: '', new_password: '' });
    } catch (err) {
      const e = err as ApiErrorShape;
      setPasswordStatus(e.detail || e.error || 'Failed to change password');
    }
  }

  async function handleRecoverySubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!newRecovery.question.trim() || !newRecovery.answer.trim()) {
      setRecoveryStatus('Question and answer are required');
      return;
    }
    try {
      await setRecoveryQuestionRequest(newRecovery);
      const refreshed = await fetchRecoveryQuestions();
      setRecoveryQuestions(refreshed.questions ?? []);
      setNewRecovery({ question: '', answer: '' });
      setRecoveryStatus('Security question updated successfully.');
    } catch (err) {
      const e = err as ApiErrorShape;
      setRecoveryStatus(
        e.detail || e.error || 'Failed to update security question'
      );
    }
  }

  if (!user) return <p className="p-6 text-slate-600 dark:text-slate-300">Loading...</p>;

  const countryLocked =
    !!form.country && form.country !== COUNTRY_PREFER_NOT_SAY;

  return (
    <div className="mx-auto my-8 max-w-xl px-4">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            User Profile
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Manage your personal information and security settings
          </p>
        </div>
        <Link
          to="/dashboard"
          className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:outline-none dark:text-indigo-400 dark:hover:text-indigo-300 dark:focus-visible:ring-offset-slate-950"
        >
          ← Back to dashboard
        </Link>
      </header>

      <section className="rounded-xl bg-white p-6 shadow-sm dark:bg-slate-900 dark:shadow-none dark:ring-1 dark:ring-slate-800">
        <form onSubmit={handleSubmit}>
          <div className="grid gap-3">
            <div>
              <label htmlFor="profile-first-name" className="form-label">
                First name <span className="text-rose-600">*</span>
              </label>
              <input
                id="profile-first-name"
                name="first_name"
                value={form.first_name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, first_name: e.target.value }))
                }
                required
                className="form-input"
              />
            </div>
            <div>
              <label htmlFor="profile-last-name" className="form-label">
                Last name <span className="text-rose-600">*</span>
              </label>
              <input
                id="profile-last-name"
                name="last_name"
                value={form.last_name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, last_name: e.target.value }))
                }
                required
                className="form-input"
              />
            </div>
            <div>
              <label htmlFor="profile-dob" className="form-label">
                Date of birth
              </label>
              <input
                id="profile-dob"
                type="date"
                name="dob"
                value={form.dob}
                onChange={(e) =>
                  setForm((f) => ({ ...f, dob: e.target.value }))
                }
                className="form-input"
              />
            </div>
            <div>
              <label htmlFor="profile-email" className="form-label">
                Email (read-only)
              </label>
              <input
                id="profile-email"
                type="email"
                name="email_id"
                value={form.email_id}
                readOnly
                className="form-input"
              />
            </div>
            <div>
              <label htmlFor="profile-contact" className="form-label">
                Contact (phone)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  name="dialCode"
                  aria-label="Dial code"
                  value={dialCode}
                  onChange={(e) => {
                    if (!countryLocked) setDialCode(e.target.value);
                  }}
                  readOnly={countryLocked}
                  className="form-input"
                  style={{ width: '4.5rem' }}
                />
                <input
                  id="profile-contact"
                  type="tel"
                  name="contact_local"
                  value={form.contact_local}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, contact_local: e.target.value }))
                  }
                  placeholder="Phone number (optional)"
                  className="form-input"
                  style={{ flex: 1 }}
                />
              </div>
            </div>
            <div>
              <label htmlFor="profile-country" className="form-label">
                Country
              </label>
              <CountrySelect
                id="profile-country"
                value={form.country}
                onChange={handleCountryChange}
                countries={countries}
              />
            </div>
            <div>
              <label htmlFor="profile-currency" className="form-label">
                Currency
              </label>
              <CurrencySelect
                id="profile-currency"
                value={form.currency}
                onChange={(code) => {
                  setForm((f) => ({ ...f, currency: code }));
                  setSaved(false);
                  setError(null);
                }}
              />
            </div>
            <div>
              <label htmlFor="profile-timezone" className="form-label">
                Timezone <span className="text-rose-600">*</span>
              </label>
              <TimezoneSelect
                id="profile-timezone"
                countryName={currentCountry?.name ?? null}
                countryDefaultTimezone={currentCountry?.timezone ?? null}
                value={form.timezone}
                onChange={(tz) => {
                  setForm((f) => ({ ...f, timezone: tz }));
                  setSaved(false);
                  setError(null);
                }}
                required
              />
            </div>
            {error && <div className="form-error">{error}</div>}
            <div className="flex items-center gap-3">
              <button type="submit" className="btn-primary !w-auto">
                Save
              </button>
              {saved && (
                <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                  Saved
                </span>
              )}
            </div>
          </div>
        </form>

        <div className="mt-10 border-t border-slate-200 pt-8 dark:border-slate-800">
          <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100">
            Change password
          </h2>
          <form onSubmit={handlePasswordSubmit} className="grid gap-3">
            <div>
              <label htmlFor="profile-current-password" className="form-label">
                Current password <span className="text-rose-600">*</span>
              </label>
              <input
                id="profile-current-password"
                type="password"
                name="current_password"
                value={passwordForm.current_password}
                onChange={(e) =>
                  setPasswordForm((f) => ({
                    ...f,
                    current_password: e.target.value,
                  }))
                }
                required
                className="form-input"
              />
            </div>
            <div>
              <label htmlFor="profile-new-password" className="form-label">
                New password <span className="text-rose-600">*</span>
              </label>
              <input
                id="profile-new-password"
                type="password"
                name="new_password"
                value={passwordForm.new_password}
                onChange={(e) =>
                  setPasswordForm((f) => ({
                    ...f,
                    new_password: e.target.value,
                  }))
                }
                required
                className="form-input"
              />
              <PasswordRequirements password={passwordForm.new_password} />
            </div>
            <button
              type="submit"
              disabled={
                !!passwordForm.new_password &&
                !validatePassword(passwordForm.new_password).isValid
              }
              className="btn-primary !w-auto"
            >
              Update password
            </button>
            {passwordStatus && (
              <div
                className={
                  passwordStatus.includes('successfully')
                    ? 'text-sm font-medium text-emerald-600 dark:text-emerald-400'
                    : 'form-error'
                }
              >
                {passwordStatus}
              </div>
            )}
          </form>
        </div>

        <div className="mt-10 border-t border-slate-200 pt-8 dark:border-slate-800">
          <h2 className="mb-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
            Security question
          </h2>
          <p className="mb-5 text-sm text-slate-500 dark:text-slate-400">
            Configuring a security question helps you recover your account if
            you forget your password. Setting a new question will{' '}
            <strong>replace</strong> any previous choice. Answers are hashed
            and stored securely.
          </p>

          {recoveryQuestions.length > 0 && (
            <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
              <span className="text-xs font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                Current Question
              </span>
              <div className="mt-1 font-medium text-slate-800 dark:text-slate-100">
                {recoveryQuestions[0]?.question}
              </div>
            </div>
          )}

          <form onSubmit={handleRecoverySubmit} className="grid gap-4">
            <div>
              <label htmlFor="profile-recovery-question" className="form-label">
                {recoveryQuestions.length > 0
                  ? 'Change question'
                  : 'Set question'}
              </label>
              <select
                id="profile-recovery-question"
                name="question"
                value={newRecovery.question}
                onChange={(e) =>
                  setNewRecovery((f) => ({ ...f, question: e.target.value }))
                }
                className="form-input"
              >
                <option value="">— Select a question —</option>
                {SECURITY_QUESTIONS.map((q) => (
                  <option key={q} value={q}>
                    {q}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="profile-recovery-answer" className="form-label">
                Security answer
              </label>
              <input
                id="profile-recovery-answer"
                type="password"
                name="answer"
                placeholder="Enter answer"
                value={newRecovery.answer}
                onChange={(e) =>
                  setNewRecovery((f) => ({ ...f, answer: e.target.value }))
                }
                className="form-input"
              />
            </div>

            <button type="submit" className="btn-primary !w-auto">
              {recoveryQuestions.length > 0
                ? 'Update Question'
                : 'Save Question'}
            </button>
            {recoveryStatus && (
              <div
                className={
                  recoveryStatus.includes('successfully')
                    ? 'text-sm font-medium text-emerald-600 dark:text-emerald-400'
                    : 'form-error'
                }
              >
                {recoveryStatus}
              </div>
            )}
          </form>
        </div>
      </section>
    </div>
  );
}
