#!/usr/bin/env node
// Runs vitest with the given arguments. A run whose only failures are expired timers reruns those files
// alone once: the machine is shared with other sessions, and a starved run is not a verdict.
// Usage: node scripts/runTests.mjs [vitest args...]
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { retryableFiles } from './testRetry.mjs';

const vitest = path.join(path.dirname(createRequire(import.meta.url).resolve('vitest/package.json')), 'vitest.mjs');
const reporters = ['--reporter=default', '--reporter=./scripts/slowTestReporter.mjs'];

/** Runs vitest, reruns timeout-only files alone once, and returns the exit status. */
export function runTests(args) {
  const reportDir = mkdtempSync(path.join(os.tmpdir(), 'run-tests-'));
  const report = path.join(reportDir, 'report.xml');
  const junit = ['--reporter=junit', `--outputFile.junit=${report}`];
  const result = spawnSync(process.execPath, [vitest, ...args, ...reporters, ...junit], { stdio: 'inherit' });
  let status = result.status ?? 1;
  if (status !== 0) {
    const files = timedOut(report);
    if (files.length) {
      console.log(`\n⚠ ${files.length} file${files.length === 1 ? '' : 's'} failed only by timeout; rerunning alone:\n  ${files.join('\n  ')}`);
      const rerun = spawnSync(process.execPath, [vitest, 'run', ...files, ...reporters], { stdio: 'inherit' });
      status = rerun.status ?? 1;
      console.log(status === 0 ? '⚠ Green alone: the first run was starved, not red.' : 'Still red alone.');
    }
  }
  rmSync(reportDir, { recursive: true, force: true });
  return status;
}

function timedOut(file) {
  try {
    return retryableFiles(readFileSync(file, 'utf8'));
  } catch {
    return [];
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(runTests(process.argv.slice(2)));
}
