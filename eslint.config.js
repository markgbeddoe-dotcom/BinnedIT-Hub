// SkipSync ESLint flat config (eslint 9) — GAP-073
//
// Goals:
//   - Catch real bugs (undefined vars, broken hooks usage) on a plain-JS/JSX codebase.
//   - Zero ERRORS on the current codebase; style nits are warnings only.
//   - Match house conventions: inline styles, no prop-types, no TypeScript.
//
// Run:  npx eslint src api          (CI runs this — errors fail the build, warnings don't)

import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'

export default [
  // ── Ignores ────────────────────────────────────────────────────────────────
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      '**/dist/**',
      'test-results/**',
      'playwright-report/**',
      'coverage/**',
      'e2e/.auth/**',
      '.vercel/**',
      'supabase/**',
      '.claude/**', // stale agent worktrees carry their own dist/ bundles
    ],
  },

  // ── Base JS rules ──────────────────────────────────────────────────────────
  js.configs.recommended,

  // ── App-wide settings (src = browser, api = node/edge, configs = node) ────
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
        ...globals.node, // api/ + scripts/ run on node; harmless union for src/
      },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      // React (manually picked from the flat recommended set — keeps us
      // independent of preset shape changes between plugin majors)
      'react/jsx-uses-react': 'off', // React 17+ automatic runtime
      'react/react-in-jsx-scope': 'off', // ditto
      'react/jsx-uses-vars': 'error', // without this, no-unused-vars false-positives on JSX components
      'react/jsx-key': 'warn',
      'react/jsx-no-duplicate-props': 'error',
      'react/jsx-no-undef': 'error',
      'react/no-children-prop': 'warn',
      'react/no-danger-with-children': 'error',
      'react/no-deprecated': 'warn',
      'react/no-direct-mutation-state': 'error',
      'react/no-unescaped-entities': 'off', // house style: apostrophes in JSX copy are fine
      'react/prop-types': 'off', // no prop-types in this codebase by convention
      'react/display-name': 'off',

      // Hooks — the rules that actually catch bugs
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // Plain-JS hygiene — warnings, not errors, on a fast-moving codebase
      'no-unused-vars': ['warn', {
        args: 'none', // handler signatures often keep unused (e, idx) args
        varsIgnorePattern: '^_',
        caughtErrors: 'none', // catch (e) {} with unused e is idiomatic here
        ignoreRestSiblings: true,
      }],
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'no-constant-condition': ['warn', { checkLoops: false }],
      'no-console': 'off', // console.* is the established logging convention
      'no-prototype-builtins': 'warn',
      'no-irregular-whitespace': 'warn',
      'no-useless-escape': 'warn',
      'no-control-regex': 'warn',
      'no-async-promise-executor': 'warn',
      'no-case-declarations': 'warn',
      'no-fallthrough': 'warn',
      'no-undef': 'error', // real-bug catcher — keep as error
    },
  },

  // ── Vitest unit tests (globals: true in vitest.config.js) ─────────────────
  {
    files: ['**/*.{test,spec}.{js,jsx}', 'src/test/**'],
    languageOptions: {
      globals: {
        ...globals.vitest,
        ...globals.jest, // a few specs use jest-style global names via jest-dom
      },
    },
  },

  // ── Service workers (public/) — dedicated worker globals like `clients` ───
  {
    files: ['public/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.serviceworker,
      },
    },
  },

  // ── Playwright e2e specs (node context, no vitest globals) ────────────────
  {
    files: ['e2e/**/*.js', 'playwright.config.js'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser, // page.evaluate / addInitScript callbacks run in-page
      },
    },
  },
]
