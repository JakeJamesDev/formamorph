// @vitest-environment node
import { execFileSync, execSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ownInstall, redFiles } from './selectionReplay.mjs';
import { applyMutant, codeSites, isReplayable, isTestPath, missUpperBound, mutationPopulation, replayPlan, replayReport, sampleLandings, sampleMutants, scoreBug, summarize } from './selectionReplayRules.mjs';

const SCRIPT = path.resolve('scripts/selectionReplay.mjs');
const SELECTION = pathToFileURL(path.resolve('scripts/testSelection.mjs')).href;
const AFFECTED = path.resolve('scripts/affectedTests.mjs');
const MODULES = path.resolve('node_modules');

const write = (dir, file, text) => {
  mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
  writeFileSync(path.join(dir, file), text);
};

describe('the replay against real git and real vitest', () => {
  // A doc read by path, as the app's docs tests do. The landing deletes it and rewrites the test that read it.
  const READS_DOC = "import { readFileSync } from 'node:fs';\nit('reads the doc', () => { expect(readFileSync('docs/Settings.md', 'utf8')).toContain('page'); });\n";
  const PATH_TRIGGER_TEST = 'src/lib/docs/docsCoverage.test.ts';
  const OTHER_TEST = "it('needs nothing', () => { expect(1).toBe(1); });\n";
  let dir;
  let tools;
  let landing;
  const git = (...args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd: dir, encoding: 'utf8' }).trim();

  /** The summary of a replay of the landing with this selector. */
  const replay = (selector, name) => {
    const out = path.join(tools, name);
    const sandbox = path.join(tools, `${name}-sandbox`);
    execFileSync(process.execPath, [SCRIPT, 'run', '--landing', landing, '--selector', selector, '--dir', out, '--sandbox', sandbox, '--modules', MODULES], { cwd: dir, stdio: 'ignore' });
    expect(existsSync(path.join(sandbox, `${name}-sandbox`))).toBe(false);
    return JSON.parse(execFileSync(process.execPath, [SCRIPT, 'report', '--dir', out, '--json'], { cwd: dir, encoding: 'utf8' }));
  };

  beforeAll(() => {
    dir = mkdtempSync(path.join(os.tmpdir(), 'selection-replay-repo-'));
    tools = mkdtempSync(path.join(os.tmpdir(), 'selection-replay-tools-'));
    git('init', '--quiet');
    write(dir, 'vitest.config.mjs', "export default { test: { globals: true, environment: 'node', include: ['**/*.test.ts'] } };\n");
    write(dir, '.gitignore', 'node_modules\n');
    write(dir, 'docs/Settings.md', 'page\n');
    write(dir, PATH_TRIGGER_TEST, READS_DOC);
    write(dir, 'src/a.test.ts', OTHER_TEST);
    write(dir, 'src/b.test.ts', OTHER_TEST);
    write(dir, 'src/same.ts', 'export const same = (a, b) => a === b;\n');
    write(dir, 'src/same.test.ts', "import { same } from './same';\nit('compares', () => { expect(same(1, 1)).toBe(true); });\n");
    git('add', '.');
    git('commit', '--quiet', '-m', 'start');
    git('rm', '--quiet', 'docs/Settings.md');
    write(dir, PATH_TRIGGER_TEST, OTHER_TEST);
    write(dir, 'src/added.test.ts', "it('is new with the landing', () => { expect(1).toBe(2); });\n");
    git('add', '.');
    git('commit', '--quiet', '-m', 'landing');
    landing = git('rev-parse', 'HEAD');
    // The selection hole from ticket 04: deleted files never reach the path triggers.
    write(tools, 'gapped.mjs', `import { changedSince, relatedFiles } from '${SELECTION}';\nconsole.log(relatedFiles(changedSince(process.argv[2]), new Map()).join('\\n'));\n`);
    write(tools, 'everything.mjs', "import { execFileSync } from 'node:child_process';\nconsole.log(execFileSync('git', ['ls-files', '*.test.ts'], { encoding: 'utf8' }));\n");
  }, 60_000);

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
    rmSync(tools, { recursive: true, force: true });
  });

  it('reports a miss when a known gap is put back', () => {
    const summary = replay(path.join(tools, 'gapped.mjs'), 'gapped');
    expect(summary.bugs).toBe(1);
    expect(summary.misses).toBe(1);
    expect(summary.missList[0]).toMatchObject({ id: `landing:${landing.slice(0, 9)}`, change: ['docs/Settings.md'] });
    expect(summary.missList[0].missed).toEqual([{ file: PATH_TRIGGER_TEST, tests: ['reads the doc'] }]);
  }, 60_000);

  it('reports no miss with the real selection, which fires the trigger of the deleted file', () => {
    const summary = replay(AFFECTED, 'real');
    expect(summary).toMatchObject({ bugs: 1, misses: 0, redFiles: 1, precision: 1 });
    expect(summary.upperBound).toEqual({ rate: 1, method: 'rule of three' });
  }, 60_000);

  it('reports no miss and a low precision when everything is selected', () => {
    const summary = replay(path.join(tools, 'everything.mjs'), 'everything');
    expect(summary).toMatchObject({ bugs: 1, misses: 0, medianSelectedShare: 1 });
    expect(summary.precision).toBe(1 / 4);
  }, 60_000);

  it('leaves the module cache of the default clone alone', () => {
    const live = path.join(MODULES, '.vite', 'selection-replay-vitest', `sentinel-${process.pid}`);
    write(path.dirname(live), path.basename(live), '');
    try {
      replay(AFFECTED, 'cache');
      expect(existsSync(live)).toBe(true);
    } finally {
      rmSync(live, { force: true });
    }
  }, 60_000);

  it('rescores from stored reds, and drops a named file', () => {
    const rerun = (name, ...extra) => {
      const out = path.join(tools, name);
      execFileSync(process.execPath, [SCRIPT, 'run', '--landing', landing, '--selector', AFFECTED, '--rescore', path.join(tools, 'real'), ...extra, '--dir', out, '--sandbox', path.join(tools, `${name}-sandbox`), '--modules', MODULES], { cwd: dir, stdio: 'ignore' });
      return JSON.parse(execFileSync(process.execPath, [SCRIPT, 'report', '--dir', out, '--json'], { cwd: dir, encoding: 'utf8' }));
    };
    replay(AFFECTED, 'real');
    expect(rerun('rescored')).toMatchObject({ bugs: 1, misses: 0, redFiles: 1 });
    expect(rerun('dropped', '--drop-red', PATH_TRIGGER_TEST)).toMatchObject({ bugs: 0, noRed: 1 });
  }, 60_000);

  it('samples landings from the start of the since date, whatever the time of day', () => {
    const repo = mkdtempSync(path.join(os.tmpdir(), 'selection-replay-since-'));
    const commit = (date, value) => {
      write(repo, 'src/v.ts', `export const v = ${value};\n`);
      write(repo, 'src/v.test.ts', `import { v } from './v';\nit('reads', () => { expect(v).toBe(${value}); });\n`);
      const run = (...args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd: repo, encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date } }).trim();
      run('add', '.');
      run('commit', '--quiet', '-m', `value ${value}`);
      return run('rev-parse', 'HEAD');
    };
    const sample = (name, since) => execFileSync(process.execPath, [SCRIPT, 'run', '--landings', '5', '--since', since, '--code-mutants', '0', '--data-mutants', '0', '--selector', AFFECTED, '--dir', path.join(tools, name), '--sandbox', path.join(tools, `${name}-sandbox`), '--modules', MODULES], { cwd: repo, stdio: 'pipe' });
    try {
      execFileSync('git', ['init', '--quiet'], { cwd: repo });
      write(repo, 'vitest.config.mjs', "export default { test: { globals: true, environment: 'node', include: ['**/*.test.ts'] } };\n");
      write(repo, '.gitignore', 'node_modules\n');
      commit('2019-12-30T12:00:00Z', 1);
      commit('2019-12-31T23:59:59Z', 2);
      const first = commit('2020-01-01T00:00:00Z', 3);
      sample('since', '2020-01-01');
      const ids = readFileSync(path.join(tools, 'since', 'cases.jsonl'), 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line).id);
      expect(ids).toEqual([`landing:${first.slice(0, 9)}`]);
      expect(() => sample('since-relative', '2 weeks ago')).toThrow('YYYY-MM-DD');
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  }, 60_000);

  it('marks a run invalid when the selection listing fails, so it never reads as an empty selection', () => {
    write(tools, 'broken.mjs', 'process.exit(1);\n');
    const summary = replay(path.join(tools, 'broken.mjs'), 'broken');
    expect(summary).toMatchObject({ bugs: 0, misses: 0, invalid: 1 });
    expect(summary.upperBound.method).toBe('no evidence');
  }, 60_000);

  it('scores a sampled mutant, and a second run resumes without repeating it', () => {
    const out = path.join(tools, 'mutant');
    const args = [SCRIPT, 'run', '--code-mutants', '1', '--selector', AFFECTED, '--dir', out, '--sandbox', path.join(tools, 'mutant-sandbox'), '--modules', MODULES];
    execFileSync(process.execPath, args, { cwd: dir, stdio: 'ignore' });
    execFileSync(process.execPath, args, { cwd: dir, stdio: 'ignore' });
    const rows = readFileSync(path.join(out, 'cases.jsonl'), 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: 'code:src/same.ts:1:swap ===', kind: 'code', status: 'bug', red: ['src/same.test.ts'], missed: [], selected: 1 });
    // A candidate selector must not inherit these results.
    expect(() => execFileSync(process.execPath, [...args.slice(0, 4), '--selector', path.join(tools, 'everything.mjs'), ...args.slice(6)], { cwd: dir, stdio: 'pipe' })).toThrow(/another selector/);
  }, 60_000);
});

describe('a tree with another lockfile', () => {
  it('installs its own node_modules from its own lockfile, once', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'selection-replay-install-'));
    try {
      // The tree and the install sit at one depth, so the lockfile's relative path reaches the dependency from both.
      const tree = path.join(root, 'trees', 'one');
      const installs = path.join(root, 'installs');
      write(root, 'dep/package.json', JSON.stringify({ name: 'dep', version: '1.0.0' }));
      write(tree, 'package.json', JSON.stringify({ name: 'tree', version: '1.0.0', dependencies: { dep: 'file:../../dep' } }));
      write(tree, 'patches/note.patch', '');
      execSync('npm install --package-lock-only --no-audit --no-fund', { cwd: tree, stdio: 'ignore' });
      const modules = ownInstall(tree, installs, 'key');
      expect(modules).toBe(path.join(installs, 'key', 'node_modules'));
      expect(existsSync(path.join(modules, 'dep', 'package.json'))).toBe(true);
      expect(existsSync(path.join(installs, 'key', 'patches', 'note.patch'))).toBe(true);
      rmSync(path.join(modules, 'dep'), { recursive: true, force: true });
      expect(ownInstall(tree, installs, 'key')).toBe(modules);
      expect(existsSync(path.join(modules, 'dep'))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, 60_000);
});

describe('redFiles', () => {
  it('names failed tests, marks a file that failed to load, and skips green files', () => {
    const root = path.resolve('repo');
    const result = (name, status, tests) => ({ name: path.join(root, name), status, assertionResults: tests });
    expect(redFiles({ testResults: [
      result('src/a.test.ts', 'failed', [{ status: 'failed', fullName: 'a red' }, { status: 'passed', fullName: 'a green' }]),
      result('src/b.test.ts', 'failed', []),
      result('src/c.test.ts', 'passed', [{ status: 'passed', fullName: 'c' }]),
    ] }, root)).toEqual({ 'src/a.test.ts': ['a red'], 'src/b.test.ts': ['(the file failed to load)'] });
  });

  it('reads a crashed worker as red, though vitest reports its file as passed, and a skipped test as green', () => {
    const root = path.resolve('repo');
    expect(redFiles({ testResults: [
      { name: path.join(root, 'src/crash.test.ts'), status: 'passed', assertionResults: [{ status: 'pending', fullName: 'crashes' }] },
      { name: path.join(root, 'src/skip.test.ts'), status: 'passed', assertionResults: [{ status: 'skipped', fullName: 'later' }, { status: 'todo', fullName: 'soon' }] },
    ] }, root)).toEqual({ 'src/crash.test.ts': ['crashes'] });
  });
});

describe('scoreBug', () => {
  /** Tools whose runs return `outcomes` in order, recording what ran. */
  const toolsOf = (selected, ...outcomes) => {
    const calls = [];
    return {
      calls,
      enterBug: () => calls.push('bug'),
      enterControl: () => calls.push('control'),
      selected: () => selected,
      runAll: () => outcomes.shift(),
      runFiles: (files) => {
        calls.push(files);
        return outcomes.shift();
      },
    };
  };
  const run = (red, extra = {}) => ({ valid: true, files: 10, red, ...extra });
  const RED = { 'a.test.ts': ['t'], 'b.test.ts': ['u'] };

  it('counts an unselected file that stays red alone and is green without the bug', async () => {
    const tools = toolsOf(['a.test.ts'], run(RED), run(RED), run({}));
    expect(await scoreBug(tools)).toMatchObject({ status: 'bug', red: ['a.test.ts', 'b.test.ts'], missed: [{ file: 'b.test.ts', tests: ['u'] }] });
    expect(tools.calls).toEqual(['bug', ['a.test.ts', 'b.test.ts'], 'control', ['a.test.ts', 'b.test.ts']]);
  });

  it('drops a file that goes green alone, since load can turn a file red', async () => {
    const result = await scoreBug(toolsOf([], run(RED), run({ 'a.test.ts': ['t'] }), run({})));
    expect(result).toMatchObject({ red: ['a.test.ts'], unconfirmed: ['b.test.ts'] });
  });

  it('drops a file that is red without the bug', async () => {
    const result = await scoreBug(toolsOf([], run(RED), run(RED), run({ 'b.test.ts': ['u'] })));
    expect(result).toMatchObject({ red: ['a.test.ts'], alreadyRed: ['b.test.ts'] });
  });

  it('counts a new red test in a file that already held a red test', async () => {
    const result = await scoreBug(toolsOf([], run({ 'a.test.ts': ['old', 'new'] }), run({ 'a.test.ts': ['old', 'new'] }), run({ 'a.test.ts': ['old'] })));
    expect(result).toMatchObject({ status: 'bug', red: ['a.test.ts'], alreadyRed: [], missed: [{ file: 'a.test.ts', tests: ['new'] }] });
  });

  it('names the filtered reds the selection left out', async () => {
    const result = await scoreBug(toolsOf(['c.test.ts'], run({ ...RED, 'c.test.ts': ['v'] }), run({ 'b.test.ts': ['u'], 'c.test.ts': ['v'] }), run({ 'b.test.ts': ['u'], 'c.test.ts': ['v'] })));
    expect(result.filteredUnselected).toEqual(['a.test.ts', 'b.test.ts']);
  });

  it('reads no red as no trial', async () => {
    expect(await scoreBug(toolsOf(['a.test.ts'], run({})))).toMatchObject({ status: 'no-red' });
  });

  it.each([
    ['the full run', [{ valid: false, reason: 'hung' }]],
    ['the rerun alone', [run(RED), { valid: false, reason: 'hung' }]],
    ['the control', [run(RED), run(RED), { valid: false, reason: 'hung' }]],
  ])('marks a broken %s invalid, never green', async (_name, outcomes) => {
    expect(await scoreBug(toolsOf([], ...outcomes))).toMatchObject({ status: 'invalid', reason: 'hung' });
  });

  it('keeps a red exit with no named file apart from a green run', async () => {
    expect(await scoreBug(toolsOf([], run({}, { failed: true })))).toMatchObject({ status: 'unattributed' });
  });
});

describe('summarize', () => {
  const bug = (kind, selected, red, missed = []) => ({ id: `${kind}:${selected}`, kind, change: ['x.ts'], status: 'bug', selected, files: 100, red, missed: missed.map((file) => ({ file, tests: ['t'] })) });

  it('counts a bug once however many files it turned red', () => {
    const summary = summarize([bug('code', 10, ['a', 'b', 'c'], ['b', 'c']), bug('code', 10, ['d'])]);
    expect(summary).toMatchObject({ bugs: 2, misses: 1, redFiles: 4, missedFiles: 2 });
  });

  it('pools precision over what was selected, leaving a miss out of the hits', () => {
    expect(summarize([bug('code', 10, ['a', 'b'], ['b']), bug('data', 30, ['c', 'd', 'e'])]).precision).toBe(4 / 40);
  });

  it('counts only bugs that turned something red as the sample', () => {
    const summary = summarize([bug('code', 10, ['a']), { id: 'n', kind: 'code', status: 'no-red', selected: 10, files: 100, red: [], missed: [] }, { id: 'i', kind: 'code', status: 'invalid' }]);
    expect(summary).toMatchObject({ bugs: 1, noRed: 1, invalid: 1 });
    expect(summary.upperBound.rate).toBe(1);
  });

  it('claims nothing from no evidence', () => {
    const summary = summarize([{ id: 'n', kind: 'code', status: 'no-red', selected: 5, files: 10, red: [], missed: [] }]);
    expect(summary).toMatchObject({ bugs: 0, misses: 0, precision: null });
    expect(summary.upperBound).toEqual({ rate: 1, method: 'no evidence' });
  });

  it('lists each miss with its tests, and warns when a subset ran', () => {
    const report = replayReport(summarize([{ ...bug('landing', 5, ['a.test.ts'], ['a.test.ts']), subset: true }]));
    expect(report).toContain('`a.test.ts`: t');
    expect(report).toContain('subset');
    expect(replayReport(summarize([bug('code', 5, ['a'])]))).toContain('**No misses in 1 bugs.**');
  });

  it('never reports no misses from invalid runs, and lists them', () => {
    const report = replayReport(summarize([{ id: 'code:a.ts:1:swap', kind: 'code', status: 'invalid', reason: 'hung' }]));
    expect(report).toContain('**No evidence');
    expect(report).not.toContain('No misses');
    expect(report).toContain('`code:a.ts:1:swap`: hung');
  });

  it('counts a bug with no red in the selected share', () => {
    const noRed = { id: 'n', kind: 'code', status: 'no-red', selected: 100, files: 100, red: [], missed: [] };
    expect(summarize([noRed]).medianSelectedShare).toBe(1);
  });

  it('lists filtered reds that were not selected', () => {
    const report = replayReport(summarize([{ ...bug('code', 5, ['a']), filteredUnselected: ['b.test.ts'] }]));
    expect(report).toContain('`b.test.ts`');
  });
});

describe('missUpperBound', () => {
  it('uses the rule of three at zero misses', () => {
    expect(missUpperBound(0, 30)).toEqual({ rate: 0.1, method: 'rule of three' });
  });

  it('solves the exact bound above zero', () => {
    // The textbook 95% one-sided Clopper-Pearson bound for 1 in 20.
    expect(missUpperBound(1, 20).rate).toBeCloseTo(0.2161, 3);
    expect(missUpperBound(1, 20).method).toBe('exact binomial');
    expect(missUpperBound(5, 5).rate).toBe(1);
  });
});

describe('replayPlan', () => {
  it('splits a landing into restored tests, removed tests and the change', () => {
    expect(replayPlan([
      { status: 'M', path: 'src/a.ts' },
      { status: 'D', path: 'docs/x.md' },
      { status: 'M', path: 'src/a.test.ts' },
      { status: 'D', path: 'src/gone.test.tsx' },
      { status: 'A', path: 'src/new.test.ts' },
      { status: 'M', path: 'src/__snapshots__/a.test.ts.snap' },
    ])).toEqual({ restore: ['src/a.test.ts', 'src/gone.test.tsx', 'src/__snapshots__/a.test.ts.snap'], remove: ['src/new.test.ts'], change: ['src/a.ts', 'docs/x.md'] });
  });

  it.each(['src/a.test.ts', 'scripts/a.test.mjs', 'src/test/setup.ts', 'testing/parity/x.json', 'scripts/fixtures/a.json', 'src/lib/__parity__/a.json'])('reads %s as a test path', (file) => {
    expect(isTestPath(file)).toBe(true);
  });

  it.each(['src/lib/a.ts', 'docs/testing.md', 'src/lib/latest.ts'])('reads %s as the change', (file) => {
    expect(isTestPath(file)).toBe(false);
  });
});

describe('sampleLandings', () => {
  const commit = (sha, files, parents = ['p']) => ({ sha, parents, files });
  const CHANGE = { status: 'M', path: 'src/a.ts' };
  const OLD_TEST = { status: 'M', path: 'src/a.test.ts' };

  it('takes a commit that changes a gate input and rewrites an old test', () => {
    expect(isReplayable(commit('a', [CHANGE, OLD_TEST]))).toBe(true);
  });

  it.each([
    ['a merge', commit('a', [CHANGE, OLD_TEST], ['p', 'q'])],
    ['no old test', commit('a', [CHANGE, { status: 'A', path: 'src/n.test.ts' }])],
    ['only tests', commit('a', [OLD_TEST])],
    ['only internal docs', commit('a', [{ status: 'M', path: 'docs-internal/x.md' }, OLD_TEST])],
  ])('skips %s', (_name, entry) => {
    expect(isReplayable(entry)).toBe(false);
  });

  it('repeats for a seed and differs across seeds', () => {
    const commits = Array.from({ length: 50 }, (_, index) => commit(`c${index}`, [CHANGE, OLD_TEST]));
    const shas = (seed) => sampleLandings(commits, 5, seed).map(({ sha }) => sha);
    expect(shas(1)).toEqual(shas(1));
    expect(shas(1)).not.toEqual(shas(2));
    expect(shas(1)).toHaveLength(5);
  });
});

describe('mutants', () => {
  const opsOf = (source, file = 'a.ts') => codeSites(file, source).map(({ op }) => op);

  it('finds the decisions in code', () => {
    expect(opsOf('if (a === b && c) { d = true; }\nconst e = f > 1 ? g : h;\nconst i = j - 1;')).toEqual(expect.arrayContaining(['swap ===', 'swap &&', 'negate-condition', 'flip true', 'swap >', 'swap -']));
  });

  it('applies a site so the text changes only there', () => {
    const source = 'const a = b === c;';
    const [site] = codeSites('a.ts', source);
    expect(applyMutant(source, site)).toBe('const a = b !== c;');
  });

  it('leaves types and imports alone, and loop conditions that could hang a run', () => {
    expect(opsOf("import a from 'a';\ntype B = true;\ninterface C { d: false }\nlet e: true;\nwhile (f < g) { h(); }\nfor (let i = 0; i < 3; i++) { j(); }")).toEqual([]);
  });

  it('still mutates a loop body', () => {
    expect(opsOf('while (a) { b = c === d; }')).toEqual(['swap ===']);
  });

  it('reads JSX', () => {
    expect(opsOf('const a = <div hidden={b === c} />;', 'a.tsx')).toEqual(['swap ===']);
  });

  it('sorts the population by kind and leaves tests and generated data out', () => {
    expect(mutationPopulation(['src/a.ts', 'src/a.test.ts', 'src/a.d.ts', 'src/test/h.ts', 'electron/m.cjs', 'marketing/x.ts', 'docs/a.md', 'src/index.css', 'src/defaultworlds/x.json', 'testing/g2p/pins.json', 'docs-internal/s.md', 'package-lock.json', 'tsconfig.app.json', 'public/x.png'])).toEqual({
      code: ['src/a.ts', 'electron/m.cjs'],
      data: ['docs/a.md', 'src/index.css', 'src/defaultworlds/x.json', 'testing/g2p/pins.json'],
    });
  });

  it('samples each file once, repeats for a seed, and skips a file with no site', () => {
    const files = Array.from({ length: 20 }, (_, index) => `src/f${index}.ts`);
    const read = (file) => (file === 'src/f3.ts' ? 'const none = 1;' : 'const a = b === c;');
    const take = (seed) => sampleMutants({ code: files, data: [] }, { codeCount: 19, dataCount: 0, seed, read });
    const picked = take(7);
    expect(picked).toHaveLength(19);
    expect(new Set(picked.map(({ file }) => file)).size).toBe(19);
    expect(picked.map(({ file }) => file)).not.toContain('src/f3.ts');
    expect(take(7)).toEqual(picked);
  });

  it('samples a data mutant as a line deletion or a file deletion', () => {
    const files = Array.from({ length: 40 }, (_, index) => `docs/f${index}.md`);
    const source = 'one\n\ntwo\n';
    const picked = sampleMutants({ code: [], data: files }, { codeCount: 0, dataCount: 40, seed: 3, read: () => source });
    expect(new Set(picked.map(({ op }) => op))).toEqual(new Set(['delete-file', 'delete-line']));
    for (const mutant of picked.filter(({ op }) => op === 'delete-line')) {
      expect(['\ntwo\n', 'one\n\n']).toContain(applyMutant(source, mutant));
    }
  });

  it('keeps the data sample when more code mutants are asked for', () => {
    const code = Array.from({ length: 20 }, (_, index) => `src/f${index}.ts`);
    const data = Array.from({ length: 20 }, (_, index) => `docs/f${index}.md`);
    const dataOf = (codeCount) => sampleMutants({ code, data }, { codeCount, dataCount: 5, seed: 9, read: (file) => (file.endsWith('.md') ? 'one\n' : 'const a = b === c;') }).filter(({ kind }) => kind === 'data');
    expect(dataOf(2)).toEqual(dataOf(10));
  });

  it('skips a file that is gone', () => {
    expect(sampleMutants({ code: ['src/a.ts'], data: [] }, { codeCount: 1, dataCount: 0, seed: 1, read: () => null })).toEqual([]);
  });
});
