// ESLint, deliberately small.
//
// react-doctor is this project's deep scanner (60+ rules, dead-code pass, a
// score we track for regressions). ESLint exists for the one thing a scanner run
// on demand cannot give you: the rules-of-hooks check, in your editor, as you
// type. That rule has already caught a real crash here — `SkillsSec` called
// useState inside a conditional, so a résumé whose `skills` field arrived as an
// array instead of an object changed the hook count between renders and took the
// editor view down (doctor run 2026-07-18, fixed in PR #14).
//
// Keep this file boring. Every rule added here is a rule that has to earn its
// place against react-doctor already covering it.
//
// eslint-plugin-react is deliberately absent: its peer range stops at eslint 9,
// and its value overlaps react-doctor almost entirely.
import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'playwright-report/**',
      'test-results/**',
      'server/.data/**',
    ],
  },

  // Browser code
  {
    files: ['src/**/*.{js,jsx}'],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...js.configs.recommended.rules,
      'react-hooks/rules-of-hooks': 'error',
      // Warn, not error: several omissions in this codebase are deliberate
      // stale-closure guards, and each needs reading before it is "fixed".
      'react-hooks/exhaustive-deps': 'warn',
      // JSX component references read as unused to the base rule.
      'no-unused-vars': ['warn', {
        varsIgnorePattern: '^[A-Z_]',
        argsIgnorePattern: '^_',
        ignoreRestSiblings: true,
      }],
    },
  },

  // Server code (Node, ESM)
  {
    files: ['server/**/*.js'],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', ignoreRestSiblings: true }],
    },
  },
];
