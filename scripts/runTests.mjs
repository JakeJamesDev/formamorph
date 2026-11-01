#!/usr/bin/env node
// Runs vitest with the given arguments. A run whose only failures are expired timers reruns those files
// alone once: the machine is shared with other sessions, and a starved run is not a verdict. Every rerun
// appends one JSON line per test to the rerun log, so a green rerun still leaves a trace.
// Usage: node scripts/runTests.mjs [vitest args...]
import { execFileSync, spawnSync } from 'node:child_process';
import { appendFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rerunAllowed, rerunRecords, retryableFiles } from './testRetry.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const vitest = path.join(path.dirname(createRequire(import.meta.url).resolve('vitest/package.json')), 'vitest.mjs');
const reporterPath = (name) => path.join(here, name).replace(/\\/g, '/');
const reporters = ['--reporter=default', `--reporter=${reporterPath('slowTestReporter.mjs')}`, `--reporter=${reporterPath('runOutcomeReporter.mjs')}`];

/** Runs vitest, reruns timeout-only files alone once, records the rerun, and returns the exit status. A rerun it cannot record is red. */
export function runTests(args, { cwd = process.cwd(), env = process.env } = {}) {
  const reportDir = mkdtempSync(path.join(os.tmpdir(), 'run-tests-'));
  const outcomeFile = path.join(reportDir, 'outcome.json');
  const vitestRun = (vitestArgs, report) => spawnSync(
    process.execPath,
    [vitest, ...vitestArgs, ...reporters, '--reporter=junit', `--outputFile.junit=${report}`],
    { stdio: 'inherit', cwd, env: { ...env, RUN_TESTS_OUTCOME: outcomeFile } },
  ).status ?? 1;
  const report = path.join(reportDir, 'report.xml');
  let status = vitestRun(args, report);
  if (status !== 0) {
    const firstReport = readText(report);
    const files = retryableFiles(firstReport);
    if (files.length && !rerunAllowed(readOutcome(outcomeFile))) {
      console.log('\nA timeout came with an unhandled error or a broken run, so nothing reruns.');
    } else if (files.length) {
      console.log(`\n⚠ ${files.length} file${files.length === 1 ? '' : 's'} failed only by timeout; rerunning alone:\n  ${files.join('\n  ')}`);
      const rerunReport = path.join(reportDir, 'rerun.xml');
      status = vitestRun(['run', ...files], rerunReport);
      console.log(status === 0 ? '⚠ Green alone: the first run was starved, not red.' : 'Still red alone.');
      const records = rerunRecords(firstReport, readText(rerunReport), status === 0, files, runContext(args, cwd, env));
      if (!appendRecords(records, cwd, env)) status = 1;
    }
  }
  // CI uploads the log after every shard: an empty one means no rerun, and a missing one means a lost record.
  if (env.TEST_RERUN_LOG) appendRecords([], cwd, env);
  rmSync(reportDir, { recursive: true, force: true });
  return status;
}

function readText(file) {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}

function readOutcome(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function git(args, cwd) {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

/** The fields every record of one rerun shares. */
function runContext(args, cwd, env) {
  const at = new Date().toISOString();
  const sha = env.GITHUB_SHA ?? git(['rev-parse', 'HEAD'], cwd);
  if (!env.CI) return { sha, at, source: 'local' };
  const shard = args.join(' ').match(/--shard=(\d+)\//)?.[1];
  return { sha, at, source: 'ci', run: env.GITHUB_RUN_ID ?? null, shard: shard ? Number(shard) : null };
}

/** `TEST_RERUN_LOG`, or a file in the git common dir, which outlives a ticket worktree. */
function rerunLogPath(cwd, env) {
  if (env.TEST_RERUN_LOG) return path.resolve(cwd, env.TEST_RERUN_LOG);
  const commonDir = git(['rev-parse', '--path-format=absolute', '--git-common-dir'], cwd);
  return commonDir && path.join(commonDir, 'test-reruns.jsonl');
}

/** Appends the records to the rerun log and returns whether they were written. */
function appendRecords(records, cwd, env) {
  const log = rerunLogPath(cwd, env);
  try {
    appendFileSync(log, records.map((record) => `${JSON.stringify(record)}\n`).join(''));
    return true;
  } catch (error) {
    console.error(`Could not write the rerun log ${log}: ${error instanceof Error ? error.message : error}`);
    return false;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(runTests(process.argv.slice(2)));
}
