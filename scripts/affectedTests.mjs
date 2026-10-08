#!/usr/bin/env node
// Ticket test gate: runs the tests a change since <base> can affect. `--list` prints the related paths instead.
// A run whose only failures are timeouts reruns those files alone once: a gate shares the machine with
// other sessions, and a starved run is not a verdict.
// Usage: node scripts/affectedTests.mjs <base> [--list]
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { MAX_ARGS_LENGTH, changedSince, gitFiles, relatedFiles, requirersOf } from './testSelection.mjs';
import { retryableFiles } from './testRetry.mjs';

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
const reportDir = mkdtempSync(path.join(os.tmpdir(), 'affected-tests-'));
const report = path.join(reportDir, 'report.xml');
const reporters = ['--reporter=default', '--reporter=junit', `--outputFile.junit=${report}`];
const result = spawnSync(process.execPath, [vitest, ...args, ...reporters], { stdio: 'inherit' });
let status = result.status ?? 1;
if (status !== 0) {
  const files = timedOut(report);
  if (files.length) {
    console.log(`\n${files.length} file${files.length === 1 ? '' : 's'} failed only by timeout; rerunning alone:\n  ${files.join('\n  ')}`);
    const rerun = spawnSync(process.execPath, [vitest, 'run', ...files], { stdio: 'inherit' });
    status = rerun.status ?? 1;
    console.log(status === 0 ? 'Green alone: the first run was starved, not red.' : 'Still red alone.');
  }
}
rmSync(reportDir, { recursive: true, force: true });
process.exit(status);

function timedOut(file) {
  try {
    return retryableFiles(readFileSync(file, 'utf8'));
  } catch {
    return [];
  }
}
