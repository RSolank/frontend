import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';

// react-router-dom doesn't re-export its `InitialEntry` history type;
// it's `string | Partial<Location>` upstream. Inlined structurally
// so tests can pass either a plain path or `{ pathname, state }` to
// drive `location.state`-bound pages like /verify/2fa.
type InitialEntry =
  | string
  | {
      pathname?: string;
      search?: string;
      hash?: string;
      state?: unknown;
    };

// Test wrapper that mirrors the production provider tree without paying
// for the full router config: a fresh QueryClient (retries disabled so
// MSW error overrides surface immediately) and a MemoryRouter so any
// <Link>/useNavigate inside the unit under test composes correctly.

function makeClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  client?: QueryClient;
  // Accepts the same shape as MemoryRouter's prop — plain paths
  // (`['/foo']`) or `{ pathname, state }` entries so tests can
  // exercise `location.state`-bound pages like /verify/2fa.
  initialEntries?: InitialEntry[];
}

export function renderWithProviders(
  ui: ReactElement,
  {
    client = makeClient(),
    initialEntries,
    ...options
  }: RenderWithProvidersOptions = {}
) {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  }
  return render(ui, { wrapper: Wrapper, ...options });
}
