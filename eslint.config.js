import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import boundaries from 'eslint-plugin-boundaries';
import importPlugin from 'eslint-plugin-import';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import sonarjs from 'eslint-plugin-sonarjs';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const sharedImportRestrictions = {
  zones: [
    {
      target: './src/shared',
      from: './src/features',
      message:
        'shared/ must not depend on features/. Feature code depends on shared, never the other way around.',
    },
    // NOTE (Batch 10): a second zone forbidding cross-feature reaches
    // (target ./src/features/*/!(api)/**, from ./src/features, except api/**)
    // used to live here, but it never actually ran — the whole feature
    // tree is .ts/.tsx and ESLint ignored those extensions until this
    // batch. When enabled it produced 181/233 false positives because
    // no-restricted-paths can't express "same-feature import OK,
    // cross-feature import not" with one global zone (the api/** except
    // didn't match resolved paths, and same-feature siblings + self-tests
    // tripped it). Real per-feature boundary enforcement (api-only public
    // surface) needs eslint-plugin-boundaries — filed as a post-refactor
    // follow-up on main, along with relocating the genuine cross-feature
    // reaches (metadata/components/Country|CurrencySelect, auth/state/
    // useAuth) into shared/. Zone 1 above is correct and stays as error.
  ],
};

// The sonarjs recommended set is enforced at its native error severity
// (Batch 10.12). Batch 10.11 drove the maintainability board to 0/0, so
// these rules are now strict-enforcement, not advisory — a regression
// fails `npm run lint`. A few rules are explicitly turned off below where
// they conflict with codebase conventions ('off' stays off).

// React / a11y / import rules shared by the JS(X) and TS(X) blocks so the
// refactored TypeScript tree is held to the same bar the legacy JSX was.
const reactA11yImportRules = {
  ...react.configs.recommended.rules,
  ...react.configs['jsx-runtime'].rules,
  ...jsxA11y.configs.recommended.rules,
  // Classic react-hooks rules only. The newer v7 strict rules
  // (static-components, immutability, refs, use-before-declared, …)
  // flag legacy code that batches 2–8 will rewrite; re-enable them
  // per-feature as they go.
  'react-hooks/rules-of-hooks': 'error',
  'react-hooks/exhaustive-deps': 'warn',
  'react/prop-types': 'off',
  'import/no-restricted-paths': ['error', sharedImportRestrictions],
  'import/order': [
    'warn',
    {
      groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
      'newlines-between': 'always',
      alphabetize: { order: 'asc', caseInsensitive: true },
    },
  ],
  // Legacy-code allowances; tightened as each feature batch rewrites its surface.
  'react/no-unescaped-entities': 'warn',
  'jsx-a11y/no-autofocus': 'warn',
  // Custom labelable controls the rule can't introspect — a <label>
  // wrapping one of these (each forwards an aria-label / id to its inner
  // input) is a valid association.
  'jsx-a11y/label-has-associated-control': [
    'warn',
    { controlComponents: ['DateField', 'SearchableSelect'] },
  ],
  'jsx-a11y/click-events-have-key-events': 'warn',
  'jsx-a11y/no-static-element-interactions': 'warn',
  'jsx-a11y/no-noninteractive-element-interactions': 'warn',
  'jsx-a11y/anchor-is-valid': 'warn',
  'jsx-a11y/role-has-required-aria-props': 'warn',
  // CalendarView's role="grid" container delegates focus to its day
  // cells; the container-focusable requirement is a genuine a11y note
  // but a keyboard-model change, not a Batch 10 cleanup. Surfaced as a
  // warning for the post-refactor a11y follow-up.
  'jsx-a11y/interactive-supports-focus': 'warn',
};

// Complexity / maintainability gates. Error-level (Batch 10.12) — strict
// enforcement now that Batch 10.11 cleared the board. Thresholds were
// picked by auditing the tree (a little above the worst legitimate
// offender). They are a ratchet: the current state is the ceiling and must
// not degrade — tighten over time, never loosen. See CONTRIBUTING.md §3.
const complexityGates = {
  complexity: ['error', 15],
  'max-lines-per-function': [
    'error',
    { max: 200, skipBlankLines: true, skipComments: true },
  ],
  'max-depth': ['error', 4],
  'max-nested-callbacks': ['error', 4],
  'max-params': ['error', 5],
};

// Baseline a feature may always import: shared, anything in its OWN
// feature, and ANY feature's api/ (the sanctioned public surface).
// Each cross-feature exception below repeats this baseline so it holds
// whether boundaries treats per-`from` rules as additive or override.
// v6 `allow` entries are dependency selectors ({ to: <element selector> }),
// not bare element selectors — see eslint.config boundaries rule below.
const featureSelfAllow = [
  { to: { type: 'shared' } },
  { to: { type: 'feature', captured: { feature: '{{from.feature}}' } } },
  { to: { type: 'feature-api', captured: { feature: '{{from.feature}}' } } },
  { to: { type: 'feature-api' } },
];

export default [
  {
    linterOptions: {
      reportUnusedDisableDirectives: 'off',
    },
  },
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      'public/mockServiceWorker.js',
      // Machine-generated from the backend OpenAPI schema (`npm run
      // gen:api`) — not hand-authored, so linting it is noise (the
      // `paths`/`components`/`operations` interface names trip
      // sonarjs/class-name). tsc still type-checks it.
      'src/shared/types/api.ts',
    ],
  },
  js.configs.recommended,
  // --- JS(X): the remaining legacy surface (tests + soon-to-be-deleted) ---
  {
    files: ['**/*.{js,jsx,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    settings: {
      react: { version: 'detect' },
      'import/resolver': {
        node: {
          extensions: ['.js', '.jsx', '.ts', '.tsx'],
        },
      },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y,
      import: importPlugin,
    },
    rules: {
      ...reactA11yImportRules,
      'no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^(_|React$)',
        },
      ],
    },
  },
  // --- TS(X): the feature-architecture tree (Batch 10 turns linting on) ---
  // Up to Batch 10 the .ts/.tsx tree was ignored ("linted once
  // typescript-eslint is added"). This block adds it: typescript-eslint's
  // recommended set + sonarjs recommended + the shared react/a11y/import
  // rules + the complexity gates.
  ...tseslint.configs.recommended.map((cfg) => ({
    ...cfg,
    files: ['**/*.{ts,tsx}'],
  })),
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    settings: {
      react: { version: 'detect' },
      'import/resolver': {
        node: {
          extensions: ['.js', '.jsx', '.ts', '.tsx'],
        },
      },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y,
      import: importPlugin,
      sonarjs,
    },
    rules: {
      ...reactA11yImportRules,
      ...sonarjs.configs.recommended.rules,
      ...complexityGates,
      // typescript-eslint owns unused-vars for TS; the core rule double-
      // reports and doesn't understand type-only positions. sonarjs also
      // ships its own no-unused-vars — turn it off to avoid triple-report.
      'no-unused-vars': 'off',
      'sonarjs/no-unused-vars': 'off',
      // `void somePromise()` is the codebase's deliberate marker for an
      // intentionally-floated promise (e.g. boot-time hydration). sonarjs
      // flags the void operator stylistically; that conflicts with the
      // convention, so it's off.
      'sonarjs/void-use': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
    },
  },
  // --- Feature boundaries (Batch 10 bucket 6c) -------------------------
  // The working replacement for the removed no-restricted-paths cross-
  // feature zone. The rule, encoded as element-types:
  //   - app/ composes everything (shared + any feature).
  //   - shared/ is leaf infra — imports only shared (Zone 1: shared ⊥ features).
  //   - a feature may import shared, ITSELF (any subpath), and ANY feature's
  //     api/ (the sanctioned public surface) — but NOT another feature's
  //     non-api internals (components/state/pages/hooks).
  // Warn-level for now (report-first rollout); flip to error once the
  // count is confirmed clean.
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: [
      '**/*.test.{ts,tsx}',
      '**/*.spec.{ts,tsx}',
      'src/test/**',
      'src/main.tsx',
      'src/setupTests.ts',
    ],
    plugins: { boundaries },
    settings: {
      'boundaries/elements': [
        { type: 'app', pattern: 'src/app', mode: 'folder' },
        { type: 'shared', pattern: 'src/shared', mode: 'folder' },
        {
          type: 'feature-api',
          pattern: 'src/features/*/api',
          mode: 'folder',
          capture: ['feature'],
        },
        {
          type: 'feature',
          pattern: 'src/features/*',
          mode: 'folder',
          capture: ['feature'],
        },
      ],
      'boundaries/ignore': [
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
        'src/test/**',
        'src/main.tsx',
        'src/setupTests.ts',
      ],
    },
    rules: {
      // v6 rule (renamed from the deprecated `boundaries/element-types`).
      // Same shape; tuple-with-capture selectors migrated to the object form
      // `{ type, <capture> }` and `${from.feature}` → `{{from.feature}}`.
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          rules: [
            {
              from: { type: 'app' },
              allow: [
                { to: { type: 'app' } },
                { to: { type: 'shared' } },
                { to: { type: 'feature' } },
                { to: { type: 'feature-api' } },
              ],
            },
            { from: { type: 'shared' }, allow: [{ to: { type: 'shared' } }] },
            {
              from: [{ type: 'feature' }, { type: 'feature-api' }],
              allow: featureSelfAllow,
            },
            // --- Documented Batch 10 exceptions (intentional composition) ---
            // The settings shell mounts other features' pages under
            // /settings/* (TagsPage / CategorizationRulesPage /
            // TaxationRulesPage) — composition, like app/routes.
            {
              from: { type: 'feature', captured: { feature: 'settings' } },
              allow: [...featureSelfAllow, { to: { type: 'feature' } }],
            },
            // Inline "create without leaving the flow": the transactions
            // and categorization flows embed beneficiaries' + tags' create
            // dialogs (BeneficiaryFormDialog / TagFormDialog).
            // Transactions also embed the bankAccounts picker
            // (BankAccountPicker on the manual-txn forms — Batch 13f);
            // same precedent.
            {
              from: { type: 'feature', captured: { feature: 'transactions' } },
              allow: [
                ...featureSelfAllow,
                {
                  to: {
                    type: 'feature',
                    captured: { feature: 'beneficiaries' },
                  },
                },
                { to: { type: 'feature', captured: { feature: 'tags' } } },
                {
                  to: {
                    type: 'feature',
                    captured: { feature: 'bankAccounts' },
                  },
                },
              ],
            },
            {
              from: {
                type: 'feature',
                captured: { feature: 'categorization' },
              },
              allow: [
                ...featureSelfAllow,
                {
                  to: {
                    type: 'feature',
                    captured: { feature: 'beneficiaries' },
                  },
                },
                { to: { type: 'feature', captured: { feature: 'tags' } } },
              ],
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      '**/*.test.{js,jsx,ts,tsx}',
      '**/*.spec.{js,jsx,ts,tsx}',
      '**/setupTests.{js,jsx,ts,tsx}',
    ],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        suite: 'readonly',
        expect: 'readonly',
        vi: 'readonly',
        beforeAll: 'readonly',
        beforeEach: 'readonly',
        afterAll: 'readonly',
        afterEach: 'readonly',
      },
    },
    rules: {
      'react/display-name': 'off',
      'no-empty-pattern': 'off',
      // Test suites are naturally long + nest describe/it deeply; the
      // maintainability gates target product code, not specs.
      'max-lines-per-function': 'off',
      'max-nested-callbacks': 'off',
      complexity: 'off',
      'sonarjs/cognitive-complexity': 'off',
    },
  },
  prettier,
];
