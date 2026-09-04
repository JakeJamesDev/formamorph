import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import tsdoc from 'eslint-plugin-tsdoc'
import { TYPOGRAPHY_LEGACY } from './eslint.typography-legacy.js'
import { composedForwardRefRule } from './eslint.composed-forwardref.js'
import { noNativeTitleRule } from './eslint.no-native-title.js'

// Raw Tailwind size utilities say how big text is, never what it is — so `text-xs` reads the same on a
// hint and on a deliberately compact control, and the two can't be told apart or retuned separately.
// The role-named scale in tailwind.config.js replaces them; density lives on a control's `size` variant.
const RAW_TEXT_SIZE = String.raw`\btext-(xs|sm|base|lg|[2-9]?xl)\b`
const RAW_TEXT_SIZE_MESSAGE =
  'Raw Tailwind text sizes are not allowed here. Use a role token (text-body/label/helper/meta/title/heading/display), or a control size variant (e.g. <Input size="sm">) when the intent is density.'

const noRawTextSize = [
  'error',
  {
    selector: `JSXAttribute[name.name="className"] Literal[value=/${RAW_TEXT_SIZE}/]`,
    message: RAW_TEXT_SIZE_MESSAGE,
  },
  {
    selector: `JSXAttribute[name.name="className"] TemplateElement[value.raw=/${RAW_TEXT_SIZE}/]`,
    message: RAW_TEXT_SIZE_MESSAGE,
  },
]

export default tseslint.config(
  // 'out' is the Cloudflare Pages upload root the deploy assembles: a copy of dist beside the site.
  // '.scratch' is throwaway work, including vendored third-party source to test against.
  { ignores: ['dist', 'out', 'coverage', 'release', 'electron', 'docs-api', '.scratch'] },
  {
    files: ['*.config.js'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    settings: { react: { version: '18.3' } },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      'react/jsx-no-target-blank': 'off',
      'react/prop-types': 'off',
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [...tseslint.configs.recommended],
    plugins: { tsdoc },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { ignoreRestSiblings: true, argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Validate TSDoc microsyntax only — does not require docs, so prose-only blocks pass clean.
      'tsdoc/syntax': 'warn',
    },
  },
  {
    // The primitives are tokenized too, so nothing is exempt: sizes live in tailwind.config.js alone,
    // and retuning a role reaches every control. TYPOGRAPHY_LEGACY is the not-yet-swept remainder and
    // only ever shrinks; it is empty.
    files: ['src/**/*.tsx'],
    ignores: [...TYPOGRAPHY_LEGACY],
    rules: { 'no-restricted-syntax': noRawTextSize },
  },
  {
    files: ['src/**/*.tsx'],
    plugins: {
      formamorph: {
        rules: {
          'composed-forwardref': composedForwardRefRule,
          'no-native-title': noNativeTitleRule,
        },
      },
    },
    rules: {
      'formamorph/composed-forwardref': 'error',
      'formamorph/no-native-title': 'error',
    },
  },
  {
    // Tests carry non-TSDoc block comments (e.g. the `@vitest-environment` pragma) — skip tsdoc there.
    files: ['**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}'],
    rules: { 'tsdoc/syntax': 'off' },
  },
)
