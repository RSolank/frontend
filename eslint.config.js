import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
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

// Downgrade the sonarjs recommended set to warn-level: per the Batch 10
// plan these maintainability rules surface hot spots without failing CI
// in this batch (matching the complexity gates below). Options on each
// rule are preserved; 'off' rules stay off.
function asWarn(ruleSet) {
  return Object.fromEntries(
    Object.entries(ruleSet).map(([name, value]) => {
      if (value === 'off' || value === 0) return [name, 'off'];
      if (Array.isArray(value)) return [name, ['warn', ...value.slice(1)]];
      return [name, 'warn'];
    })
  );
}

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
  'jsx-a11y/label-has-associated-control': 'warn',
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

// Complexity / maintainability gates (Batch 10). Warn-level only — they
// surface hot spots without failing CI in this batch. Thresholds were
// picked by auditing the current tree (see Batch 10 commit body); set a
// little above the worst legitimate offender so they flag genuine
// outliers rather than drowning the dev loop in noise.
const complexityGates = {
  complexity: ['warn', 15],
  'max-lines-per-function': [
    'warn',
    { max: 200, skipBlankLines: true, skipComments: true },
  ],
  'max-depth': ['warn', 4],
  'max-nested-callbacks': ['warn', 4],
  'max-params': ['warn', 5],
};

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
      ...asWarn(sonarjs.configs.recommended.rules),
      ...complexityGates,
      // typescript-eslint owns unused-vars for TS; the core rule double-
      // reports and doesn't understand type-only positions. sonarjs also
      // ships its own no-unused-vars — turn it off to avoid triple-report.
      'no-unused-vars': 'off',
      'sonarjs/no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
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
