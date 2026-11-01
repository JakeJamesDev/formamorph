// @vitest-environment node
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runTests } from './runTests.mjs';

// Each case runs real vitest in a temp folder, so the report, the timeout and the unhandled error are vitest's own.
const config = (extra = '') => `export default { test: { globals: true, environment: 'node', testTimeout: 500, include: ['*.case.mjs']${extra} } };\n`;
const NOTE_RUN = "appendFileSync('runs.log', 'x');";
const IMPORTS = "import { appendFileSync, existsSync, writeFileSync } from 'node:fs';\n";
const STARVED_ONCE = `${IMPORTS}describe('group', () => { it('starved', async () => {
  ${NOTE_RUN}
  if (existsSync('seen')) return;
  writeFileSync('seen', '');
  await new Promise(() => {});
}); });\n`;
const ALWAYS_TIMES_OUT = `${IMPORTS}it('hangs', async () => { ${NOTE_RUN} await new Promise(() => {}); });\n`;
const REAL_FAILURE = "it('is red', () => { expect(1).toBe(2); });\n";
const LEAKS_AN_ERROR = "it('leaks', async () => { Promise.reject(new Error('leaked')); await new Promise((r) => setTimeout(r, 50)); });\n";
const CRASHES_ITS_WORKER = "it('crashes', () => { process.kill(process.pid, 'SIGKILL'); });\n";

const folders = [];
const LOCAL_ENV = Object.fromEntries(Object.entries(process.env).filter(([key]) => !['CI', 'GITHUB_RUN_ID', 'GITHUB_SHA', 'GITHUB_ACTIONS'].includes(key)));

function run(cases, { args = ['run'], env = {}, configExtra } = {}) {
  const cwd = mkdtempSync(path.join(os.tmpdir(), 'run-tests-case-'));
  folders.push(cwd);
  writeFileSync(path.join(cwd, 'vitest.config.mjs'), config(configExtra));
  for (const [name, source] of Object.entries(cases)) writeFileSync(path.join(cwd, name), source);
  const status = runTests(args, { cwd, env: { ...LOCAL_ENV, TEST_RERUN_LOG: 'reruns.jsonl', ...env } });
  const log = path.join(cwd, 'reruns.jsonl');
  const runs = path.join(cwd, 'runs.log');
  return {
    status,
    logWritten: existsSync(log),
    records: existsSync(log) && statSync(log).isFile() ? readFileSync(log, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line)) : [],
    runCount: existsSync(runs) ? readFileSync(runs, 'utf8').length : 0,
  };
}

afterEach(() => {
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
});

describe('runTests', () => {
  it('reruns a forced timeout alone, passes on green, and records the test, the file and the result', () => {
    const { status, records, runCount } = run({ 'a.case.mjs': STARVED_ONCE });
    expect(status).toBe(0);
    expect(runCount).toBe(2);
    expect(records).toEqual([expect.objectContaining({
      test: 'a.case.mjs > group > starved',
      file: 'a.case.mjs',
      result: 'passed-alone',
      message: expect.stringMatching(/^Test timed out in 500ms/),
      source: 'local',
    })]);
  }, 120_000);

  it('stays red when the rerun times out again, and ties a CI record to its run and shard', () => {
    const { status, records } = run(
      { 'a.case.mjs': ALWAYS_TIMES_OUT },
      { args: ['run', '--shard=1/1'], env: { CI: 'true', GITHUB_RUN_ID: '4242', GITHUB_SHA: 'abc' } },
    );
    expect(status).toBe(1);
    expect(records).toEqual([expect.objectContaining({
      test: 'a.case.mjs > hangs', result: 'failed-alone', source: 'ci', run: '4242', shard: 1, sha: 'abc',
    })]);
  }, 120_000);

  it('never retries a real failure, even beside a timeout that would pass alone', () => {
    const { status, records, runCount, logWritten } = run({ 'a.case.mjs': STARVED_ONCE, 'b.case.mjs': REAL_FAILURE });
    expect(status).toBe(1);
    expect(runCount).toBe(1);
    expect(records).toEqual([]);
    expect(logWritten).toBe(true);
  }, 120_000);

  it('stays red on a green rerun it cannot record', () => {
    // The log path is a folder, so the append fails.
    const { status, runCount } = run({ 'a.case.mjs': STARVED_ONCE }, { env: { TEST_RERUN_LOG: '.' } });
    expect(status).toBe(1);
    expect(runCount).toBe(2);
  }, 120_000);

  it('stays red on a timeout plus a crashed worker', () => {
    // One file at a time, larger file first: the timeout lands before the crash, and no worker outlives the run.
    const { status, records, runCount } = run(
      { 'a.case.mjs': STARVED_ONCE, 'b.case.mjs': CRASHES_ITS_WORKER },
      { configExtra: ', fileParallelism: false' },
    );
    expect(status).toBe(1);
    expect(runCount).toBe(1);
    expect(records).toEqual([]);
  }, 120_000);

  it('stays red on a timeout plus an unhandled error, which a rerun of the timeout alone would turn green', () => {
    const { status, records, runCount } = run({ 'a.case.mjs': STARVED_ONCE, 'b.case.mjs': LEAKS_AN_ERROR });
    expect(status).toBe(1);
    expect(runCount).toBe(1);
    expect(records).toEqual([]);
  }, 120_000);
});
