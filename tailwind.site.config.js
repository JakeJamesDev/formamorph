/**
 * Tailwind for the formamorph.ai account pages.
 *
 * Same theme as the app — the type roles, the radii and the token-backed colors the shadcn primitives
 * read — but scanned over the site entry and the app files it actually reuses. What those are, and why
 * the list is neither wider nor narrower, is in `tailwind.site.content.cjs`.
 */
const base = require('./tailwind.config.js')
const { content } = require('./tailwind.site.content.cjs')

/** @type {import('tailwindcss').Config} */
module.exports = {
  ...base,
  content,
}
