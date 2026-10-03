#!/usr/bin/env node
// Ticket test gate: runs the tests a change since <base> can affect. `--list` prints the related paths instead.
// Usage: node scripts/affectedTests.mjs <base> [--list]
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { MAX_ARGS_LENGTH, changedSince, gitFiles, relatedFiles, requirersOf } from './testSelection.mjs';

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

const vitest = path.join(path.dirname(createRequire(import.meta.url).resolve('vitest/package.json')), 'vitest.mjs');
const tooLong = related.join(' ').length > MAX_ARGS_LENGTH;
console.log(tooLong
  ? `The ${related.length} related paths don't fit on one command line; running the full suite.`
  : `${changed.length} changed files since ${base}; running tests related to ${related.length} paths.`);
const args = tooLong ? ['run'] : ['related', '--run', ...related];
const result = spawnSync(process.execPath, [vitest, ...args], { stdio: 'inherit' });
process.exit(result.status ?? 1);
