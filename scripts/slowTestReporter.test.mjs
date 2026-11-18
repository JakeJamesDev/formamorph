// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, it, expect } from 'vitest';
import { BUDGET_MS, basePaths, classify, loadFactor, newTests, overBudget, recordRun } from './slowTestReporter.mjs';

// The idle loop takes 10 ms; from t=10 000 on, the machine runs three times slower.
const REFERENCE = 10;
const samples = [
  { at: 0, ms: 10 },
  { at: 5_000, ms: 10 },
  { at: 10_000, ms: 30 },
  { at: 15_000, ms: 30 },
  { at: 20_000, ms: 30 },
];

describe('loadFactor', () => {
  it('reads the load from the samples inside the window', () => {
    expect(loadFactor(samples, 0, 5_000, REFERENCE)).toBe(1);
    expect(loadFactor(samples, 10_000, 20_000, REFERENCE)).toBe(3);
  });

  it('falls back to the run median when no sample falls inside', () => {
    expect(loadFactor(samples, 6_000, 7_000, REFERENCE)).toBe(3);
  });

  it('never reports a machine faster than idle', () => {
    expect(loadFactor([{ at: 0, ms: 5 }], 0, 1, REFERENCE)).toBe(1);
  });
});

describe('classify', () => {
  const test = (key, startTime, duration) => ({ key, startTime, duration });
  const history = { heavy: [3000, 3100, 2900], regressed: [1500, 1400, 1600], starved: [1500] };

  it('flags only a test slower than its own recent runs once load is taken out', () => {
    const { regressed, loaded, heavy } = classify([
      test('starved', 10_000, 4_500), // 1.5 s idle under 3× load: slow only from load
      test('heavy', 10_000, 9_000), // 3 s idle, as it always runs
      test('regressed', 0, 3_200), // 3.2 s idle against a 1.5 s median
      test('new', 0, 2_500), // no history yet: heavy, not a regression
      test('fast', 0, 500),
    ], samples, REFERENCE, 2000, history);
    expect(regressed.map((t) => [t.key, Math.round(t.idle), t.usual])).toEqual([['regressed', 3200, 1500]]);
    expect(loaded.map((t) => [t.key, Math.round(t.idle)])).toEqual([['starved', 1500]]);
    expect(heavy).toBe(2);
  });
});

describe('recordRun', () => {
  it('adds each test\'s idle cost and keeps the last five runs', () => {
    const next = recordRun({ a: [1, 2, 3, 4, 5] }, [{ key: 'a', startTime: 10_000, duration: 600 }, { key: 'b', startTime: 0, duration: 40 }], samples, REFERENCE);
    expect(next).toEqual({ a: [2, 3, 4, 5, 200], b: [40] });
  });
});

describe('overBudget', () => {
  const test = (file, startTime, duration) => ({ key: file, file, startTime, duration });

  it('holds each test to its own level\'s budget, with load taken out', () => {
    const over = overBudget([
      test('src/lib/a.test.ts', 0, BUDGET_MS.unit), // unit at its budget
      test('src/lib/b.test.ts', 10_000, 600), // 200 ms idle under 3× load
      test('src/components/c.test.tsx', 0, 1000), // under the component budget
      test('src/views/d.test.tsx', 0, 4000), // under the view budget
      test('scripts/e.test.mjs', 0, 2500),
      test('src/lib/scan.test.ts', 0, 2500), // always run, so a scan
    ], samples, REFERENCE, { 'src/lib/scan.test.ts': true });
    expect(over.map((t) => [t.file, t.level, t.budget])).toEqual([
      ['src/lib/a.test.ts', 'unit', 250],
      ['scripts/e.test.mjs', 'script', 2000],
      ['src/lib/scan.test.ts', 'scan', 2000],
    ]);
  });
});

describe('newTests', () => {
  const test = (file, title) => ({ file, title });

  it('counts a test as new in an added file, or when its title is not in the base text', () => {
    const fresh = newTests([
      test('added.test.ts', 'anything'),
      test('changed.test.ts', 'kept'),
      test('changed.test.ts', 'added'),
      test('changed.test.ts', "reads a user's choice"), // the base escapes the quote
      test('unchanged.test.ts', 'whatever'),
    ], { 'added.test.ts': null, 'changed.test.ts': "it('kept', () => {});\nit('reads a user\\'s choice', () => {});\n" });
    expect(fresh.map((t) => `${t.file} > ${t.title}`)).toEqual(['added.test.ts > anything', 'changed.test.ts > added']);
  });
});

describe('basePaths', () => {
  it('maps a renamed file to its old path, an added one to null, and the rest to themselves', () => {
    expect(basePaths(['R087', 'old.test.ts', 'new.test.ts', 'A', 'added.test.ts', 'M', 'kept.test.ts', ''].join('\0')))
      .toEqual({ 'new.test.ts': 'old.test.ts', 'added.test.ts': null, 'kept.test.ts': 'kept.test.ts' });
  });
});

// A real vitest run in a temp repo whose branch adds slow tests, with this reporter attached.
describe('the new-test budget warning', () => {
  const vitest = path.join(path.dirname(createRequire(import.meta.url).resolve('vitest/package.json')), 'vitest.mjs');
  const reporter = fileURLToPath(new URL('./slowTestReporter.mjs', import.meta.url)).replace(/\\/g, '/');
  // A wall-clock sleep: up to 4× load it still reads past the 250 ms unit budget at idle.
  const SLOW = (title) => `it.concurrent('${title}', async () => { await new Promise((r) => setTimeout(r, 1000)); });\n`;
  const folders = [];
  afterEach(() => {
    for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
  });

  it('names each slow new test and leaves the run green', () => {
    const cwd = mkdtempSync(path.join(os.tmpdir(), 'slow-new-test-'));
    folders.push(cwd);
    const hooks = path.join(cwd, '.no-hooks');
    mkdirSync(hooks);
    const git = (...args) => spawnSync('git', ['-c', `core.hooksPath=${hooks}`, '-c', 'user.name=t', '-c', 'user.email=t@example.com', ...args], { cwd, encoding: 'utf8' });
    git('init', '-q', '-b', 'main');
    writeFileSync(path.join(cwd, '.gitignore'), '.no-hooks\nnode_modules\n');
    writeFileSync(path.join(cwd, 'vitest.config.mjs'), "export default { test: { globals: true, environment: 'node', include: ['*.case.mjs'] } };\n");
    writeFileSync(path.join(cwd, 'old.case.mjs'), SLOW('old slow'));
    writeFileSync(path.join(cwd, 'before.case.mjs'), SLOW('moved slow'));
    git('add', '.');
    git('commit', '-q', '-m', 'base');
    git('checkout', '-q', '-b', 'feature');
    git('mv', 'before.case.mjs', 'after.case.mjs');
    writeFileSync(path.join(cwd, 'fresh.case.mjs'), SLOW('fresh slow'));
    git('add', 'fresh.case.mjs');
    git('commit', '-q', '-m', 'add a file and move one');
    writeFileSync(path.join(cwd, 'old.case.mjs'), SLOW('old slow') + SLOW('added slow')); // uncommitted
    writeFileSync(path.join(cwd, 'loose.case.mjs'), SLOW('loose slow')); // untracked

    const run = spawnSync(process.execPath, [vitest, 'run', '--reporter=default', `--reporter=${reporter}`], { cwd, encoding: 'utf8' });
    const warned = run.stdout.split('\n').filter((line) => line.includes('⚠') && line.includes('unit budget'));
    expect(run.status).toBe(0);
    expect(run.stdout).toContain('New tests over budget: 3');
    expect(warned.map((line) => line.trim().split('  ').pop()).sort()).toEqual(['fresh.case.mjs > fresh slow', 'loose.case.mjs > loose slow', 'old.case.mjs > added slow']);
  }, 60_000);
});
