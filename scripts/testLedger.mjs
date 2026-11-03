#!/usr/bin/env node
// Writes the Test Ledger: timed suite runs, per-file coverage of each module under test, and failure history.
// Raw output stays untracked in <git common dir>/test-ledger, which outlives a ticket worktree.
// Usage: node scripts/testLedger.mjs [--runs <n>] [--coverage] [--coverage-workers <n>] [--coverage-module <path>] [--history] [--files <list file>] [--dir <path>]
//        node scripts/testLedger.mjs --stale | --report | --real-bug
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { runTests } from './runTests.mjs';
import { gatherHistory } from './testLedgerHistory.mjs';
import { TEST_FILE, buildRecords, evidenceHash, hashInputs, importGraph, isStale, ledgerReport, moduleUnderTest, testOnlyFiles } from './testLedgerRecords.mjs';
import { ALWAYS_RUN, gitFiles } from './testSelection.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const vitest = path.join(path.dirname(require.resolve('vitest/package.json')), 'vitest.mjs');
const REPORTER = path.join(here, 'testLedgerReporter.mjs').replace(/\\/g, '/');
const SOURCE_FILE = /\.(?:tsx?|mjs|cjs|js)$/;
const COVERAGE_TIMEOUT_MS = 5 * 60_000;

const readOrNull = (file) => (existsSync(file) ? readFileSync(file, 'utf8') : null);
const readJson = (file, fallback) => (existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : fallback);

/** The import graph of the tree, for naming each test's module and hash inputs. */
function treeGraph() {
  const files = gitFiles('ls-files', '--cached', '--others', '--exclude-standard').filter((file) => SOURCE_FILE.test(file) && existsSync(file) && !file.startsWith('marketing/'));
  const graph = importGraph(Object.fromEntries(files.map((file) => [file, readFileSync(file, 'utf8')])));
  return { graph, testOnly: testOnlyFiles(graph) };
}

function evidenceOf(file, { graph, testOnly }) {
  const unit = moduleUnderTest(file, graph, testOnly);
  const inputs = hashInputs(file, unit.path, graph, testOnly, existsSync);
  return { moduleUnderTest: unit, hashInputs: inputs, hash: evidenceHash(inputs, readOrNull) };
}

const toolchain = () => ({
  vitest: require('vitest/package.json').version,
  vite: require('vite/package.json').version,
  node: process.version,
});

/** A run's status: a rerun can end green while the report keeps the first pass's failed tests. */
export function runStatus(exitStatus, modules) {
  if (exitStatus !== 0) return 'failed';
  return modules.some((module) => module.tests.some((test) => test.state === 'failed')) ? 'green-after-rerun' : 'passed';
}

/** One timed run through the logged runner, written to the ledger's `runs` folder. */
function timedRun(dir, files, tree) {
  const runFile = path.join(dir, 'runs', `${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  mkdirSync(path.dirname(runFile), { recursive: true });
  const started = Date.now();
  const status = runTests(['run', ...files, `--reporter=${REPORTER}`], { env: { ...process.env, TEST_LEDGER_RUN_FILE: runFile } });
  const wallMs = Date.now() - started;
  if (!existsSync(runFile)) throw new Error(`Vitest exited ${status} before it wrote a run report, so this run is not recorded.`);
  const report = JSON.parse(readFileSync(runFile, 'utf8'));
  const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  writeFileSync(runFile, JSON.stringify({
    ...report,
    at: new Date(started).toISOString(),
    sha,
    toolchain: toolchain(),
    wallMs,
    status: runStatus(status, report.modules),
    scope: files.length ? 'subset' : 'full',
    modules: report.modules.map((module) => ({ ...module, ...evidenceOf(module.file, tree) })),
  }));
  console.log(`Timed run: ${(wallMs / 1000).toFixed(1)} s, status ${status}.`);
}

const coverageFile = (dir, file) => path.join(dir, 'coverage', `${createHash('sha1').update(file).digest('hex')}.json`);

/** Covered line and branch ids of `module` from a `coverage-final.json`, or null when the report does not hold it. */
export function coverageEntry(final, module) {
  const data = Object.entries(final).find(([file]) => file.replace(/\\/g, '/').endsWith(`/${module}`))?.[1];
  if (!data) return null;
  const lines = new Map();
  for (const [id, { start }] of Object.entries(data.statementMap)) lines.set(start.line, (lines.get(start.line) ?? false) || data.s[id] > 0);
  const branchIds = Object.entries(data.b).flatMap(([id, arms]) => arms.map((count, arm) => [`${id}:${arm}`, count > 0]));
  const functions = Object.values(data.f);
  return {
    module,
    lines: { total: lines.size, covered: [...lines].filter(([, hit]) => hit).map(([line]) => line).sort((a, b) => a - b) },
    branches: { total: branchIds.length, covered: branchIds.filter(([, hit]) => hit).map(([id]) => id) },
    functions: { total: functions.length, covered: functions.filter((count) => count > 0).length },
  };
}

/** Runs one test file alone with coverage on its module. A hang is killed and stored as an error. */
function coverageOne(file, evidence, module, dir) {
  const reports = mkdtempSync(path.join(os.tmpdir(), 'test-ledger-coverage-'));
  const project = file.endsWith('.test.ts') ? 'node' : 'dom';
  const args = [vitest, 'run', file, '--project', project, '--reporter=dot', '--coverage.enabled', '--coverage.provider=v8',
    `--coverage.include=${module}`, '--coverage.reporter=json', `--coverage.reportsDirectory=${reports}`, '--coverage.reportOnFailure'];
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(process.execPath, args, { stdio: 'ignore', windowsHide: true });
    const kill = () => (process.platform === 'win32'
      ? spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
      : child.kill('SIGKILL'));
    let hung = false;
    const timer = setTimeout(() => { hung = true; kill(); }, COVERAGE_TIMEOUT_MS);
    child.on('close', (status) => {
      clearTimeout(timer);
      const final = readJson(path.join(reports, 'coverage-final.json'), null);
      const entry = final && coverageEntry(final, module);
      rmSync(reports, { recursive: true, force: true });
      const result = { file, hash: evidence.hash, moduleHash: evidenceHash([module], readOrNull), ms: Date.now() - started, status, ...(entry ?? { error: hung ? 'hung' : 'no coverage for the module' }) };
      writeFileSync(coverageFile(dir, file), JSON.stringify(result));
      resolve(result);
    });
  });
}

export const needsCoverage = (stored, hash, module) => stored.hash !== hash || stored.module !== module || Boolean(stored.error);

/** Coverage for every test file with no good entry at its hash, so an interrupted pass resumes. `moduleOverride` measures that module instead of each file's own. */
async function coverageRuns(dir, files, workers, tree, moduleOverride) {
  mkdirSync(path.join(dir, 'coverage'), { recursive: true });
  const queue = files.map((file) => {
    const evidence = evidenceOf(file, tree);
    return { file, evidence, module: moduleOverride ?? evidence.moduleUnderTest.path };
  }).filter(({ file, evidence, module }) => module && needsCoverage(readJson(coverageFile(dir, file), {}), evidence.hash, module));
  const total = queue.length;
  const started = Date.now();
  let done = 0;
  let errors = 0;
  const worker = async () => {
    for (let item = queue.shift(); item; item = queue.shift()) {
      const result = await coverageOne(item.file, item.evidence, item.module, dir);
      done++;
      if (result.error) errors++;
      if (done % 50 === 0 || done === total) console.log(`Coverage ${done}/${total}, ${errors} errors, ${((Date.now() - started) / 1000).toFixed(0)} s.`);
    }
  };
  await Promise.all(Array.from({ length: workers }, worker));
}

export function readDirJson(dir) {
  return existsSync(dir) ? readdirSync(dir).filter((name) => name.endsWith('.json')).map((name) => JSON.parse(readFileSync(path.join(dir, name), 'utf8'))) : [];
}

/** The ledger's records, each with whether its hash still matches the tree. */
export function readLedger(dir) {
  const file = path.join(dir, 'ledger.jsonl');
  const staleByFile = new Map();
  return readFileSync(file, 'utf8').split('\n').filter(Boolean).map((line) => {
    const record = JSON.parse(line);
    if (!staleByFile.has(record.file)) staleByFile.set(record.file, isStale(record, readOrNull));
    return { ...record, stale: staleByFile.get(record.file) };
  });
}

async function main() {
  const { values } = parseArgs({
    options: {
      runs: { type: 'string' },
      coverage: { type: 'boolean', default: false },
      'coverage-workers': { type: 'string', default: '8' },
      'coverage-module': { type: 'string' },
      history: { type: 'boolean', default: false },
      files: { type: 'string' },
      dir: { type: 'string' },
      stale: { type: 'boolean', default: false },
      report: { type: 'boolean', default: false },
      'real-bug': { type: 'boolean', default: false },
    },
  });
  if (values['coverage-module'] && !values.dir) throw new Error('--coverage-module needs --dir.');
  const commonDir = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { encoding: 'utf8' }).trim();
  const dir = path.resolve(values.dir ?? path.join(commonDir, 'test-ledger'));
  mkdirSync(dir, { recursive: true });

  if (values.stale) {
    const stale = readLedger(dir).filter((record) => record.stale);
    const files = [...new Set(stale.map((record) => record.file))];
    console.log(`${stale.length} stale records in ${files.length} files.`);
    if (files.length) console.log(files.join('\n'));
    return;
  }
  if (values.report) {
    const records = readLedger(dir);
    console.log(ledgerReport(readDirJson(path.join(dir, 'runs')), records, readJson(path.join(dir, 'history-meta.json'), {})));
    return;
  }

  if (values['real-bug']) {
    for (const record of readLedger(dir).filter((row) => row.realBug.length)) {
      console.log(`${record.id}\t${record.realBug.map((entry) => `${entry.rule} ${entry.sha.slice(0, 9)}`).join(', ')}`);
    }
    return;
  }

  const files = values.files ? readFileSync(values.files, 'utf8').split('\n').map((line) => line.trim()).filter(Boolean) : [];
  const tree = treeGraph();
  // An empty list is a proof whose files are all gone, never the whole suite.
  const emptyList = values.files && !files.length;
  for (let run = 0; !emptyList && run < Number(values.runs ?? 0); run++) timedRun(dir, files, tree);
  if (values.coverage) {
    const testFiles = values.files ? files : [...tree.graph.keys()].filter((file) => TEST_FILE.test(file));
    await coverageRuns(dir, testFiles, Number(values['coverage-workers']), tree, values['coverage-module']);
  }
  if (values.history) {
    const history = await gatherHistory({ dir, commonDir, cwd: process.cwd() });
    writeFileSync(path.join(dir, 'history.json'), JSON.stringify(history));
    writeFileSync(path.join(dir, 'history-meta.json'), JSON.stringify(history.meta));
  }
  const coverage = Object.fromEntries(readDirJson(path.join(dir, 'coverage')).map((entry) => [entry.file, entry]));
  const records = buildRecords({
    runs: readDirJson(path.join(dir, 'runs')),
    coverage,
    history: readJson(path.join(dir, 'history.json'), {}),
    alwaysRun: ALWAYS_RUN,
    exists: existsSync,
  });
  writeFileSync(path.join(dir, 'ledger.jsonl'), records.map((record) => JSON.stringify(record)).join('\n') + '\n');
  console.log(`Wrote ${records.length} records to ${path.join(dir, 'ledger.jsonl')}.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
