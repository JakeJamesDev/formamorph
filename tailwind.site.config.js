/**
 * Tailwind for the formamorph.ai account pages.
 *
 * Same theme as the app — the type roles, the radii and the token-backed colors the shadcn primitives
 * read — but scanned over the site entry and the primitives it actually reuses. Scanning all of `src/`
 * would put every class the game uses into a login page's stylesheet.
 */
const base = require('./tailwind.config.js')

/** @type {import('tailwindcss').Config} */
module.exports = {
  ...base,
  content: [
    './site/**/*.{js,jsx,ts,tsx}',
    './src/components/ui/**/*.{ts,tsx}',
  ],
}
