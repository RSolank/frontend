import {
  useLandingRouteStore,
  type LandingRoute,
} from '../state/landingRoute.store';

const OPTIONS: { value: LandingRoute; label: string }[] = [
  { value: '/dashboard', label: 'Dashboard' },
  { value: '/transactions', label: 'Transactions' },
  { value: '/budgets', label: 'Expense Tracker' },
  { value: '/consumption-tax', label: 'Tax Tracker' },
];

// Where login + the LoginPage's already-authed redirect land the
// user. Frontend-only Zustand persist; defaults to '/dashboard'.
export function LandingRouteSelect() {
  const route = useLandingRouteStore((s) => s.route);
  const setRoute = useLandingRouteStore((s) => s.setRoute);

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2">
      <label
        htmlFor="landing-route-select"
        className="text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400"
      >
        After login go to
      </label>
      <select
        id="landing-route-select"
        value={route}
        onChange={(e) => setRoute(e.target.value as LandingRoute)}
        className="form-input !w-auto"
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
