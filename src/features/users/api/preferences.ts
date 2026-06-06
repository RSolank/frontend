import {
  useDateFormatStore,
  type DateFormatMode,
} from '../../../shared/state/dateFormat.store';
import {
  useDefaultTxnKindStore,
  type DefaultTxnKind,
} from '../../../shared/state/defaultTxnKind.store';
import { useFocusRingStore } from '../../../shared/state/focusRing.store';
import {
  useLandingRouteStore,
  type LandingRoute,
} from '../../../shared/state/landingRoute.store';
import { useLinkUnderlineStore } from '../../../shared/state/linkUnderline.store';
import {
  useNumberFormatStore,
  type NumberFormatMode,
} from '../../../shared/state/numberFormat.store';
import {
  sanitizePreferences,
  usePreferencesStore,
} from '../../../shared/state/preferences.store';
import { useTaxModeStore } from '../../../shared/state/taxMode.store';

import { updatePreferencesRequest } from './mutations';
import { fetchUserPreferences, type PreferencesResponse } from './queries';

// Enum value-objects used to validate the server payload before it
// touches a typed store. Anything outside these falls back to the
// store's default (kept in sync with the store definitions).
const DATE_FORMAT_VALUES: ReadonlySet<DateFormatMode> = new Set([
  'system',
  'dmy',
  'mdy',
  'ymd',
  'dmonth',
]);
const NUMBER_FORMAT_VALUES: ReadonlySet<NumberFormatMode> = new Set([
  'system',
  'comma-dot',
  'dot-comma',
  'space-comma',
  'indian',
  'plain',
]);
const LANDING_ROUTE_VALUES: ReadonlySet<LandingRoute> = new Set([
  '/dashboard',
  '/transactions',
  '/budgets',
  '/consumption-tax',
]);
const DEFAULT_TXN_KIND_VALUES: ReadonlySet<DefaultTxnKind> = new Set([
  'debit',
  'credit',
]);

// Guard flag: when a `setX()` call originates from hydratePreferences,
// the store subscribers must NOT fire a PATCH back at the server —
// otherwise every boot triggers eight pointless writes.
let hydrating = false;

// Hydrate every preference store from `/api/users/preferences`.
// Best-effort: a failure (404 / network / unauthorized) leaves each
// store at whatever values it already had. For currency/timezone the
// existing `sanitizePreferences` filter applies (printable-ASCII guard
// so a poisoned legacy row can't break headers). For the 6 enum / bool
// fields, anything outside the known value-set is ignored (store keeps
// its default rather than landing in an invalid state).
export async function hydratePreferences(): Promise<void> {
  hydrating = true;
  try {
    const prefs = await fetchUserPreferences();
    applyHydratedPreferences(prefs);
  } catch (err) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn('hydratePreferences failed', err);
    }
  } finally {
    hydrating = false;
  }
}

function applyHydratedPreferences(prefs: PreferencesResponse): void {
  // currency + timezone — pre-existing path, uses the sanitiser.
  usePreferencesStore.getState().setPreferences(sanitizePreferences(prefs));

  // date_format
  if (
    typeof prefs.date_format === 'string' &&
    DATE_FORMAT_VALUES.has(prefs.date_format as DateFormatMode)
  ) {
    useDateFormatStore
      .getState()
      .setFormat(prefs.date_format as DateFormatMode);
  }

  // number_format
  if (
    typeof prefs.number_format === 'string' &&
    NUMBER_FORMAT_VALUES.has(prefs.number_format as NumberFormatMode)
  ) {
    useNumberFormatStore
      .getState()
      .setFormat(prefs.number_format as NumberFormatMode);
  }

  // landing_route
  if (
    typeof prefs.landing_route === 'string' &&
    LANDING_ROUTE_VALUES.has(prefs.landing_route as LandingRoute)
  ) {
    useLandingRouteStore
      .getState()
      .setRoute(prefs.landing_route as LandingRoute);
  }

  // default_txn_kind
  if (
    typeof prefs.default_txn_kind === 'string' &&
    DEFAULT_TXN_KIND_VALUES.has(prefs.default_txn_kind as DefaultTxnKind)
  ) {
    useDefaultTxnKindStore
      .getState()
      .setKind(prefs.default_txn_kind as DefaultTxnKind);
  }

  // underline_links + focus_ring_always — booleans (a11y flags).
  if (typeof prefs.underline_links === 'boolean') {
    useLinkUnderlineStore.getState().setUnderline(prefs.underline_links);
  }
  if (typeof prefs.focus_ring_always === 'boolean') {
    useFocusRingStore.getState().setAlwaysVisible(prefs.focus_ring_always);
  }
  // auto_enabled — taxation auto-mode toggle (BE Phase 2.6).
  if (typeof prefs.auto_enabled === 'boolean') {
    useTaxModeStore.getState().setEnabled(prefs.auto_enabled);
  }
}

// Subscribe each preference store so any user-driven `setX()` fans out
// a PATCH to `/api/users/preferences`. Idempotent — the boot path can
// invoke this multiple times and only the first wires listeners.
// Fire-and-forget: a network failure does NOT roll back the store
// (the UX is "your choice is saved locally; we'll re-sync next boot").
let subscribed = false;

export function subscribeToPreferenceStores(): void {
  if (subscribed) return;
  subscribed = true;

  useDateFormatStore.subscribe((state, prev) => {
    if (hydrating || state.format === prev.format) return;
    void updatePreferencesRequest({ date_format: state.format });
  });

  useNumberFormatStore.subscribe((state, prev) => {
    if (hydrating || state.format === prev.format) return;
    void updatePreferencesRequest({ number_format: state.format });
  });

  useLandingRouteStore.subscribe((state, prev) => {
    if (hydrating || state.route === prev.route) return;
    void updatePreferencesRequest({ landing_route: state.route });
  });

  useDefaultTxnKindStore.subscribe((state, prev) => {
    if (hydrating || state.kind === prev.kind) return;
    void updatePreferencesRequest({ default_txn_kind: state.kind });
  });

  useLinkUnderlineStore.subscribe((state, prev) => {
    if (hydrating || state.underline === prev.underline) return;
    void updatePreferencesRequest({ underline_links: state.underline });
  });

  useFocusRingStore.subscribe((state, prev) => {
    if (hydrating || state.alwaysVisible === prev.alwaysVisible) return;
    void updatePreferencesRequest({ focus_ring_always: state.alwaysVisible });
  });

  useTaxModeStore.subscribe((state, prev) => {
    if (hydrating || state.enabled === prev.enabled) return;
    void updatePreferencesRequest({ auto_enabled: state.enabled });
  });
}

// Module-init wiring — runs once on first import. Authentication state
// is irrelevant: an unauthenticated PATCH would 401, which the
// fire-and-forget swallow tolerates. Doing it at module init keeps the
// boot path simple — no extra hook to remember to mount.
subscribeToPreferenceStores();
