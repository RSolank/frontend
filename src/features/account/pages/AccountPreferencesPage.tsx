import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import {
  useCountriesQuery,
  type CountryOption,
} from '../../../shared/api/referenceData';
import {
  CountrySelect,
  COUNTRY_PREFER_NOT_SAY,
} from '../../../shared/components/CountrySelect';
import { CurrencySelect } from '../../../shared/components/CurrencySelect';
import { DefaultTxnKindSelect } from '../../../shared/components/DefaultTxnKindSelect';
import { TaxModeToggle } from '../../../shared/components/TaxModeToggle';
import { TimezoneSelect } from '../../../shared/components/TimezoneSelect';
import { useDeepLinkHighlight } from '../../../shared/hooks/useDeepLinkHighlight';
import { useRowHighlight } from '../../../shared/hooks/useRowHighlight';
import { getBrowserTimezone } from '../../../shared/utils/countryTimezones';
import { highlightClass } from '../../../shared/utils/highlight';
import { userKeys } from '../../users/api/keys';
import {
  updatePreferencesRequest,
  updateProfileRequest,
} from '../../users/api/mutations';
import { hydratePreferences } from '../../users/api/preferences';
import {
  useCurrentUserQuery,
  useUserPreferencesQuery,
} from '../../users/api/queries';

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
  const { data: meData, isLoading: meLoading } = useCurrentUserQuery();
  const { data: prefsData, isLoading: prefsLoading } =
    useUserPreferencesQuery();
  const user = meData?.user;
  const isLoading = meLoading || prefsLoading;

  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [hydrated, setHydrated] = useState(false);
  const [saved, setSaved] = useState(false);

  // Deep-link "point at this" — a redirect can land here with
  // `?highlight=tax-mode` (the dashboard Tax Tracker's "turn it back on"
  // banner) to flash + scroll the taxation card. The shared hook fires once
  // the page has loaded (so the card exists), then consumes the param.
  const { id: highlightId, flash } = useRowHighlight<string>();
  useDeepLinkHighlight({
    param: 'highlight',
    flash,
    ready: !isLoading,
    accept: (v) => v === 'tax-mode',
  });
  const taxCardHighlighted = highlightId === 'tax-mode';
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Wait for both /me (country) AND /preferences (currency, timezone)
    // before hydrating the form — otherwise the first paint flickers
    // through a half-empty state.
    if (!user || !prefsData || hydrated) return;
    setForm({
      country: user.country ?? '',
      currency: prefsData.currency ?? '',
      timezone: prefsData.timezone ?? getBrowserTimezone(),
    });
    setHydrated(true);
  }, [user, prefsData, hydrated]);

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

    const profilePayload = {
      country:
        !form.country || form.country === COUNTRY_PREFER_NOT_SAY
          ? null
          : form.country,
    };
    const preferencesPayload = {
      currency: form.currency || null,
      timezone: form.timezone,
    };

    try {
      // /me holds identity (country lives here); /preferences is the SoT
      // for currency + timezone after BE Phase 1.9. PATCH both slices in
      // parallel; either alone is a no-op the BE handles idempotently.
      await Promise.all([
        updateProfileRequest(profilePayload),
        updatePreferencesRequest(preferencesPayload),
      ]);
      // Refresh /me + preferences store so every component reading
      // formatMoney / formatDate sees the new values immediately.
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
              Timezone <span className="text-danger-600">*</span>
            </label>
            <TimezoneSelect
              id="prefs-timezone"
              countryName={currentCountry?.name ?? null}
              countryDefaultTimezone={currentCountry?.timezones?.[0] ?? null}
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
              Pick any IANA timezone — independent of your country. Defaults to
              the country&rsquo;s primary zone but won&rsquo;t change
              automatically when you switch country.
            </p>
          </div>
          {error && <div className="form-error">{error}</div>}
          <div className="flex items-center gap-3">
            <button type="submit" className="btn-primary !w-auto">
              Save
            </button>
            {saved && (
              <span className="text-success-600 dark:text-success-400 text-sm font-medium">
                Saved
              </span>
            )}
          </div>
        </form>
      </div>

      <div className="overflow-hidden rounded-xl bg-white shadow-sm dark:bg-slate-900 dark:shadow-none dark:ring-1 dark:ring-slate-800">
        <div className="border-b border-slate-100 px-4 py-2 text-[11px] font-semibold tracking-wider text-slate-500 uppercase dark:border-slate-800 dark:text-slate-400">
          Defaults
        </div>
        <DefaultTxnKindSelect />
        <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
          Date format, number format, and the default landing route after login
          also live under{' '}
          <a
            href="/account/accessibility"
            className="text-accent-600 hover:text-accent-700 dark:text-accent-400 dark:hover:text-accent-300"
          >
            Accessibility
          </a>
          . All defaults persist to this browser only — cross-device sync is
          queued as a backend follow-up.
        </p>
      </div>

      <div
        id="prefs-taxation-card"
        data-testid="prefs-taxation-card"
        className={`overflow-hidden rounded-xl bg-white shadow-sm dark:bg-slate-900 dark:shadow-none dark:ring-1 dark:ring-slate-800 ${highlightClass(
          taxCardHighlighted
        )}`}
      >
        <div className="border-b border-slate-100 px-4 py-2 text-[11px] font-semibold tracking-wider text-slate-500 uppercase dark:border-slate-800 dark:text-slate-400">
          Taxation
        </div>
        <TaxModeToggle />
      </div>
    </div>
  );
}
