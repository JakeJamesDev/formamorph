#!/usr/bin/env node
// Ticket test gate: runs the tests a change since <base> can affect. `--list` prints the related paths instead.
// Usage: node scripts/affectedTests.mjs <base> [--list]
import { readFileSync } from 'node:fs';
import { MAX_ARGS_LENGTH, changedSince, gitFiles, relatedFiles, requirersOf } from './testSelection.mjs';
import { runTests } from './runTests.mjs';

const [base, flag] = process.argv.slice(2);
if (!base || (flag && flag !== '--list')) {
  console.error('Usage: node scripts/affectedTests.mjs <base> [--list]');
  process.exit(2);
}

const changed = changedSince(base);
const cjs = Object.fromEntries(gitFiles('ls-files', '--', '*.cjs').map((file) => [file, readFileSync(file, 'utf8')]));
const related = relatedFiles(changed, requirersOf(cjs));

if (flag === '--list') {
  console.log(related.join('\n'));
  process.exit(0);
}

const tooLong = related.join(' ').length > MAX_ARGS_LENGTH;
console.log(tooLong
  ? `The ${related.length} related paths don't fit on one command line; running the full suite.`
  : `${changed.length} changed files since ${base}; running tests related to ${related.length} paths.`);
process.exit(runTests(tooLong ? ['run'] : ['related', '--run', ...related]));
