// Validate one Release Summary (docs/whats-new/<version>.md) with the app's own parser. The file name is the
// version its title must name. Prints each problem to stderr and exits 1 on any error.
//
// Usage:
//   node scripts/validateReleaseSummary.mjs docs/whats-new/3.7.0.md         → validate only
//   node scripts/validateReleaseSummary.mjs docs/whats-new/3.7.0.md --body  → also print the GitHub release body
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseReleaseSummary } from '../src/lib/whatsNew/releaseSummary.ts';

export const FULL_CHANGELOG_URL = 'https://github.com/JakeJamesDev/formamorph/wiki/Changelog';

/** The release body: the summary, then a thematic break the parser stops at, then the Full changelog link. */
export function releaseBody(markdown) {
  return `${markdown.trimEnd()}\n\n---\n\n[Full changelog](${FULL_CHANGELOG_URL})\n`;
}

function main() {
  const args = process.argv.slice(2);
  const file = args.find((arg) => !arg.startsWith('--'));
  if (!file) {
    process.stderr.write('Usage: node scripts/validateReleaseSummary.mjs <docs/whats-new/<version>.md> [--body]\n');
    return 2;
  }
  let markdown;
  try {
    markdown = readFileSync(file, 'utf8');
  } catch {
    process.stderr.write(`error: No Release Summary at ${file}.\n`);
    return 1;
  }
  const version = path.basename(file, '.md');
  const { problems } = parseReleaseSummary(markdown, { version });
  for (const problem of problems) {
    const where = problem.line === null ? file : `${file}:${problem.line}`;
    process.stderr.write(`${problem.severity}: ${where}: ${problem.message}\n`);
  }
  if (problems.some((problem) => problem.severity === 'error')) return 1;
  if (args.includes('--body')) process.stdout.write(releaseBody(markdown));
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  process.exitCode = main();
}
