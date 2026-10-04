// Whether a ticket's change can alter the production bundle (scripts/buildGate.mjs).
import path from 'node:path';

export const CHANGELOG = 'docs/Changelog.md';

/**
 * Paths no Vite build reads. Anything outside this list forces the build, docs included: the help index bundles
 * `docs/*.md`. The one named exception is the changelog: the bundle takes only its released slice, and a ticket's
 * line lands in In Progress. scripts/buildDecision.test.mjs checks each pattern against the bundle's inputs.
 */
export const SKIP_PATTERNS = [
  '**/*.test.{ts,tsx,js,jsx,mjs,cjs}',
  'src/test/**',
  'docs-internal/specs/**',
  'docs-internal/notes/**',
  '.claude/ticket-worktrees.json',
  CHANGELOG,
];

/** True when no build reads `file`. Patterns default to SKIP_PATTERNS. */
export const isSkippable = (file, patterns = SKIP_PATTERNS) => patterns.some((glob) => path.posix.matchesGlob(file, glob));

/** The build decision for a changed-file list: `build` is false only when every path is skippable. */
export function classifyChange(changed, patterns = SKIP_PATTERNS) {
  const forcing = changed.filter((file) => !isSkippable(file, patterns));
  return { build: forcing.length > 0, forcing };
}

/** The gate's skip line. It names the changelog when the changelog was among the changed files. */
export function describeSkip(changed, base) {
  const what = changed.includes(CHANGELOG) ? `no bundle file changed, ${CHANGELOG} among them` : 'tests-only change';
  return `build skipped: ${what} (${changed.length} changed files since ${base})`;
}
