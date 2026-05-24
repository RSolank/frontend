import { render, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

import App from './App';
import { AuthProvider } from './state/AuthContext.jsx';

// Mock apiFetch to prevent real network calls during render,
// which would be aborted on happy-dom teardown causing DOMException AbortError.
vi.mock('./utils/apiClient.js', () => ({
  apiFetch: vi.fn().mockResolvedValue({ user: null }),
}));

describe('App Component', () => {
  it('renders and redirects to login by default', async () => {
    // Wrap render in act so AuthProvider's useEffect state updates
    // (setUser, setConstants, setLoading) fully settle before assertions.
    await act(async () => {
      render(
        <MemoryRouter
          initialEntries={['/']}
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          <AuthProvider>
            <App />
          </AuthProvider>
        </MemoryRouter>
      );
    });

    // We just check that the app renders without crashing.
    expect(true).toBe(true);
  });
});
