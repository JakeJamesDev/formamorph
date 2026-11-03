#!/usr/bin/env node
// The kept-protection check: proves a moved, merged or deleted test lost nothing. The recipe is in docs-internal/specs/test-sweep/kept-protection.md.
// Usage: node scripts/keptProtection.mjs coverage --before <ledger dir> --after <ledger dir> [--context <ledger dir>]
//        node scripts/keptProtection.mjs mutants --module <path> --out <report> [--tests <list file>] [--concurrency <n>] [--force]
//        node scripts/keptProtection.mjs kills --before <report> --after <report>
//        node scripts/keptProtection.mjs project --module <path> --mutants <n> --wall-seconds <s> [--concurrency <n>]
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { calibrate, coverageChange, coverageReport, deepCoverageModules, isScanner, killChange, killReport, projectMutationCost, projectionReport, strykerConfig, testChange } from './keptProtectionRules.mjs';
import { readDirJson, readLedger } from './testLedger.mjs';
import { ALWAYS_RUN, gitFiles } from './testSelection.mjs';

const require = createRequire(import.meta.url);
const commonDir = () => execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { encoding: 'utf8' }).trim();
const mainLedger = () => path.join(commonDir(), 'test-ledger');

function coverageCommand({ before, after, context }) {
  const failed = [before, after].filter((dir) => readDirJson(path.join(dir, 'runs')).some((run) => run.status === 'failed'));
  if (failed.length) {
    console.log(`A run failed in ${failed.join(' and ')}, so a file that did not load holds no records.`);
    return 1;
  }
  const was = readLedger(before);
  const now = readLedger(after);
  const modules = coverageChange({ before: was, after: now, context: readLedger(context ?? mainLedger()) });
  console.log(coverageReport(modules, testChange(was, now)));
  return modules.length && modules.every((row) => row.kept) ? 0 : 1;
}

/** The test files to mutate against: a given list, or the module's family in the ledger, without scanners. */
function testFilesFor(module, listFile) {
  const listed = listFile
    ? readFileSync(listFile, 'utf8').split('\n').map((line) => line.trim()).filter(Boolean)
    : [...new Set(readLedger(mainLedger()).filter((record) => record.moduleUnderTest === module).map((record) => record.file))].filter((file) => existsSync(file));
  const scanners = listed.filter((file) => isScanner(file, readFileSync(file, 'utf8'), ALWAYS_RUN));
  if (scanners.length) console.log(`Left out as scanners: ${scanners.join(', ')}.`);
  return listed.filter((file) => !scanners.includes(file));
}

/** Deletes a module's sandboxes and their Vitest caches in the shared node_modules. Each junction goes first, so nothing follows it. */
function removeSandboxes(tempDir) {
  if (!existsSync(tempDir)) return;
  for (const name of readdirSync(tempDir)) {
    const link = path.join(tempDir, name, 'node_modules');
    if (lstatSync(link, { throwIfNoEntry: false })?.isSymbolicLink()) unlinkSync(link);
    // Windows can refuse this just after the workers exit; the next run retries it.
    try {
      rmSync(path.join(tempDir, name), { recursive: true, force: true, maxRetries: 10, retryDelay: 500 });
    } catch (error) {
      console.warn(`Could not delete ${name} yet: ${error instanceof Error ? error.message : error}`);
    }
    const caches = path.resolve('node_modules/.vite');
    for (const cache of readdirSync(caches).filter((folder) => folder.startsWith(`${name}-`))) rmSync(path.join(caches, cache), { recursive: true, force: true });
  }
}

function mutantsCommand({ module, out, tests, concurrency, force }) {
  const testFiles = testFilesFor(module, tests);
  if (!testFiles.length) throw new Error(`${module} has no test files to mutate against.`);
  const store = path.join(mainLedger(), 'stryker');
  mkdirSync(store, { recursive: true });
  const slug = createHash('sha1').update(module).digest('hex');
  const reportFile = path.resolve(out);
  mkdirSync(path.dirname(reportFile), { recursive: true });
  // Outside the worktree, whose removal would follow a junction a killed run left inside it.
  const tempDir = path.join(path.dirname(commonDir()), '.stryker-tmp', slug);
  removeSandboxes(tempDir);
  const configFile = path.join(store, `${slug}.config.json`);
  writeFileSync(configFile, JSON.stringify(strykerConfig({
    module,
    testFiles,
    reportFile,
    incrementalFile: path.join(store, `${slug}.incremental.json`),
    tempDirName: tempDir,
    roots: [...new Set(gitFiles('ls-files').map((file) => file.split('/')[0]))],
    concurrency: Number(concurrency),
    force,
  }), null, 2));
  const stryker = path.join(path.dirname(require.resolve('@stryker-mutator/core/package.json')), 'bin', 'stryker.js');
  const started = Date.now();
  const { status } = spawnSync(process.execPath, [stryker, 'run', configFile], { stdio: 'inherit', windowsHide: true });
  const wallMs = Date.now() - started;
  removeSandboxes(tempDir);
  if (status !== 0 || !existsSync(reportFile)) return status || 1;
  writeFileSync(reportFile, JSON.stringify({ ...JSON.parse(readFileSync(reportFile, 'utf8')), wallMs, concurrency: Number(concurrency), testList: testFiles }));
  console.log(`Wrote ${out} in ${(wallMs / 1000).toFixed(1)} s.`);
  return 0;
}

function killsCommand({ before, after }) {
  const change = killChange(JSON.parse(readFileSync(before, 'utf8')), JSON.parse(readFileSync(after, 'utf8')));
  console.log(killReport(change));
  return change.kept ? 0 : 1;
}

function projectCommand({ module, mutants, 'wall-seconds': wallSeconds, concurrency }) {
  const modules = deepCoverageModules(readLedger(mainLedger()));
  const measured = modules.find((row) => row.module === module);
  if (!measured) throw new Error(`${module} has no deep-coverage area in the ledger.`);
  const calibration = calibrate({ mutants: Number(mutants), lines: measured.lines, wallMs: Number(wallSeconds) * 1000, concurrency: Number(concurrency), perMutantMs: measured.perMutantMs });
  console.log(projectionReport(projectMutationCost(modules, calibration), calibration));
  return 0;
}

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    before: { type: 'string' },
    after: { type: 'string' },
    context: { type: 'string' },
    module: { type: 'string' },
    out: { type: 'string' },
    tests: { type: 'string' },
    concurrency: { type: 'string', default: '4' },
    force: { type: 'boolean', default: false },
    mutants: { type: 'string' },
    'wall-seconds': { type: 'string' },
  },
});
const commands = { coverage: coverageCommand, mutants: mutantsCommand, kills: killsCommand, project: projectCommand };
const command = commands[positionals[0]];
if (!command) throw new Error(`Name a command: ${Object.keys(commands).join(', ')}.`);
process.exit(command(values));
