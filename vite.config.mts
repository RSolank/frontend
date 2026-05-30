import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: './src/setupTests.ts',
    // Raised from the 5s default so the coverage run (v8 instrumentation
    // adds real per-test overhead) and CI under load don't trip false
    // timeouts on the async waitFor-heavy page tests. Passing tests
    // finish well under this; it only lifts the ceiling.
    testTimeout: 15000,
    coverage: {
      // Run via `npm run coverage` (not the default `npm test`, which
      // stays fast for the dev loop). Targets per CONTRIBUTING.md §7:
      // 80% lines on critical-path pages, 60% elsewhere.
      provider: 'v8',
      reporter: ['text-summary', 'html', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.spec.{ts,tsx}',
        'src/**/*.d.ts',
        'src/setupTests.ts',
        'src/test/**',
        'src/main.tsx',
        // Generated from the backend OpenAPI schema — not hand-written.
        'src/shared/types/api.ts',
      ],
      // Enforce the CONTRIBUTING.md §7 "everything else" floor (60%
      // lines) globally — currently passing (lines 70%, branches 61%),
      // so this is a no-regression gate, not a stretch. The 80%
      // critical-path target (auth, txn create/edit, budgets, bills) is
      // not yet expressible here without per-glob thresholds that some
      // of those files don't meet today; raising them + wiring per-glob
      // 80% gates is filed as a post-refactor follow-up.
      thresholds: {
        lines: 60,
        statements: 60,
        functions: 60,
        branches: 60,
      },
    },
  },
  server: {
    port: 5173,
  },
});
