import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import { hydratePreferences } from '../../auth/state/useAuth';
import { useCountriesQuery, type CountryOption } from '../../metadata/api/queries';
import {
  CountrySelect,
  COUNTRY_PREFER_NOT_SAY,
} from '../../metadata/components/CountrySelect';
import { CurrencySelect } from '../../metadata/components/CurrencySelect';
import { TimezoneSelect } from '../../metadata/components/TimezoneSelect';
import { getBrowserTimezone } from '../../../shared/utils/countryTimezones';
import { userKeys } from '../../users/api/keys';
import { updateProfileRequest } from '../../users/api/mutations';
import { useCurrentUserQuery } from '../../users/api/queries';

interface FormState {
  country: string;
  currency: string;
  timezone: string;
}

const INITIAL_FORM: FormState = { country: '', currency: '', timezone: '' };

interface ApiErrorShape {
  detail?: string;
  error?: string;
}

export function AccountPreferencesPage() {
  const queryClient = useQueryClient();
  const { data: countries = [] } = useCountriesQuery();
  const { data: meData, isLoading } = useCurrentUserQuery();
  const user = meData?.user;

  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [hydrated, setHydrated] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || hydrated) return;
    setForm({
      country: user.country ?? '',
      currency: user.currency ?? '',
      timezone: user.timezone ?? getBrowserTimezone(),
    });
    setHydrated(true);
  }, [user, hydrated]);

  const currentCountry: CountryOption | null = useMemo(() => {
    if (!form.country || form.country === COUNTRY_PREFER_NOT_SAY) return null;
    return countries.find((c) => c.name === form.country) ?? null;
  }, [countries, form.country]);

  function handleCountryChange(value: string, country: CountryOption | null) {
    // On Preferences we deliberately do NOT auto-reset timezone when
    // country changes — users who travel keep their preferred tz
    // (often UTC) regardless of country of residence. The timezone
    // dropdown below always shows the full IANA list so they can
    // pick any zone independently. Currency still auto-fills from
    // the new country since that maps 1:1 in most cases; users can
    // override via the currency dropdown if needed.
    if (country) {
      setForm((f) => ({
        ...f,
        country: country.name,
        currency: country.default_currency || f.currency,
        timezone: f.timezone || getBrowserTimezone(),
      }));
    } else {
      setForm((f) => ({
        ...f,
        country: value,
        timezone: f.timezone || getBrowserTimezone(),
      }));
    }
    setSaved(false);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    if (!form.timezone) {
      setError('Please select a timezone.');
      return;
    }

    const payload = {
      country:
        !form.country || form.country === COUNTRY_PREFER_NOT_SAY
          ? null
          : form.country,
      currency: form.currency || null,
      timezone: form.timezone,
    };

    try {
      await updateProfileRequest(payload);
      // Refresh /me + preferences store so headers + every component
      // reading formatMoney / formatDate see the new values immediately.
      await queryClient.invalidateQueries({ queryKey: userKeys.all });
      await hydratePreferences();
      setSaved(true);
    } catch (err) {
      const e = err as ApiErrorShape;
      setError(e.detail || e.error || 'Failed to save');
    }
  }

  if (isLoading || !user) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
    );
  }

  // Card-anchored layout (Batch 9 polish): breadcrumb reads
  // "Account › Preferences"; no in-content title. First card top
  // aligns with sidebar first NavLink.
  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-white p-6 shadow-sm dark:bg-slate-900 dark:shadow-none dark:ring-1 dark:ring-slate-800">
        <form onSubmit={handleSubmit} className="grid gap-3">
          <div>
            <label htmlFor="prefs-country" className="form-label">
              Country
            </label>
            <CountrySelect
              id="prefs-country"
              value={form.country}
              onChange={handleCountryChange}
              countries={countries}
            />
          </div>
          <div>
            <label htmlFor="prefs-currency" className="form-label">
              Currency
            </label>
            <CurrencySelect
              id="prefs-currency"
              value={form.currency}
              onChange={(code) => {
                setForm((f) => ({ ...f, currency: code }));
                setSaved(false);
                setError(null);
              }}
            />
          </div>
          <div>
            <label htmlFor="prefs-timezone" className="form-label">
              Timezone <span className="text-rose-600">*</span>
            </label>
            <TimezoneSelect
              id="prefs-timezone"
              countryName={currentCountry?.name ?? null}
              countryDefaultTimezone={currentCountry?.timezone ?? null}
              value={form.timezone}
              onChange={(tz) => {
                setForm((f) => ({ ...f, timezone: tz }));
                setSaved(false);
                setError(null);
              }}
              required
              alwaysFullList
            />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Pick any IANA timezone — independent of your country.
              Defaults to the country&rsquo;s primary zone but
              won&rsquo;t change automatically when you switch
              country.
            </p>
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
        </form>
      </div>

      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-6 dark:border-slate-700 dark:bg-slate-900/40">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          Defaults
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Date format, number format, and the default landing route
          after login are configurable today under{' '}
          <a
            href="/account/accessibility"
            className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
          >
            Accessibility
          </a>{' '}
          — they persist to this browser only. Cross-device sync
          (along with default debit/credit on Add Transaction) needs
          backend columns on{' '}
          <code className="rounded bg-slate-200 px-1 py-0.5 text-xs dark:bg-slate-800">
            UserProfile
          </code>{' '}
          — tracked in{' '}
          <code className="rounded bg-slate-200 px-1 py-0.5 text-xs dark:bg-slate-800">
            docs/refactor/implementation_plan.md
          </code>{' '}
          under &ldquo;Backend follow-ups&rdquo;.
        </p>
      </div>
    </div>
  );
}
