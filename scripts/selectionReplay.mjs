#!/usr/bin/env node
// The selection replay harness: injects bugs, runs every test, and requires each red test to be selected (Q12).
// Runs happen in a throwaway clone. Results stay untracked in <git common dir>/selection-replay and a run resumes from them.
// Usage: node scripts/selectionReplay.mjs run [--landings <n>] [--code-mutants <n>] [--data-mutants <n>] [--landing <sha>]... [--seed <n>] [--since <date>]
//          [--selector <script>] [--base <ref>] [--max-hours <n>] [--tests-subset <list file>] [--rescore <dir> [--drop-red <file>]...] [--dir <path>] [--sandbox <path>] [--modules <path>]
//        node scripts/selectionReplay.mjs report [--dir <path>] [--json]
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { appendFileSync, cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { applyMutant, mutantId, mutationPopulation, replayPlan, replayReport, sampleLandings, sampleMutants, scoreBug, settingConflicts, summarize } from './selectionReplayRules.mjs';
import { fitsCommandLine } from './testSelection.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const REPORTER = path.join(here, 'selectedTestsReporter.mjs').replace(/\\/g, '/');
const RUN_TIMEOUT_MS = 30 * 60_000;
const INSTALLS_KEPT = 2;
const ERROR_TAIL = 600;
// A clone made from inside a vitest run must not inherit that run's state.
const childEnv = () => Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('VITEST') && key !== 'NODE_ENV' && key !== 'TEST'));

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const tryGit = (cwd, ...args) => {
  try {
    return git(cwd, ...args);
  } catch {
    return null;
  }
};
const commonDir = (cwd) => git(cwd, 'rev-parse', '--path-format=absolute', '--git-common-dir');

/** Calls `work` with a temp folder that goes when it ends. */
async function withScratch(work) {
  const scratch = mkdtempSync(path.join(os.tmpdir(), 'selection-replay-'));
  try {
    return await work(scratch);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

/** A landing's changed files, each with its status. */
function diffEntries(cwd, from, to) {
  return git(cwd, 'diff', '--name-status', '--no-renames', from, to).split('\n').filter(Boolean).map((line) => {
    const [status, file] = line.split('\t');
    return { status, path: file };
  });
}

/** A vitest process in `cwd`, killed at the timeout. */
function vitestProcess(cwd, args, env = {}) {
  const vitest = path.join(cwd, 'node_modules', 'vitest', 'vitest.mjs');
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [vitest, ...args], { cwd, stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true, env: { ...childEnv(), ...env } });
    let errors = '';
    child.stderr.on('data', (chunk) => { errors = (errors + chunk).slice(-ERROR_TAIL); });
    let hung = false;
    const timer = setTimeout(() => {
      hung = true;
      if (process.platform === 'win32') spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
      else child.kill('SIGKILL');
    }, RUN_TIMEOUT_MS);
    child.on('close', (status) => {
      clearTimeout(timer);
      resolve({ status, hung, errors });
    });
  });
}

/** Each red file of a JSON report, mapped to its failed test names; a file that failed to load has none of its own. A crashed worker's file reads `passed` with its test left `pending`, so an unfinished test is red. */
export function redFiles(report, root) {
  const red = {};
  for (const result of report.testResults) {
    const tests = result.assertionResults.filter((test) => test.status === 'failed' || test.status === 'pending').map((test) => test.fullName);
    if (result.status !== 'failed' && !tests.length) continue;
    red[path.relative(root, result.name).replace(/\\/g, '/')] = tests.length ? tests : ['(the file failed to load)'];
  }
  return red;
}

/** Runs tests in `cwd` and reads their report. Only a report counts: no report, or a hang, is an invalid run rather than a green one. */
const runVitest = (cwd, files) => withScratch(async (scratch) => {
  const report = path.join(scratch, 'report.json');
  const { status, hung } = await vitestProcess(cwd, ['run', ...files, '--reporter=json', `--outputFile=${report}`]);
  if (hung) return { valid: false, reason: 'hung' };
  if (!existsSync(report)) return { valid: false, reason: `vitest exited ${status} with no report` };
  const parsed = JSON.parse(readFileSync(report, 'utf8'));
  return { valid: true, red: redFiles(parsed, realpathSync(cwd)), files: parsed.testResults.length, failed: status !== 0 };
});

/** What `selector` would run for a change since `base`, read through the gate's own `vitest related`. A listing that fails throws, so it never reads as empty. */
function selectedTests(cwd, selector, base) {
  const paths = execFileSync(process.execPath, [selector, base, '--list'], { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: RUN_TIMEOUT_MS, env: childEnv() }).split(/\r?\n/).filter(Boolean);
  return withScratch(async (scratch) => {
    const listing = path.join(scratch, 'selected.json');
    // The gate runs everything when its paths don't fit on a command line.
    const mode = fitsCommandLine(paths) ? ['related', '--run', ...paths] : ['run'];
    const { status, hung, errors } = await vitestProcess(cwd, [...mode, '--passWithNoTests', `--reporter=${REPORTER}`], { SELECTED_TESTS_FILE: listing });
    if (hung || status !== 0) throw new Error(`The selection listing exited ${hung ? 'hung' : status}: ${errors}`);
    return existsSync(listing) ? JSON.parse(readFileSync(listing, 'utf8')) : [];
  });
}

/** Points the clone's node_modules at `target`, replacing only a link it made. */
function linkModules(cwd, target) {
  const link = path.join(cwd, 'node_modules');
  const stat = lstatSync(link, { throwIfNoEntry: false });
  if (stat && !stat.isSymbolicLink()) throw new Error(`${link} is not a link.`);
  if (stat) unlinkSync(link);
  symlinkSync(target, link, 'junction');
}

/** The dependency identity of a tree: its lockfile and its patches. */
const installKey = (cwd, sha) => `${tryGit(cwd, 'rev-parse', `${sha}:package-lock.json`) ?? 'none'}-${tryGit(cwd, 'rev-parse', `${sha}:patches`) ?? 'none'}`;

/** A tree's own install, for a tree whose lockfile differs from the base's. Older installs go, because each is large. */
export function ownInstall(cwd, installs, key) {
  const dir = path.join(installs, key);
  const done = path.join(dir, '.installed');
  if (existsSync(done)) return path.join(dir, 'node_modules');
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  for (const name of ['package.json', 'package-lock.json']) cpSync(path.join(cwd, name), path.join(dir, name));
  if (existsSync(path.join(cwd, 'patches'))) cpSync(path.join(cwd, 'patches'), path.join(dir, 'patches'), { recursive: true });
  const { status } = spawnSync('npm ci --no-audit --no-fund', { cwd: dir, stdio: 'ignore', shell: true, windowsHide: true, env: { ...childEnv(), ELECTRON_SKIP_BINARY_DOWNLOAD: '1' } });
  if (status !== 0) throw new Error(`npm ci exited ${status} for the install ${key}.`);
  writeFileSync(done, '');
  const others = readdirSync(installs).filter((name) => name !== key).map((name) => path.join(installs, name)).sort((a, b) => statSync(a).mtimeMs - statSync(b).mtimeMs);
  for (const other of others.slice(0, Math.max(0, others.length - INSTALLS_KEPT + 1))) rmSync(other, { recursive: true, force: true });
  return path.join(dir, 'node_modules');
}

/** A clone with no hooks, whose checkouts and cleans can't touch a real checkout. */
function createSandbox(source, root, modules, baseSha) {
  // Vitest names its module cache after this folder, so each root needs its own name: a nested run must not delete a live cache.
  const cwd = path.join(root, path.basename(root));
  dropClone(cwd);
  mkdirSync(root, { recursive: true });
  git(root, 'clone', '--quiet', '--shared', '--no-checkout', source, cwd);
  git(cwd, 'config', 'core.hooksPath', '.git/no-hooks');
  const baseKey = installKey(cwd, baseSha);
  /** Moves the clone to a commit with the right node_modules. */
  const checkout = (sha) => {
    git(cwd, 'checkout', '--quiet', '--force', '--detach', sha);
    git(cwd, 'clean', '-ffdxq', '-e', 'node_modules');
    const key = installKey(cwd, sha);
    linkModules(cwd, key === baseKey ? modules : ownInstall(cwd, path.join(root, 'installs'), key));
  };
  return { cwd, checkout };
}

/** Deletes a clone. The junction goes first, so nothing follows it. */
function dropClone(cwd) {
  const link = path.join(cwd, 'node_modules');
  if (lstatSync(link, { throwIfNoEntry: false })?.isSymbolicLink()) unlinkSync(link);
  rmSync(cwd, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 });
}

/** Tools for `scoreBug` on one clone. */
function toolsFor({ cwd, checkout }, { selector, base, enterBug, subset }) {
  const runAll = () => runVitest(cwd, subset ?? []);
  return {
    enterBug,
    enterControl: () => checkout(base),
    selected: () => selectedTests(cwd, selector, base),
    runAll,
    runFiles: async (files) => {
      if (fitsCommandLine(files)) return runVitest(cwd, files);
      const all = await runAll();
      return all.valid ? { ...all, red: Object.fromEntries(Object.entries(all.red).filter(([file]) => files.includes(file))) } : all;
    },
  };
}

function landingCase(sandbox, sha, options) {
  const parent = git(sandbox.cwd, 'rev-parse', `${sha}^`);
  const plan = replayPlan(diffEntries(sandbox.cwd, parent, sha));
  return {
    id: `landing:${sha.slice(0, 9)}`,
    kind: 'landing',
    change: plan.change,
    tools: toolsFor(sandbox, {
      ...options,
      base: parent,
      enterBug: () => {
        sandbox.checkout(sha);
        if (plan.restore.length) git(sandbox.cwd, 'checkout', parent, '--', ...plan.restore);
        for (const file of plan.remove) rmSync(path.join(sandbox.cwd, file), { force: true });
      },
    }),
  };
}

function mutantCase(sandbox, mutant, baseSha, options) {
  return {
    id: mutantId(mutant),
    kind: mutant.kind,
    change: [mutant.file],
    tools: toolsFor(sandbox, {
      ...options,
      base: baseSha,
      enterBug: () => {
        sandbox.checkout(baseSha);
        const file = path.join(sandbox.cwd, mutant.file);
        if (mutant.op === 'delete-file') rmSync(file);
        else writeFileSync(file, applyMutant(readFileSync(file, 'utf8'), mutant));
      },
    }),
  };
}

/** Recent commits with their changed files. */
function commitsSince(cwd, baseSha, since) {
  // A date alone takes git's current time of day, which would redraw the sample through the day.
  return git(cwd, 'log', `--since=${since}T00:00:00Z`, '--format=%H %P', baseSha).split('\n').filter(Boolean).map((line) => {
    const [sha, ...parents] = line.split(' ');
    return { sha, parents, files: parents.length === 1 ? diffEntries(cwd, parents[0], sha) : [] };
  });
}

const defaultDir = (cwd) => path.join(commonDir(cwd), 'selection-replay');
const casesFile = (dir) => path.join(dir, 'cases.jsonl');
const readCases = (dir) => (existsSync(casesFile(dir)) ? readFileSync(casesFile(dir), 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line)) : []);

/** An earlier run's full-suite reds, in place of a new full run; `scoreBug` then rechecks each alone. Its filtered reds come back too, so a bad earlier filter can't hide one. */
function priorRun({ red, unconfirmed, alreadyRed, files }, dropped) {
  const candidates = [...red, ...unconfirmed, ...alreadyRed].filter((file) => !dropped.includes(file));
  return { valid: true, files, red: Object.fromEntries(candidates.map((file) => [file, []])) };
}

async function runCommand(values, cwd) {
  const dir = path.resolve(values.dir ?? defaultDir(cwd));
  mkdirSync(dir, { recursive: true });
  const landingCount = Number(values.landings);
  if (landingCount && !/^\d{4}-\d{2}-\d{2}$/.test(values.since ?? '')) throw new Error('--landings needs --since <YYYY-MM-DD>.');
  const mainRoot = path.dirname(commonDir(cwd));
  const metaFile = path.join(dir, 'meta.json');
  const selector = path.resolve(values.selector ?? path.join(here, 'affectedTests.mjs'));
  const wanted = { base: values.base && git(cwd, 'rev-parse', values.base), seed: values.seed && Number(values.seed), selector };
  const meta = existsSync(metaFile) ? JSON.parse(readFileSync(metaFile, 'utf8')) : { base: wanted.base ?? git(cwd, 'rev-parse', 'HEAD'), seed: wanted.seed ?? 1, selector };
  const conflicts = settingConflicts(meta, wanted);
  if (conflicts.length) throw new Error(`${dir} holds results with another ${conflicts.join(', ')}. Name a new --dir.`);
  writeFileSync(metaFile, JSON.stringify(meta));
  const sandboxRoot = path.resolve(values.sandbox ?? path.join(mainRoot, '.stryker-tmp', 'selection-replay'));
  const modules = path.resolve(values.modules ?? path.join(mainRoot, 'node_modules'));
  const sandbox = createSandbox(cwd, sandboxRoot, modules, meta.base);
  const options = {
    selector,
    subset: values['tests-subset'] ? readFileSync(values['tests-subset'], 'utf8').split('\n').map((line) => line.trim()).filter(Boolean) : null,
  };
  const deadline = Date.now() + Number(values['max-hours']) * 3_600_000;
  let finished = true;
  try {
    const named = values.landing.map((ref) => git(sandbox.cwd, 'rev-parse', ref));
    const sampled = landingCount ? sampleLandings(commitsSince(sandbox.cwd, meta.base, values.since), landingCount, meta.seed).map(({ sha }) => sha) : [];
    sandbox.checkout(meta.base);
    const read = (file) => (existsSync(path.join(sandbox.cwd, file)) ? readFileSync(path.join(sandbox.cwd, file), 'utf8') : null);
    const mutants = sampleMutants(mutationPopulation(git(sandbox.cwd, 'ls-files').split('\n')), { codeCount: Number(values['code-mutants']), dataCount: Number(values['data-mutants']), seed: meta.seed, read });
    const planned = [...[...new Set([...named, ...sampled])].map((sha) => landingCase(sandbox, sha, options)), ...mutants.map((mutant) => mutantCase(sandbox, mutant, meta.base, options))];
    const done = new Set(readCases(dir).map((row) => row.id));
    const priors = new Map((values.rescore ? readCases(path.resolve(values.rescore)) : []).filter(({ status }) => status === 'bug' || status === 'no-red').map((row) => [row.id, row]));
    for (const { tools: fullTools, ...entry } of planned) {
      const prior = priors.get(entry.id);
      const tools = prior ? { ...fullTools, runAll: () => priorRun(prior, values['drop-red']) } : fullTools;
      if (done.has(entry.id)) continue;
      if (Date.now() > deadline) {
        console.log('The time limit passed; run this command again to resume.');
        finished = false;
        break;
      }
      const started = Date.now();
      const score = await scoreBug(tools).catch((error) => ({ status: 'invalid', reason: error instanceof Error ? error.message : String(error) }));
      const row = { ...entry, ...score, subset: Boolean(options.subset), wallMs: Date.now() - started };
      appendFileSync(casesFile(dir), `${JSON.stringify(row)}\n`);
      console.log(`${entry.id}: ${row.status}, ${row.selected ?? '?'} selected, ${row.red?.length ?? 0} red, ${row.missed?.length ?? 0} missed, ${(row.wallMs / 1000).toFixed(0)} s.`);
    }
  } finally {
    dropClone(sandbox.cwd);
    // Vitest names its module cache after the checkout's folder.
    rmSync(path.join(modules, '.vite', `${path.basename(sandbox.cwd)}-vitest`), { recursive: true, force: true });
  }
  // A resumed run still needs its installs.
  if (finished) rmSync(path.join(sandboxRoot, 'installs'), { recursive: true, force: true });
  return 0;
}

function reportCommand(values, cwd) {
  const summary = summarize(readCases(path.resolve(values.dir ?? defaultDir(cwd))));
  console.log(values.json ? JSON.stringify(summary) : replayReport(summary));
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      landings: { type: 'string', default: '0' },
      'code-mutants': { type: 'string', default: '0' },
      'data-mutants': { type: 'string', default: '0' },
      landing: { type: 'string', multiple: true, default: [] },
      seed: { type: 'string' },
      since: { type: 'string' },
      selector: { type: 'string' },
      base: { type: 'string' },
      'max-hours': { type: 'string', default: '24' },
      'tests-subset': { type: 'string' },
      rescore: { type: 'string' },
      'drop-red': { type: 'string', multiple: true, default: [] },
      dir: { type: 'string' },
      sandbox: { type: 'string' },
      modules: { type: 'string' },
      json: { type: 'boolean', default: false },
    },
  });
  if (positionals[0] === 'run') process.exit(await runCommand(values, process.cwd()));
  if (positionals[0] === 'report') process.exit(reportCommand(values, process.cwd()));
  throw new Error('Name a command: run, report.');
}
