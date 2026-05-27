import { afterEach, describe, expect, it } from 'vitest';

import { getLandingRoute, useLandingRouteStore } from './landingRoute.store';

describe('landingRoute.store', () => {
  afterEach(() => {
    useLandingRouteStore.setState({ route: '/dashboard' });
  });

  it('defaults to /dashboard', () => {
    expect(useLandingRouteStore.getState().route).toBe('/dashboard');
    expect(getLandingRoute()).toBe('/dashboard');
  });

  it('setRoute updates the store and getLandingRoute reflects it', () => {
    useLandingRouteStore.getState().setRoute('/budgets');
    expect(useLandingRouteStore.getState().route).toBe('/budgets');
    expect(getLandingRoute()).toBe('/budgets');
  });
});
